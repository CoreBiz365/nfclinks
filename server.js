const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.biz365.ai';

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
    
    // Fetch NFC tag data from main API
    const response = await fetch(`${API_BASE_URL}/api/nfc/tags/${uid}`);
    
    if (!response.ok) {
      return res.status(404).send('NFC tag not found');
    }
    
    const nfcTag = await response.json();
    
    if (!nfcTag.active_target_url) {
      return res.status(404).send('NFC tag not configured');
    }
    
    // Log analytics event
    try {
      await fetch(`${API_BASE_URL}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'nfc_redirect',
          event_data: {
            uid,
            target_url: nfcTag.active_target_url,
            user_agent: req.get('User-Agent'),
            ip: req.ip
          }
        })
      });
    } catch (error) {
      console.error('Analytics logging failed:', error);
    }
    
    // Redirect to target URL
    res.redirect(302, nfcTag.active_target_url);
    
  } catch (error) {
    console.error('NFC redirect error:', error);
    res.status(500).send('Internal server error');
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
