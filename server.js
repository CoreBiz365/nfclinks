const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.biz365.ai';

// Performance monitoring
const performanceMetrics = {
  totalRequests: 0,
  successfulRedirects: 0,
  failedRedirects: 0,
  averageResponseTime: 0,
  slowRequests: 0,
  errorCount: 0,
  startTime: Date.now(),
  requestTimes: []
};

// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Track request
  performanceMetrics.totalRequests++;
  
  // Override res.json to track response time
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Track response time
    performanceMetrics.requestTimes.push(responseTime);
    
    // Keep only last 1000 response times for average calculation
    if (performanceMetrics.requestTimes.length > 1000) {
      performanceMetrics.requestTimes.shift();
    }
    
    // Calculate average response time
    const totalTime = performanceMetrics.requestTimes.reduce((a, b) => a + b, 0);
    performanceMetrics.averageResponseTime = Math.round(totalTime / performanceMetrics.requestTimes.length);
    
    // Track slow requests (>100ms)
    if (responseTime > 100) {
      performanceMetrics.slowRequests++;
      console.warn(`🐌 Slow NFC redirect: ${responseTime}ms for ${req.path}`);
    }
    
    // Track success/failure
    if (res.statusCode >= 200 && res.statusCode < 300) {
      performanceMetrics.successfulRedirects++;
    } else {
      performanceMetrics.failedRedirects++;
      performanceMetrics.errorCount++;
    }
    
    // Log performance every 100 requests
    if (performanceMetrics.totalRequests % 100 === 0) {
      logPerformanceMetrics();
    }
    
    return originalJson(data);
  };
  
  next();
};

// Log performance metrics
function logPerformanceMetrics() {
  const uptime = Math.round((Date.now() - performanceMetrics.startTime) / 1000);
  const successRate = ((performanceMetrics.successfulRedirects / performanceMetrics.totalRequests) * 100).toFixed(1);
  const slowRequestRate = ((performanceMetrics.slowRequests / performanceMetrics.totalRequests) * 100).toFixed(1);
  
  console.log('\n📊 NFC Service Performance Metrics:');
  console.log(`   Total Requests: ${performanceMetrics.totalRequests}`);
  console.log(`   Success Rate: ${successRate}%`);
  console.log(`   Average Response Time: ${performanceMetrics.averageResponseTime}ms`);
  console.log(`   Slow Requests (>100ms): ${performanceMetrics.slowRequests} (${slowRequestRate}%)`);
  console.log(`   Errors: ${performanceMetrics.errorCount}`);
  console.log(`   Uptime: ${uptime}s`);
  console.log('');
}

// Performance endpoint
app.get('/performance', (req, res) => {
  const uptime = Math.round((Date.now() - performanceMetrics.startTime) / 1000);
  const successRate = performanceMetrics.totalRequests > 0 
    ? ((performanceMetrics.successfulRedirects / performanceMetrics.totalRequests) * 100).toFixed(1)
    : 0;
  const slowRequestRate = performanceMetrics.totalRequests > 0
    ? ((performanceMetrics.slowRequests / performanceMetrics.totalRequests) * 100).toFixed(1)
    : 0;
  
  res.json({
    status: 'ok',
    service: 'nfc-links',
    performance: {
      totalRequests: performanceMetrics.totalRequests,
      successfulRedirects: performanceMetrics.successfulRedirects,
      failedRedirects: performanceMetrics.failedRedirects,
      successRate: `${successRate}%`,
      averageResponseTime: `${performanceMetrics.averageResponseTime}ms`,
      slowRequests: performanceMetrics.slowRequests,
      slowRequestRate: `${slowRequestRate}%`,
      errorCount: performanceMetrics.errorCount,
      uptime: `${uptime}s`,
      timestamp: new Date().toISOString()
    }
  });
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/biz365',
  ssl: false  // Database doesn't support SSL
});

// Test database connection on startup
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(performanceMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'nfc-links',
    timestamp: new Date().toISOString() 
  });
});

// Test endpoint to check database connection
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as total FROM app.nfc_tags WHERE deleted_at IS NULL');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      total_tags: result.rows[0].total,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// NFC redirect endpoint
app.get('/q/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { ref, utm_source, utm_medium, utm_campaign } = req.query;
    
    console.log(`🔗 NFC redirect request for UID: ${uid}`);
    
    // Get client IP
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Find NFC tag in database (multi-tenant aware)
    console.log(`📋 Querying database for UID: ${uid}`);
    const nfcResult = await pool.query(`
      SELECT id, uid, bizcode, title, click_count, active_target_url, target_url, organization_id
      FROM app.nfc_tags 
      WHERE uid = $1 AND deleted_at IS NULL
    `, [uid]);
    
    console.log(`📊 Query result: ${nfcResult.rows.length} rows found`);
    
    if (nfcResult.rows.length === 0) {
      return res.status(404).send(`
        <html>
          <head><title>NFC Tag Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🔍 NFC Tag Not Found</h1>
            <p>The NFC tag with UID <code>${uid}</code> was not found.</p>
            <p>Please check the tag or contact support.</p>
          </body>
        </html>
      `);
    }
    
    const nfcTag = nfcResult.rows[0];
    
    // Force all BizTags to redirect to login page
    let baseRedirectUrl = 'https://app.biz365.ai/login';
    let redirectType = 'login_page';
    
    console.log(`🎯 Forcing redirect to login page for BizTag: ${nfcTag.bizcode}`);
    
    // Build redirect URL with query parameters
    let redirectUrl = baseRedirectUrl;
    const urlParams = new URLSearchParams();
    
    // Add UTM parameters for tracking
    if (ref) urlParams.append('ref', ref);
    if (utm_source) urlParams.append('utm_source', utm_source);
    if (utm_medium) urlParams.append('utm_medium', utm_medium);
    if (utm_campaign) urlParams.append('utm_campaign', utm_campaign);
    
    // Add bizcode for tracking which NFC tag was scanned
    urlParams.append('bizcode', nfcTag.bizcode);
    urlParams.append('nfc_uid', uid);
    
    if (urlParams.toString()) {
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + urlParams.toString();
    }
    
    // Update click count and last clicked time
    await pool.query(`
      UPDATE app.nfc_tags 
      SET click_count = COALESCE(click_count, 0) + 1, 
          last_clicked = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [nfcTag.id]);
    
    // Record redirect event
    try {
      await pool.query(`
        INSERT INTO app.nfc_redirects (nfc_tag_id, resolved_url, client_ip, user_agent)
        VALUES ($1, $2, $3, $4)
      `, [nfcTag.id, redirectUrl, clientIp, req.get('User-Agent')]);
    } catch (error) {
      console.error('Failed to record redirect:', error);
    }
    
    // Log analytics event to main API
    try {
      await fetch(`${API_BASE_URL}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'nfc_redirect',
          event_data: {
            uid,
            bizcode: nfcTag.bizcode,
            target_url: redirectUrl,
            base_url: baseRedirectUrl,
            redirect_type: redirectType,
            organization_id: nfcTag.organization_id,
            user_agent: req.get('User-Agent'),
            ip: clientIp,
            title: nfcTag.title
          }
        })
      });
    } catch (error) {
      console.error('Analytics logging failed:', error);
    }
    
    // Redirect to target URL
    res.redirect(302, redirectUrl);
    
  } catch (error) {
    console.error('NFC redirect error:', error);
    res.status(500).send(`
      <html>
        <head><title>Server Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>⚠️ Server Error</h1>
          <p>Something went wrong while processing your request.</p>
          <p>Please try again later.</p>
        </body>
      </html>
    `);
  }
});

// Alternative redirect endpoint
app.get('/:uid', async (req, res) => {
  // Redirect to the /q/ endpoint for consistency
  res.redirect(301, `/q/${req.params.uid}`);
});

// Catch-all for undefined routes
app.get('*', (req, res) => {
  res.status(404).send('Not found');
});

// Test database connection before starting server
async function startServer() {
  try {
    console.log('🔄 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection test successful');
    
    app.listen(PORT, () => {
      console.log(`🚀 NFC Links service running on port ${PORT}`);
      console.log(`🌐 API Base URL: ${API_BASE_URL}`);
      console.log(`📊 Database: Connected`);
    });
  } catch (error) {
    console.error('❌ Failed to start server - Database connection failed:', error.message);
    process.exit(1);
  }
}

startServer();
