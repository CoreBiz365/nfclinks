const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function debugNfcRedirect() {
  try {
    console.log('🔍 Debugging NFC Redirect Issue...\n');
    
    // Test 1: Check database connection
    console.log('📋 1. Testing database connection...');
    const connectionTest = await pool.query('SELECT NOW() as current_time');
    console.log(`   ✅ Database connected at: ${connectionTest.rows[0].current_time}`);
    
    // Test 2: Check if nfc_tags table exists
    console.log('\n📋 2. Checking nfc_tags table...');
    const tableCheck = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'nfc_tags'
      ORDER BY ordinal_position
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('   ❌ nfc_tags table not found!');
      return;
    }
    
    console.log('   ✅ nfc_tags table found with columns:');
    tableCheck.rows.forEach(col => {
      console.log(`      - ${col.column_name}: ${col.data_type}`);
    });
    
    // Test 3: Check for the specific UID that's failing
    console.log('\n📋 3. Testing specific UID: BZPGUH6H');
    const specificTag = await pool.query(`
      SELECT id, uid, bizcode, title, click_count, active_target_url, source_target_url, is_active, deleted_at
      FROM app.nfc_tags 
      WHERE uid = $1
    `, ['BZPGUH6H']);
    
    if (specificTag.rows.length === 0) {
      console.log('   ❌ UID BZPGUH6H not found in database');
      
      // Check if it exists with different case or similar
      const similarTags = await pool.query(`
        SELECT uid, bizcode FROM app.nfc_tags 
        WHERE uid ILIKE '%BZPGUH6H%' OR bizcode ILIKE '%BZPGUH6H%'
        LIMIT 5
      `);
      
      if (similarTags.rows.length > 0) {
        console.log('   🔍 Similar tags found:');
        similarTags.rows.forEach(tag => {
          console.log(`      - UID: ${tag.uid}, BizCode: ${tag.bizcode}`);
        });
      }
    } else {
      const tag = specificTag.rows[0];
      console.log('   ✅ Tag found:');
      console.log(`      - ID: ${tag.id}`);
      console.log(`      - UID: ${tag.uid}`);
      console.log(`      - BizCode: ${tag.bizcode}`);
      console.log(`      - Title: ${tag.title || 'No title'}`);
      console.log(`      - Active URL: ${tag.active_target_url || 'NULL'}`);
      console.log(`      - Source URL: ${tag.source_target_url || 'NULL'}`);
      console.log(`      - Is Active: ${tag.is_active}`);
      console.log(`      - Deleted At: ${tag.deleted_at || 'NULL'}`);
    }
    
    // Test 4: Check total tags count
    console.log('\n📋 4. Checking total tags count...');
    const countResult = await pool.query('SELECT COUNT(*) as total FROM app.nfc_tags WHERE deleted_at IS NULL');
    console.log(`   Total active tags: ${countResult.rows[0].total}`);
    
    // Test 5: Check a few sample tags
    console.log('\n📋 5. Sample tags from database:');
    const sampleTags = await pool.query(`
      SELECT uid, bizcode, active_target_url, is_active 
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    sampleTags.rows.forEach((tag, index) => {
      console.log(`   ${index + 1}. UID: ${tag.uid}, BizCode: ${tag.bizcode}, Active: ${tag.is_active}, URL: ${tag.active_target_url || 'NULL'}`);
    });
    
    // Test 6: Simulate the exact query from server.js
    console.log('\n📋 6. Testing exact server query...');
    try {
      const serverQuery = await pool.query(`
        SELECT id, uid, bizcode, title, click_count, active_target_url, source_target_url
        FROM app.nfc_tags 
        WHERE uid = $1 AND deleted_at IS NULL
      `, ['BZPGUH6H']);
      
      console.log(`   Query result: ${serverQuery.rows.length} rows`);
      if (serverQuery.rows.length > 0) {
        console.log('   ✅ Query successful, tag found');
      } else {
        console.log('   ❌ Query successful but no tag found (might be deleted or inactive)');
      }
    } catch (queryError) {
      console.log(`   ❌ Query failed: ${queryError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugNfcRedirect();
