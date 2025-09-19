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

// Backend API configuration
const BACKEND_API_URL = process.env.API_BASE_URL || 'https://api.biz365.ai';

// Helper function to call backend API
async function callBackendAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Backend API call failed:', error.message);
    throw error;
  }
}

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

// Test endpoint to check backend API connection
app.get('/test-db', async (req, res) => {
  try {
    const data = await callBackendAPI('/api/nfc/tags');
    res.json({ 
      status: 'ok', 
      backend_api: 'connected',
      total_tags: data.data ? data.data.length : 0,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      backend_api: 'disconnected',
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
    
    // Find NFC tag via backend API
    console.log(`📋 Querying backend API for UID: ${uid}`);
    const nfcData = await callBackendAPI(`/api/nfc/search-uid/${uid}`);
    
    console.log(`📊 API result:`, nfcData);
    
    if (!nfcData.ok || !nfcData.data) {
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
    
    const nfcTag = nfcData.data;
    
    // Use configured redirect URL or default to signup page
    let baseRedirectUrl = nfcTag.active_target_url || nfcTag.target_url || 'https://app.biz365.ai/signup';
    let redirectType = nfcTag.active_target_url ? 'configured_redirect' : 'default_signup';
    
    console.log(`🎯 Redirecting BizTag ${nfcTag.bizcode} to: ${baseRedirectUrl}`);
    
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
    
    // Record NFC scan via backend API
    try {
      await callBackendAPI('/api/nfc/scan', {
        method: 'POST',
        body: JSON.stringify({
          nfc_tag_id: nfcTag.id,
          uid: uid,
          bizcode: nfcTag.bizcode,
          client_ip: clientIp,
          user_agent: req.get('User-Agent'),
          resolved_url: redirectUrl,
          redirect_type: redirectType
        })
      });
    } catch (error) {
      console.error('Failed to record NFC scan:', error);
    }
    
    // Log analytics event to main API
    try {
      await callBackendAPI('/api/analytics/events', {
        method: 'POST',
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

// NFC-specific redirect endpoint
app.get('/nfc/:uid', async (req, res) => {
  // Redirect to the /q/ endpoint for consistency
  res.redirect(301, `/q/${req.params.uid}`);
});

// Canonical redirect endpoint
app.get('/r/:uid', async (req, res) => {
  // Redirect to the /q/ endpoint for consistency
  res.redirect(301, `/q/${req.params.uid}`);
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

// Test backend API connection before starting server
async function startServer() {
  try {
    console.log('🔄 Testing backend API connection...');
    await callBackendAPI('/health');
    console.log('✅ Backend API connection test successful');
    
    app.listen(PORT, () => {
      console.log(`🚀 NFC Links service running on port ${PORT}`);
      console.log(`🌐 Backend API URL: ${BACKEND_API_URL}`);
      console.log(`📊 Backend API: Connected`);
    });
  } catch (error) {
    console.error('❌ Failed to start server - Backend API connection failed:', error.message);
    console.log('⚠️  Starting server anyway - API calls will be retried...');
    
    app.listen(PORT, () => {
      console.log(`🚀 NFC Links service running on port ${PORT}`);
      console.log(`🌐 Backend API URL: ${BACKEND_API_URL}`);
      console.log(`⚠️  Backend API: Connection issues - will retry on requests`);
    });
  }
}

startServer();
