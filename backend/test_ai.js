const jwt = require('jsonwebtoken');
require('dotenv').config();
const { pool } = require('./src/config/db');

async function test() {
  try {
    const res = await pool.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1");
    if (res.rows.length === 0) throw new Error("No admin user found");
    
    const token = jwt.sign(
      { userId: res.rows[0].id, role: 'ADMIN' },
      process.env.JWT_SECRET || 'dealflow360_fallback_secret_key',
      { expiresIn: '1d' }
    );
    
    const qRes = await pool.query('SELECT id FROM quotations LIMIT 1');
    if (qRes.rows.length === 0) {
      console.log('No quotations found in DB');
      return;
    }
    const qId = qRes.rows[0].id;
    console.log('Testing with Quotation ID:', qId);
    
    const endpoints = [
      { url: `/api/messages/quotations/${qId}/ai-analysis`, method: 'GET' },
      { url: `/api/ai/smart-alerts`, method: 'GET' },
      {
        url: `/api/ai/negotiation-copilot`,
        method: 'POST',
        body: {
          currentDiscount: 5,
          allowedDiscount: 15,
          currentMargin: 20,
          messages: [{ sender_role: 'CUSTOMER', sender_name: 'Acme', message: 'Can you give me 10% discount?' }]
        }
      },
      {
        url: `/api/ai/pricing-recommendation`,
        method: 'POST',
        body: {
          productCosts: [100, 200],
          currentMargin: 25,
          tierMaxDiscount: 15
        }
      }
    ];
    
    for (const ep of endpoints) {
      console.log(`\nFetching ${ep.url}...`);
      const response = await fetch(`http://localhost:5000${ep.url}`, {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      const text = await response.text();
      console.log('STATUS:', response.status);
      console.log('RESPONSE:', text.substring(0, 500));
    }
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

test();
