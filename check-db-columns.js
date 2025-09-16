/**
 * Check database columns for nfc_tags table
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function checkColumns() {
  try {
    console.log('🔍 Checking nfc_tags table columns...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'nfc_tags'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in app.nfc_tags:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n✅ Column check complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
