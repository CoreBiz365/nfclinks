/**
 * Check User-Organization Linking
 * Verifies how users are linked to organizations and BizTags
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false
});

async function checkUserOrganizationLinking() {
  try {
    console.log('🔗 Checking User-Organization Linking\n');
    console.log('='.repeat(60));
    
    // 1. Check organizations table
    console.log('1️⃣ Checking Organizations Table...');
    const orgResult = await pool.query(`
      SELECT 
        id,
        name,
        created_at,
        updated_at
      FROM app.organizations 
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`   Found ${orgResult.rows.length} organizations:`);
    orgResult.rows.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.id}`);
      console.log(`      Name: ${org.name || 'Untitled'}`);
      console.log(`      Created: ${org.created_at}`);
      console.log('');
    });
    
    // 2. Check users table
    console.log('2️⃣ Checking Users Table...');
    const usersResult = await pool.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        created_at
      FROM app.users 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`   Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.id}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Name: ${user.first_name} ${user.last_name}`);
      console.log(`      Created: ${user.created_at}`);
      console.log('');
    });
    
    // 3. Check if there's a user_organizations table
    console.log('3️⃣ Checking User-Organization Linking Table...');
    const userOrgResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'app' 
        AND (table_name LIKE '%user%org%' OR table_name LIKE '%org%user%' OR table_name LIKE '%membership%')
      ORDER BY table_name
    `);
    
    if (userOrgResult.rows.length > 0) {
      console.log('   User-Organization linking tables:');
      userOrgResult.rows.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      
      // Check the structure of the first linking table
      const firstTable = userOrgResult.rows[0].table_name;
      const linkingColumns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_schema = 'app' AND table_name = $1
        ORDER BY ordinal_position
      `, [firstTable]);
      
      console.log(`\n   Structure of ${firstTable}:`);
      linkingColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
      
      // Check sample data
      const sampleData = await pool.query(`
        SELECT * FROM app.${firstTable} LIMIT 3
      `);
      
      console.log(`\n   Sample data from ${firstTable}:`);
      sampleData.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${JSON.stringify(row, null, 2)}`);
      });
      
    } else {
      console.log('   No user-organization linking tables found');
    }
    
    // 4. Check if users have organization_id
    console.log('\n4️⃣ Checking if Users have Organization ID...');
    const userOrgIdResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'users'
        AND column_name LIKE '%org%'
      ORDER BY ordinal_position
    `);
    
    if (userOrgIdResult.rows.length > 0) {
      console.log('   Organization-related columns in users table:');
      userOrgIdResult.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   No organization-related columns in users table');
    }
    
    // 5. Check current organization assignment
    console.log('\n5️⃣ Checking Current Organization Assignment...');
    const currentOrgResult = await pool.query(`
      SELECT 
        o.id as org_id,
        o.name as org_name,
        COUNT(n.id) as biztag_count
      FROM app.organizations o
      LEFT JOIN app.nfc_tags n ON o.id = n.organization_id AND n.deleted_at IS NULL
      GROUP BY o.id, o.name
      ORDER BY biztag_count DESC
    `);
    
    console.log('   Organization-BizTag distribution:');
    currentOrgResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.org_name || 'Untitled'} (${row.org_id})`);
      console.log(`      BizTags: ${row.biztag_count}`);
    });
    
    // 6. Check if there are any user-specific BizTag queries
    console.log('\n6️⃣ Testing User-Specific BizTag Queries...');
    
    // Get a sample user
    const sampleUser = usersResult.rows[0];
    if (sampleUser) {
      console.log(`   Testing with user: ${sampleUser.email}`);
      
      // Try to find BizTags for this user through organization
      const userBizTagsResult = await pool.query(`
        SELECT 
          n.bizcode,
          n.title,
          n.active_target_url,
          o.name as org_name
        FROM app.nfc_tags n
        LEFT JOIN app.organizations o ON n.organization_id = o.id
        WHERE n.deleted_at IS NULL
        LIMIT 3
      `);
      
      console.log(`   Found ${userBizTagsResult.rows.length} BizTags (all organizations):`);
      userBizTagsResult.rows.forEach((tag, index) => {
        console.log(`   ${index + 1}. ${tag.bizcode} (${tag.org_name})`);
        console.log(`      Title: ${tag.title || 'Untitled'}`);
        console.log(`      Redirect: ${tag.active_target_url || 'Default'}`);
      });
    }
    
    // 7. Summary and recommendations
    console.log('\n📊 USER LINKING ANALYSIS:');
    
    const hasUserOrgTable = userOrgResult.rows.length > 0;
    const hasUserOrgId = userOrgIdResult.rows.length > 0;
    const allBizTagsHaveOrg = currentOrgResult.rows.every(row => row.biztag_count > 0);
    
    console.log(`   ✅ Organizations exist: ${orgResult.rows.length > 0 ? 'Yes' : 'No'}`);
    console.log(`   ✅ Users exist: ${usersResult.rows.length > 0 ? 'Yes' : 'No'}`);
    console.log(`   ✅ User-Organization linking: ${hasUserOrgTable ? 'Yes' : 'No'}`);
    console.log(`   ✅ Users have org_id: ${hasUserOrgId ? 'Yes' : 'No'}`);
    console.log(`   ✅ All BizTags have organization: ${allBizTagsHaveOrg ? 'Yes' : 'No'}`);
    
    console.log('\n💡 CURRENT SYSTEM:');
    if (allBizTagsHaveOrg) {
      console.log('   🏢 Multi-tenant system with organization-based isolation');
      console.log('   📱 All BizTags belong to organizations');
      console.log('   👥 Users can be linked to organizations for access control');
    } else {
      console.log('   ⚠️  Mixed system - some BizTags may not be properly linked');
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    if (!hasUserOrgTable && !hasUserOrgId) {
      console.log('   1. Add organization_id to users table');
      console.log('   2. Create user_organizations table for many-to-many relationships');
      console.log('   3. Implement proper user-organization linking');
    }
    
    console.log('   4. Filter BizTags by user\'s organization in API');
    console.log('   5. Implement organization-based access control');
    console.log('   6. Add user_id to nfc_tags for direct ownership');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserOrganizationLinking();
