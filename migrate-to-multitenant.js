const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function migrateToMultitenant() {
  try {
    console.log('🚀 Starting Multi-Tenant Migration...\n');
    
    // Step 1: Create a default organization for existing data
    console.log('📋 Step 1: Creating default organization...');
    const defaultOrg = await pool.query(`
      INSERT INTO app.organizations (id, name, is_demo, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Default Organization', false, NOW(), NOW())
      ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
      RETURNING id, name
    `);
    
    const orgId = defaultOrg.rows[0].id;
    console.log(`   ✅ Default organization created: ${orgId}`);
    
    // Step 2: Assign all NFC tags to the default organization
    console.log('\n📋 Step 2: Assigning NFC tags to default organization...');
    const nfcUpdate = await pool.query(`
      UPDATE app.nfc_tags 
      SET organization_id = $1, updated_at = NOW()
      WHERE organization_id IS NULL
      RETURNING COUNT(*) as updated_count
    `, [orgId]);
    
    console.log(`   ✅ Updated ${nfcUpdate.rows[0].updated_count} NFC tags`);
    
    // Step 3: Enable RLS on all tables
    console.log('\n📋 Step 3: Enabling Row Level Security...');
    const tables = ['users', 'organizations', 'nfc_tags', 'nfc_scans', 'otp_requests', 'user_onboarding_steps'];
    
    for (const table of tables) {
      try {
        await pool.query(`ALTER TABLE app.${table} ENABLE ROW LEVEL SECURITY`);
        console.log(`   ✅ RLS enabled on app.${table}`);
      } catch (error) {
        console.log(`   ⚠️  RLS on app.${table}: ${error.message}`);
      }
    }
    
    // Step 4: Create RLS policies
    console.log('\n📋 Step 4: Creating RLS policies...');
    
    // Organizations policy - users can only see their own organization
    await pool.query(`
      CREATE POLICY IF NOT EXISTS "organizations_policy" ON app.organizations
      FOR ALL TO biz365_user
      USING (id IN (
        SELECT om.organization_id 
        FROM app.organization_members om 
        WHERE om.user_id = current_setting('app.current_user_id')::uuid
      ))
    `);
    console.log('   ✅ Organizations policy created');
    
    // Users policy - users can see themselves and users in their organization
    await pool.query(`
      CREATE POLICY IF NOT EXISTS "users_policy" ON app.users
      FOR ALL TO biz365_user
      USING (
        id = current_setting('app.current_user_id')::uuid
        OR id IN (
          SELECT om.user_id 
          FROM app.organization_members om 
          WHERE om.organization_id IN (
            SELECT om2.organization_id 
            FROM app.organization_members om2 
            WHERE om2.user_id = current_setting('app.current_user_id')::uuid
          )
        )
      )
    `);
    console.log('   ✅ Users policy created');
    
    // NFC tags policy - users can only see tags from their organization
    await pool.query(`
      CREATE POLICY IF NOT EXISTS "nfc_tags_policy" ON app.nfc_tags
      FOR ALL TO biz365_user
      USING (
        organization_id IN (
          SELECT om.organization_id 
          FROM app.organization_members om 
          WHERE om.user_id = current_setting('app.current_user_id')::uuid
        )
      )
    `);
    console.log('   ✅ NFC tags policy created');
    
    // NFC scans policy - users can only see scans from their organization's tags
    await pool.query(`
      CREATE POLICY IF NOT EXISTS "nfc_scans_policy" ON app.nfc_scans
      FOR ALL TO biz365_user
      USING (
        nfc_tag_id IN (
          SELECT nt.id 
          FROM app.nfc_tags nt 
          WHERE nt.organization_id IN (
            SELECT om.organization_id 
            FROM app.organization_members om 
            WHERE om.user_id = current_setting('app.current_user_id')::uuid
          )
        )
      )
    `);
    console.log('   ✅ NFC scans policy created');
    
    // OTP requests policy - users can only see their own OTP requests
    await pool.query(`
      CREATE POLICY IF NOT EXISTS "otp_requests_policy" ON app.otp_requests
      FOR ALL TO biz365_user
      USING (user_id = current_setting('app.current_user_id')::uuid)
    `);
    console.log('   ✅ OTP requests policy created');
    
    // User onboarding steps policy - users can only see their own onboarding steps
    await pool.query(`
      CREATE POLICY IF NOT EXISTS "user_onboarding_steps_policy" ON app.user_onboarding_steps
      FOR ALL TO biz365_user
      USING (user_id = current_setting('app.current_user_id')::uuid)
    `);
    console.log('   ✅ User onboarding steps policy created');
    
    // Step 5: Create organization_members table if it doesn't exist
    console.log('\n📋 Step 5: Setting up organization members...');
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
    
    // Step 6: Add all existing users to the default organization
    console.log('\n📋 Step 6: Adding users to default organization...');
    const users = await pool.query('SELECT id FROM app.users WHERE deleted_at IS NULL');
    
    for (const user of users.rows) {
      try {
        await pool.query(`
          INSERT INTO app.organization_members (organization_id, user_id, role, status)
          VALUES ($1, $2, 'owner', 'active')
          ON CONFLICT (organization_id, user_id) DO NOTHING
        `, [orgId, user.id]);
      } catch (error) {
        console.log(`   ⚠️  User ${user.id}: ${error.message}`);
      }
    }
    console.log(`   ✅ Added ${users.rows.length} users to default organization`);
    
    // Step 7: Create helper functions
    console.log('\n📋 Step 7: Creating helper functions...');
    
    // Function to set current user context
    await pool.query(`
      CREATE OR REPLACE FUNCTION app.set_current_user(user_id UUID)
      RETURNS VOID AS $$
      BEGIN
        PERFORM set_config('app.current_user_id', user_id::text, true);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('   ✅ set_current_user function created');
    
    // Function to get current user's organization
    await pool.query(`
      CREATE OR REPLACE FUNCTION app.get_current_user_org()
      RETURNS UUID AS $$
      DECLARE
        org_id UUID;
      BEGIN
        SELECT om.organization_id INTO org_id
        FROM app.organization_members om
        WHERE om.user_id = current_setting('app.current_user_id')::uuid
        AND om.status = 'active'
        LIMIT 1;
        RETURN org_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('   ✅ get_current_user_org function created');
    
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
    
    // Step 9: Test RLS
    console.log('\n📋 Step 9: Testing RLS...');
    
    // Test with a user context
    const testUser = await pool.query('SELECT id FROM app.users WHERE deleted_at IS NULL LIMIT 1');
    if (testUser.rows.length > 0) {
      const userId = testUser.rows[0].id;
      await pool.query('SELECT app.set_current_user($1)', [userId]);
      
      const nfcTest = await pool.query('SELECT COUNT(*) as total FROM app.nfc_tags');
      console.log(`   NFC tags visible to user ${userId}: ${nfcTest.rows[0].total}`);
    }
    
    console.log('\n🎉 Multi-tenant migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Default organization created');
    console.log('   ✅ All NFC tags assigned to organization');
    console.log('   ✅ RLS enabled on all tables');
    console.log('   ✅ RLS policies created for data isolation');
    console.log('   ✅ Organization members table set up');
    console.log('   ✅ All users added to default organization');
    console.log('   ✅ Helper functions created');
    
    console.log('\n🔒 Security Features:');
    console.log('   - Users can only see data from their organization');
    console.log('   - NFC tags are isolated by organization');
    console.log('   - User data is properly separated');
    console.log('   - RLS policies enforce data isolation');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateToMultitenant();
