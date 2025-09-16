/**
 * Check User Linking in nfc_tags Table
 * Verifies if BizTags are linked to specific users
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function checkUserLinking() {
  try {
    console.log('👤 Checking User Linking in nfc_tags Table\n');
    console.log('='.repeat(60));
    
    // 1. Check table structure for user-related columns
    console.log('1️⃣ Checking Table Structure...');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'nfc_tags'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in app.nfc_tags:');
    const userRelatedColumns = [];
    columnsResult.rows.forEach(col => {
      const isUserRelated = col.column_name.includes('user') || 
                           col.column_name.includes('owner') || 
                           col.column_name.includes('created_by') ||
                           col.column_name.includes('organization');
      if (isUserRelated) {
        userRelatedColumns.push(col);
      }
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${isUserRelated ? '👤' : ''}`);
    });
    
    console.log(`\n   Found ${userRelatedColumns.length} user-related columns:`);
    userRelatedColumns.forEach(col => {
      console.log(`   👤 ${col.column_name} (${col.data_type})`);
    });
    
    // 2. Check if organization_id is used for user linking
    console.log('\n2️⃣ Checking Organization-based User Linking...');
    const orgResult = await pool.query(`
      SELECT 
        COUNT(*) as total_tags,
        COUNT(organization_id) as tags_with_org,
        COUNT(*) - COUNT(organization_id) as tags_without_org
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL
    `);
    
    const orgStats = orgResult.rows[0];
    console.log(`   Total BizTags: ${orgStats.total_tags}`);
    console.log(`   With Organization: ${orgStats.tags_with_org}`);
    console.log(`   Without Organization: ${orgStats.tags_without_org}`);
    
    // 3. Check organization distribution
    console.log('\n3️⃣ Checking Organization Distribution...');
    const orgDistResult = await pool.query(`
      SELECT 
        organization_id,
        COUNT(*) as tag_count
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL
      GROUP BY organization_id
      ORDER BY tag_count DESC
      LIMIT 10
    `);
    
    console.log('   Organization distribution:');
    orgDistResult.rows.forEach((row, index) => {
      const orgId = row.organization_id || 'NULL (No Organization)';
      console.log(`   ${index + 1}. ${orgId}: ${row.tag_count} BizTags`);
    });
    
    // 4. Check if there are any user-specific tables
    console.log('\n4️⃣ Checking for User-related Tables...');
    const userTablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'app' 
        AND (table_name LIKE '%user%' OR table_name LIKE '%owner%' OR table_name LIKE '%customer%')
      ORDER BY table_name
    `);
    
    console.log('   User-related tables:');
    if (userTablesResult.rows.length > 0) {
      userTablesResult.rows.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    } else {
      console.log('   No user-related tables found');
    }
    
    // 5. Check users table structure
    console.log('\n5️⃣ Checking Users Table...');
    const usersColumnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    if (usersColumnsResult.rows.length > 0) {
      console.log('   Users table columns:');
      usersColumnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   Users table not found');
    }
    
    // 6. Check if there's a way to link users to BizTags
    console.log('\n6️⃣ Checking User-BizTag Linking Methods...');
    
    // Check if there's a user_id column
    const hasUserId = columnsResult.rows.some(col => col.column_name === 'user_id');
    console.log(`   Has user_id column: ${hasUserId ? '✅ Yes' : '❌ No'}`);
    
    // Check if there's a created_by column
    const hasCreatedBy = columnsResult.rows.some(col => col.column_name === 'created_by');
    console.log(`   Has created_by column: ${hasCreatedBy ? '✅ Yes' : '❌ No'}`);
    
    // Check if there's an owner_id column
    const hasOwnerId = columnsResult.rows.some(col => col.column_name === 'owner_id');
    console.log(`   Has owner_id column: ${hasOwnerId ? '✅ Yes' : '❌ No'}`);
    
    // Check organization_id usage
    const hasOrgId = columnsResult.rows.some(col => col.column_name === 'organization_id');
    console.log(`   Has organization_id column: ${hasOrgId ? '✅ Yes' : '❌ No'}`);
    
    // 7. Sample data analysis
    console.log('\n7️⃣ Sample Data Analysis...');
    const sampleResult = await pool.query(`
      SELECT 
        bizcode,
        title,
        organization_id,
        created_at,
        updated_at
      FROM app.nfc_tags 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('   Sample BizTags:');
    sampleResult.rows.forEach((tag, index) => {
      console.log(`   ${index + 1}. ${tag.bizcode}`);
      console.log(`      Title: ${tag.title || 'Untitled'}`);
      console.log(`      Organization: ${tag.organization_id || 'NULL'}`);
      console.log(`      Created: ${tag.created_at}`);
      console.log(`      Updated: ${tag.updated_at}`);
      console.log('');
    });
    
    // 8. Summary and Recommendations
    console.log('📊 USER LINKING SUMMARY:');
    
    if (hasOrgId) {
      console.log('   ✅ Organization-based linking is available');
      console.log('   📝 BizTags can be linked to organizations');
      console.log('   🔗 Users can be linked through organization membership');
    } else {
      console.log('   ❌ No organization-based linking found');
    }
    
    if (hasUserId || hasCreatedBy || hasOwnerId) {
      console.log('   ✅ Direct user linking is available');
    } else {
      console.log('   ❌ No direct user linking found');
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (!hasUserId && !hasCreatedBy && !hasOwnerId) {
      console.log('   1. Add user_id column to nfc_tags table');
      console.log('   2. Link BizTags to specific users');
      console.log('   3. Implement user-specific BizTag management');
    }
    
    if (hasOrgId) {
      console.log('   4. Use organization_id for multi-tenant BizTag management');
      console.log('   5. Filter BizTags by user\'s organization');
    }
    
    console.log('\n🎯 CURRENT STATE:');
    if (orgStats.tags_with_org > 0) {
      console.log(`   ✅ ${orgStats.tags_with_org} BizTags are linked to organizations`);
      console.log(`   ⚠️  ${orgStats.tags_without_org} BizTags are not linked to any organization`);
    } else {
      console.log('   ❌ No BizTags are currently linked to users/organizations');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserLinking();
