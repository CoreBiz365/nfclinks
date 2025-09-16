require('dotenv').config();

console.log('🔍 Checking Environment Variables...\n');

console.log('📋 Environment Variables:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`   PORT: ${process.env.PORT || 'undefined'}`);
console.log(`   API_BASE_URL: ${process.env.API_BASE_URL || 'undefined'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);

if (process.env.DATABASE_URL) {
  // Parse DATABASE_URL to show connection details (without password)
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`   Database Host: ${url.hostname}`);
    console.log(`   Database Port: ${url.port}`);
    console.log(`   Database Name: ${url.pathname.substring(1)}`);
    console.log(`   Database User: ${url.username}`);
  } catch (error) {
    console.log(`   Database URL: Invalid format`);
  }
} else {
  console.log('   ❌ DATABASE_URL is not set!');
}

console.log('\n📋 Required for NFC service:');
console.log('   ✅ PORT (defaults to 3000)');
console.log('   ✅ API_BASE_URL (defaults to https://api.biz365.ai)');
console.log('   ' + (process.env.DATABASE_URL ? '✅' : '❌') + ' DATABASE_URL');

if (!process.env.DATABASE_URL) {
  console.log('\n❌ DATABASE_URL is required for the NFC service to work!');
  console.log('   Please set DATABASE_URL in your .env file');
  console.log('   Example: DATABASE_URL=postgresql://user:password@host:port/database');
}
