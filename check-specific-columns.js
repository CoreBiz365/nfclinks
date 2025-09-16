/**
 * Check Specific Columns in Database
 * Verify if user_id, created_by, and organization_id columns exist
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function checkSpecificColumns() {
  try {
    console.log('🔍 Checking Specific Columns in Database\n');
    console.log('='.repeat(60));
    
    // Check if user_id exists in nfc_tags
    console.log('1️⃣ Checking NFC_TAGS.user_id:');
    try {
      const userIdCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'app' 
          AND table_name = 'nfc_tags'
          AND column_name = 'user_id'
      `);
      
      if (userIdCheck.rows.length > 0) {
        console.log('   ✅ user_id EXISTS:', userIdCheck.rows[0]);
      } else {
        console.log('   ❌ user_id MISSING');
      }
    } catch (error) {
      console.log('   ❌ Error checking user_id:', error.message);
    }
    
    // Check if created_by exists in nfc_tags
    console.log('\n2️⃣ Checking NFC_TAGS.created_by:');
    try {
      const createdByCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'app' 
          AND table_name = 'nfc_tags'
          AND column_name = 'created_by'
      `);
      
      if (createdByCheck.rows.length > 0) {
        console.log('   ✅ created_by EXISTS:', createdByCheck.rows[0]);
      } else {
        console.log('   ❌ created_by MISSING');
      }
    } catch (error) {
      console.log('   ❌ Error checking created_by:', error.message);
    }
    
    // Check if organization_id exists in users
    console.log('\n3️⃣ Checking USERS.organization_id:');
    try {
      const orgIdCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'app' 
          AND table_name = 'users'
          AND column_name = 'organization_id'
      `);
      
      if (orgIdCheck.rows.length > 0) {
        console.log('   ✅ organization_id EXISTS:', orgIdCheck.rows[0]);
      } else {
        console.log('   ❌ organization_id MISSING');
      }
    } catch (error) {
      console.log('   ❌ Error checking organization_id:', error.message);
    }
    
    // Try to add user_id to see what happens
    console.log('\n4️⃣ Testing ALTER TABLE for user_id:');
    try {
      await pool.query(`
        ALTER TABLE app.nfc_tags ADD COLUMN user_id UUID NULL
      `);
      console.log('   ✅ user_id column added successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ✅ user_id already exists (as expected)');
      } else {
        console.log('   ❌ Error adding user_id:', error.message);
      }
    }
    
    // Try to add created_by
    console.log('\n5️⃣ Testing ALTER TABLE for created_by:');
    try {
      await pool.query(`
        ALTER TABLE app.nfc_tags ADD COLUMN created_by UUID NULL
      `);
      console.log('   ✅ created_by column added successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ✅ created_by already exists (as expected)');
      } else {
        console.log('   ❌ Error adding created_by:', error.message);
      }
    }
    
    // Try to add organization_id to users
    console.log('\n6️⃣ Testing ALTER TABLE for organization_id:');
    try {
      await pool.query(`
        ALTER TABLE app.users ADD COLUMN organization_id UUID NULL
      `);
      console.log('   ✅ organization_id column added successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ✅ organization_id already exists (as expected)');
      } else {
        console.log('   ❌ Error adding organization_id:', error.message);
      }
    }
    
    // Final check - get all columns again
    console.log('\n7️⃣ Final Column Check:');
    const finalCheck = await pool.query(`
      SELECT 
        'nfc_tags' as table_name,
        column_name,
        data_type
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
        AND table_name = 'nfc_tags'
        AND column_name IN ('user_id', 'created_by')
      
      UNION ALL
      
      SELECT 
        'users' as table_name,
        column_name,
        data_type
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
        AND table_name = 'users'
        AND column_name = 'organization_id'
      
      ORDER BY table_name, column_name
    `);
    
    console.log('   Current state:');
    finalCheck.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}.${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking columns:', error.message);
  } finally {
    await pool.end();
  }
}

checkSpecificColumns();
