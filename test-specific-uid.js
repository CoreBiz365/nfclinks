const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function testSpecificUid() {
  try {
    console.log('🧪 Testing specific UID: BZPGUH6H\n');
    
    // Test 1: Check if UID exists
    console.log('📋 1. Checking if UID exists...');
    const uidCheck = await pool.query(`
      SELECT id, uid, bizcode, title, active_target_url, target_url, is_active, deleted_at
      FROM app.nfc_tags 
      WHERE uid = $1
    `, ['BZPGUH6H']);
    
    if (uidCheck.rows.length === 0) {
      console.log('   ❌ UID BZPGUH6H not found');
      
      // Check if it exists with different case
      const caseCheck = await pool.query(`
        SELECT uid, bizcode FROM app.nfc_tags 
        WHERE uid ILIKE '%BZPGUH6H%'
      `);
      
      if (caseCheck.rows.length > 0) {
        console.log('   🔍 Found with different case:');
        caseCheck.rows.forEach(row => {
          console.log(`      - UID: ${row.uid}, BizCode: ${row.bizcode}`);
        });
      }
      
      // Check if it exists as bizcode
      const bizcodeCheck = await pool.query(`
        SELECT uid, bizcode FROM app.nfc_tags 
        WHERE bizcode = $1
      `, ['BZPGUH6H']);
      
      if (bizcodeCheck.rows.length > 0) {
        console.log('   🔍 Found as bizcode:');
        bizcodeCheck.rows.forEach(row => {
          console.log(`      - UID: ${row.uid}, BizCode: ${row.bizcode}`);
        });
      }
      
      return;
    }
    
    const tag = uidCheck.rows[0];
    console.log('   ✅ UID found:');
    console.log(`      - ID: ${tag.id}`);
    console.log(`      - UID: ${tag.uid}`);
    console.log(`      - BizCode: ${tag.bizcode}`);
    console.log(`      - Title: ${tag.title || 'No title'}`);
    console.log(`      - Active URL: ${tag.active_target_url || 'NULL'}`);
      console.log(`      - Target URL: ${tag.target_url || 'NULL'}`);
    console.log(`      - Is Active: ${tag.is_active}`);
    console.log(`      - Deleted At: ${tag.deleted_at || 'NULL'}`);
    
    // Test 2: Check if it would be found by the server query
    console.log('\n📋 2. Testing server query...');
    const serverQuery = await pool.query(`
      SELECT id, uid, bizcode, title, click_count, active_target_url, target_url
      FROM app.nfc_tags 
      WHERE uid = $1 AND deleted_at IS NULL
    `, ['BZPGUH6H']);
    
    if (serverQuery.rows.length === 0) {
      console.log('   ❌ Server query would not find this tag');
      if (tag.deleted_at) {
        console.log(`      - Reason: Tag is deleted (deleted_at: ${tag.deleted_at})`);
      }
      if (!tag.is_active) {
        console.log(`      - Reason: Tag is inactive (is_active: ${tag.is_active})`);
      }
    } else {
      console.log('   ✅ Server query would find this tag');
      
      // Test 3: Simulate redirect
      console.log('\n📋 3. Simulating redirect...');
      const nfcTag = serverQuery.rows[0];
      
      let baseRedirectUrl;
      let redirectType;
      
      if (nfcTag.active_target_url && nfcTag.active_target_url.trim() !== '') {
        baseRedirectUrl = nfcTag.active_target_url;
        redirectType = 'custom_url';
      } else {
        baseRedirectUrl = 'https://app.biz365.ai/signup';
        redirectType = 'signup_page';
      }
      
      // Build redirect URL with tracking parameters
      let redirectUrl = baseRedirectUrl;
      const urlParams = new URLSearchParams();
      urlParams.append('bizcode', nfcTag.bizcode);
      urlParams.append('nfc_uid', nfcTag.uid);
      urlParams.append('utm_source', 'nfc');
      urlParams.append('utm_medium', 'physical');
      
      redirectUrl += '?' + urlParams.toString();
      
      console.log(`   Redirect Type: ${redirectType}`);
      console.log(`   Base URL: ${baseRedirectUrl}`);
      console.log(`   Final URL: ${redirectUrl}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testSpecificUid();
