const http = require('http');

async function testRedirect() {
  try {
    console.log('🧪 Testing NFC Redirect Locally...\n');
    
    // Test 1: Health check
    console.log('📋 1. Testing health endpoint...');
    const healthResponse = await makeRequest('http://localhost:3000/health');
    console.log('   Health check:', healthResponse.statusCode === 200 ? '✅ OK' : '❌ Failed');
    
    // Test 2: Database test
    console.log('\n📋 2. Testing database endpoint...');
    const dbResponse = await makeRequest('http://localhost:3000/test-db');
    console.log('   Database test:', dbResponse.statusCode === 200 ? '✅ OK' : '❌ Failed');
    if (dbResponse.statusCode === 200) {
      const data = JSON.parse(dbResponse.body);
      console.log(`   Total tags: ${data.total_tags}`);
    }
    
    // Test 3: NFC redirect
    console.log('\n📋 3. Testing NFC redirect...');
    const redirectResponse = await makeRequest('http://localhost:3000/q/BZPGUH6H');
    console.log('   Redirect test:', redirectResponse.statusCode === 302 ? '✅ OK' : '❌ Failed');
    console.log(`   Status: ${redirectResponse.statusCode}`);
    console.log(`   Location: ${redirectResponse.headers.location || 'No location header'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'NFC-Test/1.0'
      }
    };
    
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Run the test
testRedirect();
