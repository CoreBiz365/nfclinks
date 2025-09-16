/**
 * Count BizTag Links Available for Custom Redirection
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function countBizTagLinks() {
  try {
    console.log('🏷️ BizTag Links Count Analysis\n');
    console.log('='.repeat(50));
    
    // 1. Count CSV file entries
    const csvPath = path.join(__dirname, '..', 'BizTag NFC Links.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const csvLines = csvContent.split('\n').filter(line => line.trim() !== '');
    const csvDataLines = csvLines.slice(1); // Exclude header
    
    console.log('📄 CSV File Analysis:');
    console.log(`   Total Lines: ${csvLines.length}`);
    console.log(`   Data Entries: ${csvDataLines.length}`);
    console.log(`   Header: ${csvLines[0]}`);
    console.log('');
    
    // 2. Count database entries
    const dbResult = await pool.query(`
      SELECT 
        COUNT(*) as total_tags,
        COUNT(CASE WHEN active_target_url IS NOT NULL THEN 1 END) as custom_redirects,
        COUNT(CASE WHEN active_target_url IS NULL THEN 1 END) as default_redirects,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_tags,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_tags
      FROM app.nfc_tags
    `);
    
    const stats = dbResult.rows[0];
    
    console.log('🗄️ Database Analysis:');
    console.log(`   Total Tags in DB: ${stats.total_tags}`);
    console.log(`   Active Tags: ${stats.active_tags}`);
    console.log(`   Deleted Tags: ${stats.deleted_tags}`);
    console.log(`   Custom Redirects: ${stats.custom_redirects}`);
    console.log(`   Default Redirects: ${stats.default_redirects}`);
    console.log('');
    
    // 3. Check for tags with click counts
    const clickStats = await pool.query(`
      SELECT 
        COUNT(CASE WHEN click_count > 0 THEN 1 END) as tags_with_clicks,
        SUM(click_count) as total_clicks,
        MAX(click_count) as max_clicks,
        AVG(click_count) as avg_clicks
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL
    `);
    
    const clickData = clickStats.rows[0];
    
    console.log('📊 Click Statistics:');
    console.log(`   Tags with Clicks: ${clickData.tags_with_clicks}`);
    console.log(`   Total Clicks: ${clickData.total_clicks}`);
    console.log(`   Max Clicks: ${clickData.max_clicks}`);
    console.log(`   Average Clicks: ${Math.round(clickData.avg_clicks || 0)}`);
    console.log('');
    
    // 4. Show top performing tags
    const topTags = await pool.query(`
      SELECT bizcode, title, click_count, active_target_url
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL AND click_count > 0
      ORDER BY click_count DESC
      LIMIT 10
    `);
    
    console.log('🏆 Top Performing BizTags:');
    topTags.rows.forEach((tag, index) => {
      const redirect = tag.active_target_url || 'Default (signup)';
      console.log(`   ${index + 1}. ${tag.bizcode} - ${tag.click_count} clicks - ${redirect}`);
    });
    console.log('');
    
    // 5. Show available for custom redirect
    const availableForCustom = await pool.query(`
      SELECT COUNT(*) as available_count
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL AND active_target_url IS NULL
    `);
    
    console.log('🎯 Available for Custom Redirection:');
    console.log(`   Tags Available: ${availableForCustom.rows[0].available_count}`);
    console.log(`   Percentage: ${((availableForCustom.rows[0].available_count / stats.active_tags) * 100).toFixed(1)}%`);
    console.log('');
    
    // 6. Show tags with custom redirects
    const customRedirects = await pool.query(`
      SELECT bizcode, active_target_url, click_count
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL AND active_target_url IS NOT NULL
      ORDER BY click_count DESC
    `);
    
    console.log('🔗 Current Custom Redirects:');
    if (customRedirects.rows.length > 0) {
      customRedirects.rows.forEach((tag, index) => {
        console.log(`   ${index + 1}. ${tag.bizcode} → ${tag.active_target_url} (${tag.click_count} clicks)`);
      });
    } else {
      console.log('   No custom redirects currently set');
    }
    console.log('');
    
    // 7. Summary
    console.log('📋 SUMMARY:');
    console.log(`   ✅ Total BizTags Available: ${stats.active_tags}`);
    console.log(`   ✅ Available for Custom Redirect: ${availableForCustom.rows[0].available_count}`);
    console.log(`   ✅ Currently Using Custom Redirect: ${stats.custom_redirects}`);
    console.log(`   ✅ Using Default Redirect: ${stats.default_redirects}`);
    console.log('');
    
    console.log('🎉 You can set custom redirection for ALL ' + stats.active_tags + ' BizTags!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

countBizTagLinks();
