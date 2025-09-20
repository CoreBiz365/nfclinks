const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = 3001;

console.log('Starting simple test server...');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://biz365_user:asdfghjkl@89.117.75.191:5432/postgres',
  ssl: false
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'nfc-links-test' });
});

// Test NFC redirect
app.get('/q/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log(`Testing NFC redirect for UID: ${uid}`);
    
    const result = await pool.query(`
      SELECT id, uid, bizcode, title, is_active
      FROM app.nfc_tags 
      WHERE uid = $1 AND deleted_at IS NULL
    `, [uid]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('NFC tag not found');
    }
    
    const nfcTag = result.rows[0];
    console.log('Found NFC tag:', nfcTag);
    
    // Redirect to login page
    const redirectUrl = `https://app.biz365.ai/login?bizcode=${nfcTag.bizcode}&nfc_uid=${uid}`;
    console.log('Redirecting to:', redirectUrl);
    
    res.redirect(302, redirectUrl);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Simple test server running on port ${PORT}`);
  console.log(`Test URL: http://localhost:${PORT}/q/BZZH7BUD`);
});
