const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function resetTagToDefault() {
  try {
    console.log('🔄 Resetting BizTag to default redirect...\n');
    
    const bizcode = 'BZPGUH6H';
    
    // Check current status
    console.log('📋 1. Checking current status...');
    const currentTag = await pool.query(`
      SELECT uid, bizcode, active_target_url, title
      FROM app.nfc_tags 
      WHERE bizcode = $1
    `, [bizcode]);
    
    if (currentTag.rows.length === 0) {
      console.log('   ❌ Tag not found');
      return;
    }
    
    const tag = currentTag.rows[0];
    console.log(`   Current redirect: ${tag.active_target_url || 'Default (signup page)'}`);
    console.log(`   Title: ${tag.title || 'No title'}`);
    
    // Reset to default (clear active_target_url)
    console.log('\n📋 2. Resetting to default redirect...');
    const resetResult = await pool.query(`
      UPDATE app.nfc_tags 
      SET 
        active_target_url = NULL,
        updated_at = NOW()
      WHERE bizcode = $1
      RETURNING uid, bizcode, active_target_url, title
    `, [bizcode]);
    
    if (resetResult.rows.length > 0) {
      const updatedTag = resetResult.rows[0];
      console.log('   ✅ Tag reset successfully!');
      console.log(`   New redirect: ${updatedTag.active_target_url || 'Default (signup page)'}`);
      console.log(`   Title: ${updatedTag.title || 'No title'}`);
      
      console.log('\n🎉 BizTag BZPGUH6H will now redirect to: https://app.biz365.ai/signup');
      console.log('   With tracking parameters: ?bizcode=BZPGUH6H&nfc_uid=BZPGUH6H&utm_source=nfc&utm_medium=physical');
    } else {
      console.log('   ❌ Failed to reset tag');
    }
    
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the reset
resetTagToDefault();
