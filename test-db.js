const { Pool } = require('pg');
require('dotenv').config();

console.log('Testing database connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL || 'Using default');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function testConnection() {
  try {
    console.log('🔄 Attempting database connection...');
    const result = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful:', result.rows[0]);
    
    // Test NFC tags query
    const nfcResult = await pool.query(`
      SELECT id, uid, bizcode, title, is_active
      FROM app.nfc_tags 
      WHERE uid = $1 AND deleted_at IS NULL
    `, ['BZZH7BUD']);
    
    console.log('📊 NFC tag query result:', nfcResult.rows);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
