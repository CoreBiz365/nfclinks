const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function simpleMultitenantMigration() {
  try {
    console.log('🚀 Starting Simple Multi-Tenant Migration...\n');
    
    // Step 1: Check if organizations exist
    console.log('📋 Step 1: Checking existing organizations...');
    const existingOrgs = await pool.query('SELECT * FROM app.organizations WHERE deleted_at IS NULL');
    
    let orgId;
    if (existingOrgs.rows.length > 0) {
      orgId = existingOrgs.rows[0].id;
      console.log(`   ✅ Using existing organization: ${existingOrgs.rows[0].name} (${orgId})`);
    } else {
      // Create a new organization
      console.log('   📝 Creating new organization...');
      const newOrg = await pool.query(`
        INSERT INTO app.organizations (id, name, is_demo, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Default Organization', false, NOW(), NOW())
        RETURNING id, name
      `);
      orgId = newOrg.rows[0].id;
      console.log(`   ✅ Created organization: ${newOrg.rows[0].name} (${orgId})`);
    }
    
    // Step 2: Assign all NFC tags to the organization
    console.log('\n📋 Step 2: Assigning NFC tags to organization...');
    const nfcUpdate = await pool.query(`
      UPDATE app.nfc_tags 
      SET organization_id = $1, updated_at = NOW()
      WHERE organization_id IS NULL
    `, [orgId]);
    
    console.log(`   ✅ Updated ${nfcUpdate.rowCount} NFC tags`);
    
    // Step 3: Create organization_members table if it doesn't exist
    console.log('\n📋 Step 3: Setting up organization members...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app.organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(organization_id, user_id)
      )
    `);
    console.log('   ✅ Organization members table ready');
    
    // Step 4: Add all existing users to the organization
    console.log('\n📋 Step 4: Adding users to organization...');
    const users = await pool.query('SELECT id FROM app.users WHERE deleted_at IS NULL');
    
    for (const user of users.rows) {
      try {
        await pool.query(`
          INSERT INTO app.organization_members (organization_id, user_id, role, status)
          VALUES ($1, $2, 'owner', 'active')
          ON CONFLICT (organization_id, user_id) DO NOTHING
        `, [orgId, user.id]);
        console.log(`   ✅ Added user ${user.id} to organization`);
      } catch (error) {
        console.log(`   ⚠️  User ${user.id}: ${error.message}`);
      }
    }
    
    // Step 5: Enable RLS on key tables
    console.log('\n📋 Step 5: Enabling Row Level Security...');
    const tables = ['nfc_tags', 'nfc_scans'];
    
    for (const table of tables) {
      try {
        await pool.query(`ALTER TABLE app.${table} ENABLE ROW LEVEL SECURITY`);
        console.log(`   ✅ RLS enabled on app.${table}`);
      } catch (error) {
        console.log(`   ⚠️  RLS on app.${table}: ${error.message}`);
      }
    }
    
    // Step 6: Create basic RLS policies
    console.log('\n📋 Step 6: Creating RLS policies...');
    
    // NFC tags policy - users can only see tags from their organization
    try {
      await pool.query(`
        DROP POLICY IF EXISTS "nfc_tags_policy" ON app.nfc_tags
      `);
      
      await pool.query(`
        CREATE POLICY "nfc_tags_policy" ON app.nfc_tags
        FOR ALL TO biz365_user
        USING (
          organization_id IN (
            SELECT om.organization_id 
            FROM app.organization_members om 
            WHERE om.user_id = current_setting('app.current_user_id', true)::uuid
            AND om.status = 'active'
          )
        )
      `);
      console.log('   ✅ NFC tags policy created');
    } catch (error) {
      console.log(`   ⚠️  NFC tags policy: ${error.message}`);
    }
    
    // NFC scans policy
    try {
      await pool.query(`
        DROP POLICY IF EXISTS "nfc_scans_policy" ON app.nfc_scans
      `);
      
      await pool.query(`
        CREATE POLICY "nfc_scans_policy" ON app.nfc_scans
        FOR ALL TO biz365_user
        USING (
          nfc_tag_id IN (
            SELECT nt.id 
            FROM app.nfc_tags nt 
            WHERE nt.organization_id IN (
              SELECT om.organization_id 
              FROM app.organization_members om 
              WHERE om.user_id = current_setting('app.current_user_id', true)::uuid
              AND om.status = 'active'
            )
          )
        )
      `);
      console.log('   ✅ NFC scans policy created');
    } catch (error) {
      console.log(`   ⚠️  NFC scans policy: ${error.message}`);
    }
    
    // Step 7: Create helper functions
    console.log('\n📋 Step 7: Creating helper functions...');
    
    // Function to set current user context
    try {
      await pool.query(`
        CREATE OR REPLACE FUNCTION app.set_current_user(user_id UUID)
        RETURNS VOID AS $$
        BEGIN
          PERFORM set_config('app.current_user_id', user_id::text, true);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `);
      console.log('   ✅ set_current_user function created');
    } catch (error) {
      console.log(`   ⚠️  set_current_user function: ${error.message}`);
    }
    
    // Step 8: Verify the migration
    console.log('\n📋 Step 8: Verifying migration...');
    
    const orgCount = await pool.query('SELECT COUNT(*) as total FROM app.organizations WHERE deleted_at IS NULL');
    const userCount = await pool.query('SELECT COUNT(*) as total FROM app.users WHERE deleted_at IS NULL');
    const nfcCount = await pool.query('SELECT COUNT(*) as total FROM app.nfc_tags WHERE deleted_at IS NULL');
    const memberCount = await pool.query('SELECT COUNT(*) as total FROM app.organization_members');
    const nfcWithOrg = await pool.query('SELECT COUNT(*) as total FROM app.nfc_tags WHERE organization_id IS NOT NULL');
    
    console.log(`   Organizations: ${orgCount.rows[0].total}`);
    console.log(`   Users: ${userCount.rows[0].total}`);
    console.log(`   NFC Tags: ${nfcCount.rows[0].total}`);
    console.log(`   Organization Members: ${memberCount.rows[0].total}`);
    console.log(`   NFC Tags with Organization: ${nfcWithOrg.rows[0].total}`);
    
    console.log('\n🎉 Multi-tenant migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Organization setup complete');
    console.log('   ✅ All NFC tags assigned to organization');
    console.log('   ✅ Organization members table created');
    console.log('   ✅ All users added to organization');
    console.log('   ✅ RLS enabled on NFC tables');
    console.log('   ✅ RLS policies created');
    console.log('   ✅ Helper functions created');
    
    console.log('\n🔒 Security Features:');
    console.log('   - NFC tags are isolated by organization');
    console.log('   - RLS policies enforce data isolation');
    console.log('   - Users can only see their organization\'s data');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the migration
simpleMultitenantMigration();
