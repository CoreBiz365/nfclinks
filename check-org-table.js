const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function checkOrgTable() {
  try {
    console.log('🔍 Checking Organizations Table...\n');
    
    // Check table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'organizations'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Organizations table columns:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check constraints
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type, column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'app' AND tc.table_name = 'organizations'
    `);
    
    console.log('\n📋 Constraints:');
    constraints.rows.forEach(constraint => {
      console.log(`   - ${constraint.constraint_name}: ${constraint.constraint_type} on ${constraint.column_name}`);
    });
    
    // Check existing data
    const existing = await pool.query('SELECT * FROM app.organizations');
    console.log('\n📋 Existing organizations:');
    existing.rows.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} (ID: ${org.id})`);
    });
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkOrgTable();
