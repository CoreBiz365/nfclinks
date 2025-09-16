/**
 * Check Current Database Schema
 * Verify what columns already exist in nfc_tags and users tables
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function checkCurrentSchema() {
  try {
    console.log('🔍 Checking Current Database Schema\n');
    console.log('='.repeat(60));
    
    // Check nfc_tags table structure
    console.log('1️⃣ NFC_TAGS Table Structure:');
    const nfcColumns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
        AND table_name = 'nfc_tags'
      ORDER BY ordinal_position
    `);
    
    console.log(`   Found ${nfcColumns.rows.length} columns:`);
    nfcColumns.rows.forEach(col => {
      console.log(`   ✅ ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check users table structure
    console.log('\n2️⃣ USERS Table Structure:');
    const userColumns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
        AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log(`   Found ${userColumns.rows.length} columns:`);
    userColumns.rows.forEach(col => {
      console.log(`   ✅ ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check existing constraints
    console.log('\n3️⃣ Existing Foreign Key Constraints:');
    const constraints = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'app'
        AND (tc.table_name = 'nfc_tags' OR tc.table_name = 'users')
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    if (constraints.rows.length > 0) {
      console.log(`   Found ${constraints.rows.length} foreign key constraints:`);
      constraints.rows.forEach(constraint => {
        console.log(`   ✅ ${constraint.table_name}.${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
      });
    } else {
      console.log('   ❌ No foreign key constraints found');
    }
    
    // Check existing indexes
    console.log('\n4️⃣ Existing Indexes:');
    const indexes = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'app'
        AND (tablename = 'nfc_tags' OR tablename = 'users')
      ORDER BY tablename, indexname
    `);
    
    if (indexes.rows.length > 0) {
      console.log(`   Found ${indexes.rows.length} indexes:`);
      indexes.rows.forEach(index => {
        console.log(`   ✅ ${index.tablename}.${index.indexname}`);
      });
    } else {
      console.log('   ❌ No indexes found');
    }
    
    // Summary
    console.log('\n📊 SCHEMA ANALYSIS SUMMARY:');
    
    const hasUserId = nfcColumns.rows.some(col => col.column_name === 'user_id');
    const hasCreatedBy = nfcColumns.rows.some(col => col.column_name === 'created_by');
    const hasOrgId = userColumns.rows.some(col => col.column_name === 'organization_id');
    
    console.log(`   NFC_TAGS.user_id: ${hasUserId ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   NFC_TAGS.created_by: ${hasCreatedBy ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   USERS.organization_id: ${hasOrgId ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (hasUserId && hasCreatedBy && hasOrgId) {
      console.log('\n🎉 ALL REQUIRED COLUMNS EXIST!');
      console.log('   You can now add the foreign key constraints.');
    } else {
      console.log('\n⚠️  Some columns are missing. Need to add them first.');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    await pool.end();
  }
}

checkCurrentSchema();
