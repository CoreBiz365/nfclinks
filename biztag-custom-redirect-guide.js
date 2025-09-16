/**
 * BizTag Custom Redirect Guide
 * Shows how to set custom redirects using 8-digit codes
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function demonstrateCustomRedirects() {
  try {
    console.log('🏷️ BizTag Custom Redirect Guide\n');
    console.log('='.repeat(60));
    
    // Test the specific BizTags you mentioned
    const testBizTags = [
      { position: 100, bizcode: 'BZNNEVQW' },
      { position: 200, bizcode: 'BZ8X7789' },
      { position: 250, bizcode: 'BZEYJUNK' },
      { position: 350, bizcode: 'BZGZHKN2' },
      { position: 450, bizcode: 'BZQ86B8K' },
      { position: 475, bizcode: 'BZ5FBV35' },
      { position: 500, bizcode: 'BZPCQS7F' },
      { position: 499, bizcode: 'BZ82UTDB' },
      { position: 488, bizcode: 'BZSAW6SA' },
      { position: 399, bizcode: 'BZVVPNWS' },
      { position: 2, bizcode: 'BZR7VDQF' }
    ];
    
    console.log('📋 Testing Specific BizTag Positions:\n');
    
    for (const biztag of testBizTags) {
      const result = await pool.query(`
        SELECT id, uid, bizcode, title, active_target_url, target_url, click_count
        FROM app.nfc_tags 
        WHERE bizcode = $1 AND deleted_at IS NULL
      `, [biztag.bizcode]);
      
      if (result.rows.length > 0) {
        const tag = result.rows[0];
        const currentRedirect = tag.active_target_url || 'https://app.biz365.ai/signup (default)';
        console.log(`Position ${biztag.position}: ${biztag.bizcode}`);
        console.log(`   Current Redirect: ${currentRedirect}`);
        console.log(`   Click Count: ${tag.click_count || 0}`);
        console.log('');
      } else {
        console.log(`Position ${biztag.position}: ${biztag.bizcode} - NOT FOUND`);
        console.log('');
      }
    }
    
    console.log('🔧 How to Set Custom Redirects:\n');
    console.log('1. Using API Endpoint (Recommended):');
    console.log('   PUT https://api.biz365.ai/nfc/tags/{bizcode}/redirect');
    console.log('   Body: { "target_url": "https://your-custom-url.com" }');
    console.log('');
    
    console.log('2. Using Database Directly:');
    console.log('   UPDATE app.nfc_tags SET active_target_url = $1 WHERE bizcode = $2');
    console.log('');
    
    console.log('3. Example Custom Redirects:');
    console.log('   - Product Page: https://yoursite.com/product/123');
    console.log('   - Contact Form: https://yoursite.com/contact');
    console.log('   - WhatsApp: https://wa.me/1234567890');
    console.log('   - Phone Call: tel:+1234567890');
    console.log('   - Email: mailto:info@yoursite.com');
    console.log('   - App Store: https://apps.apple.com/app/yourapp');
    console.log('   - Google Play: https://play.google.com/store/apps/details?id=com.yourapp');
    console.log('');
    
    // Demonstrate setting a custom redirect
    console.log('🎯 Setting Custom Redirect Example:\n');
    
    const exampleBizcode = 'BZNNEVQW'; // Position 100
    const customUrl = 'https://example.com/special-offer';
    
    console.log(`Setting custom redirect for ${exampleBizcode}:`);
    console.log(`From: https://app.biz365.ai/signup (default)`);
    console.log(`To: ${customUrl}`);
    console.log('');
    
    // Update the database
    await pool.query(`
      UPDATE app.nfc_tags 
      SET active_target_url = $1, updated_at = NOW()
      WHERE bizcode = $2 AND deleted_at IS NULL
    `, [customUrl, exampleBizcode]);
    
    console.log('✅ Custom redirect set successfully!');
    console.log('');
    
    // Verify the change
    const verifyResult = await pool.query(`
      SELECT bizcode, active_target_url
      FROM app.nfc_tags 
      WHERE bizcode = $1 AND deleted_at IS NULL
    `, [exampleBizcode]);
    
    if (verifyResult.rows.length > 0) {
      const tag = verifyResult.rows[0];
      console.log(`Verification: ${tag.bizcode} now redirects to ${tag.active_target_url}`);
    }
    
    console.log('');
    console.log('📱 Testing the Custom Redirect:');
    console.log(`Visit: https://get.biz365.ai/q/${exampleBizcode}`);
    console.log(`Should redirect to: ${customUrl}`);
    console.log('');
    
    console.log('🔄 Resetting to Default:');
    console.log('To reset a BizTag to default redirect:');
    console.log('   PUT https://api.biz365.ai/nfc/tags/{bizcode}/redirect');
    console.log('   Body: { "target_url": null }');
    console.log('');
    
    // Reset the example back to default
    await pool.query(`
      UPDATE app.nfc_tags 
      SET active_target_url = NULL, updated_at = NOW()
      WHERE bizcode = $1 AND deleted_at IS NULL
    `, [exampleBizcode]);
    
    console.log(`✅ Reset ${exampleBizcode} back to default redirect`);
    console.log('');
    
    console.log('📊 API Endpoints Summary:');
    console.log('   GET    /nfc/tags/{bizcode}           - Get BizTag details');
    console.log('   PUT    /nfc/tags/{bizcode}/redirect  - Set custom redirect');
    console.log('   DELETE /nfc/tags/{bizcode}/redirect  - Reset to default');
    console.log('');
    
    console.log('🔐 Authentication Required:');
    console.log('   All API endpoints require JWT authentication');
    console.log('   Include Authorization header: Bearer {your-jwt-token}');
    console.log('');
    
    console.log('✅ BizTag Custom Redirect System Ready!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

demonstrateCustomRedirects();
