const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.biz365.ai';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false  // Database doesn't support SSL
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'nfc-links',
    timestamp: new Date().toISOString() 
  });
});

// NFC redirect endpoint
app.get('/q/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { ref, utm_source, utm_medium, utm_campaign } = req.query;
    
    // Get client IP
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Find NFC tag in database
    const nfcResult = await pool.query(`
      SELECT id, uid, bizcode, title, click_count, active_target_url, source_target_url
      FROM app.nfc_tags 
      WHERE uid = $1 AND deleted_at IS NULL
    `, [uid]);
    
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
    
    // Determine redirect URL - use custom URL if set, otherwise default to signup
    let baseRedirectUrl;
    let redirectType = 'signup_page';
    
    if (nfcTag.active_target_url && nfcTag.active_target_url.trim() !== '') {
      // User has set a custom redirect URL
      baseRedirectUrl = nfcTag.active_target_url;
      redirectType = 'custom_url';
    } else {
      // Default to signup page
      baseRedirectUrl = 'https://app.biz365.ai/signup';
      redirectType = 'signup_page';
    }
    
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

app.listen(PORT, () => {
  console.log(`NFC Links service running on port ${PORT}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
});
