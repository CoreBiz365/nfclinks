const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function checkMultitenant() {
  try {
    console.log('🔍 Checking Database Multitenancy...\n');
    
    // Test 1: Check database name and schema
    console.log('📋 1. Database Information:');
    const dbInfo = await pool.query(`
      SELECT 
        current_database() as database_name,
        current_schema() as current_schema,
        current_user as current_user,
        version() as postgres_version
    `);
    
    console.log(`   Database: ${dbInfo.rows[0].database_name}`);
    console.log(`   Schema: ${dbInfo.rows[0].current_schema}`);
    console.log(`   User: ${dbInfo.rows[0].current_user}`);
    console.log(`   PostgreSQL: ${dbInfo.rows[0].postgres_version.split(' ')[0]}`);
    
    // Test 2: Check if using schema-based multitenancy
    console.log('\n📋 2. Schema-based Multitenancy Check:');
    const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
      ORDER BY schema_name
    `);
    
    console.log(`   Total schemas: ${schemas.rows.length}`);
    schemas.rows.forEach((schema, index) => {
      console.log(`   ${index + 1}. ${schema.schema_name}`);
    });
    
    // Test 3: Check if app schema exists and has tables
    console.log('\n📋 3. App Schema Analysis:');
    const appTables = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'app'
      ORDER BY table_name
    `);
    
    if (appTables.rows.length > 0) {
      console.log(`   ✅ App schema exists with ${appTables.rows.length} tables:`);
      appTables.rows.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table_name} (${table.table_type})`);
      });
    } else {
      console.log('   ❌ App schema not found or empty');
    }
    
    // Test 4: Check for organization/user isolation
    console.log('\n📋 4. Data Isolation Analysis:');
    
    // Check users table structure
    const usersColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    if (usersColumns.rows.length > 0) {
      console.log('   Users table columns:');
      usersColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
    // Check organizations table
    const orgColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'organizations'
      ORDER BY ordinal_position
    `);
    
    if (orgColumns.rows.length > 0) {
      console.log('\n   Organizations table columns:');
      orgColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
    // Test 5: Check for organization_id in key tables
    console.log('\n📋 5. Organization Isolation Check:');
    const tablesWithOrgId = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
        AND column_name IN ('organization_id', 'org_id', 'user_id')
        AND table_name IN ('nfc_tags', 'users', 'organizations')
      ORDER BY table_name, column_name
    `);
    
    if (tablesWithOrgId.rows.length > 0) {
      console.log('   Tables with organization/user isolation:');
      tablesWithOrgId.rows.forEach(row => {
        console.log(`   - ${row.table_name}.${row.column_name}`);
      });
    } else {
      console.log('   ❌ No organization/user isolation found');
    }
    
    // Test 6: Check actual data distribution
    console.log('\n📋 6. Data Distribution Analysis:');
    
    // Check users count
    const userCount = await pool.query('SELECT COUNT(*) as total FROM app.users WHERE deleted_at IS NULL');
    console.log(`   Total users: ${userCount.rows[0].total}`);
    
    // Check organizations count
    const orgCount = await pool.query('SELECT COUNT(*) as total FROM app.organizations WHERE deleted_at IS NULL');
    console.log(`   Total organizations: ${orgCount.rows[0].total}`);
    
    // Check nfc_tags distribution
    const nfcCount = await pool.query('SELECT COUNT(*) as total FROM app.nfc_tags WHERE deleted_at IS NULL');
    console.log(`   Total NFC tags: ${nfcCount.rows[0].total}`);
    
    // Check if nfc_tags have organization_id
    const nfcWithOrg = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(organization_id) as with_org_id,
        COUNT(*) - COUNT(organization_id) as without_org_id
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL
    `);
    
    const nfcStats = nfcWithOrg.rows[0];
    console.log(`   NFC tags with organization_id: ${nfcStats.with_org_id}`);
    console.log(`   NFC tags without organization_id: ${nfcStats.without_org_id}`);
    
    // Test 7: Check for RLS (Row Level Security)
    console.log('\n📋 7. Row Level Security (RLS) Check:');
    const rlsTables = await pool.query(`
      SELECT schemaname, tablename, rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'app'
      ORDER BY tablename
    `);
    
    if (rlsTables.rows.length > 0) {
      console.log('   RLS status for app tables:');
      rlsTables.rows.forEach(table => {
        console.log(`   - ${table.tablename}: RLS ${table.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
      });
    }
    
    // Test 8: Multitenancy Assessment
    console.log('\n📋 8. Multitenancy Assessment:');
    
    const hasAppSchema = appTables.rows.length > 0;
    const hasOrgIsolation = tablesWithOrgId.rows.length > 0;
    const hasMultipleOrgs = parseInt(orgCount.rows[0].total) > 1;
    const hasRls = rlsTables.rows.some(t => t.rowsecurity);
    
    console.log(`   ✅ App schema exists: ${hasAppSchema}`);
    console.log(`   ✅ Organization isolation: ${hasOrgIsolation}`);
    console.log(`   ✅ Multiple organizations: ${hasMultipleOrgs}`);
    console.log(`   ✅ Row Level Security: ${hasRls}`);
    
    if (hasAppSchema && hasOrgIsolation) {
      console.log('\n🎯 CONCLUSION: This appears to be a MULTITENANT database');
      console.log('   - Uses schema-based isolation (app schema)');
      console.log('   - Has organization/user isolation columns');
      console.log('   - Data is separated by organization_id/user_id');
    } else if (hasAppSchema) {
      console.log('\n🎯 CONCLUSION: This appears to be a SINGLE-TENANT database');
      console.log('   - Uses app schema but no organization isolation');
      console.log('   - All data is shared across users');
    } else {
      console.log('\n🎯 CONCLUSION: Database structure unclear');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the check
checkMultitenant();
