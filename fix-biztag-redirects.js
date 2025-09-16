/**
 * Fix BizTag Redirect Loop Issue
 * Resets all BizTags to redirect to the signup page instead of themselves
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function fixBizTagRedirects() {
  try {
    console.log('🔧 Fixing BizTag Redirect Loop Issue...\n');
    
    // Check current problematic BizTags
    console.log('1️⃣ Checking problematic BizTags...');
    const problematicTags = await pool.query(`
      SELECT id, uid, bizcode, active_target_url, target_url
      FROM app.nfc_tags 
      WHERE active_target_url LIKE 'https://get.biz365.ai/%'
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${problematicTags.rows.length} problematic BizTags:`);
    problematicTags.rows.forEach(tag => {
      console.log(`   ${tag.bizcode}: ${tag.active_target_url}`);
    });
    console.log('');
    
    // Fix the redirect loop by setting active_target_url to NULL
    console.log('2️⃣ Fixing redirect loops...');
    const fixResult = await pool.query(`
      UPDATE app.nfc_tags 
      SET active_target_url = NULL,
          updated_at = NOW()
      WHERE active_target_url LIKE 'https://get.biz365.ai/%'
      AND deleted_at IS NULL
    `);
    
    console.log(`✅ Fixed ${fixResult.rowCount} BizTags`);
    console.log('');
    
    // Verify the fix
    console.log('3️⃣ Verifying fix...');
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN active_target_url IS NULL THEN 1 END) as null_urls,
             COUNT(CASE WHEN active_target_url LIKE 'https://get.biz365.ai/%' THEN 1 END) as problematic
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL
    `);
    
    const stats = verifyResult.rows[0];
    console.log(`Total BizTags: ${stats.total}`);
    console.log(`Fixed (NULL active_target_url): ${stats.null_urls}`);
    console.log(`Still problematic: ${stats.problematic}`);
    console.log('');
    
    // Test a few BizTags
    console.log('4️⃣ Testing fixed BizTags...');
    const testTags = await pool.query(`
      SELECT uid, bizcode, active_target_url, target_url
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL
      ORDER BY RANDOM()
      LIMIT 5
    `);
    
    console.log('Sample BizTags after fix:');
    testTags.rows.forEach(tag => {
      const redirectUrl = tag.active_target_url || 'https://app.biz365.ai/signup (default)';
      console.log(`   ${tag.bizcode}: ${redirectUrl}`);
    });
    console.log('');
    
    console.log('✅ BizTag redirect fix complete!');
    console.log('🎯 All BizTags will now redirect to the signup page by default');
    console.log('💡 You can set custom redirect URLs using the API endpoints');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await pool.end();
  }
}

fixBizTagRedirects();
