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
    const srRes = await pool.query("SELECT id FROM users WHERE role='SALES_REP' LIMIT 1");
    if (srRes.rows.length > 0) {
      const srToken = jwt.sign(
        { userId: srRes.rows[0].id, role: 'SALES_REP' },
        process.env.JWT_SECRET || 'dealflow360_fallback_secret_key',
        { expiresIn: '1d' }
      );
      console.log('\nTesting /api/operations/warehouses with SALES_REP role...');
      const opRes = await fetch('http://localhost:5000/api/operations/warehouses', {
        headers: { Authorization: 'Bearer ' + srToken }
      });
      console.log('SALES_REP /operations/warehouses STATUS:', opRes.status);
      const opText = await opRes.text();
      console.log('SALES_REP RESPONSE:', opText.substring(0, 200));
    }
    const custRes = await pool.query("SELECT id FROM users WHERE role='CUSTOMER' LIMIT 1");
    if (custRes.rows.length > 0) {
      const custToken = jwt.sign(
        { userId: custRes.rows[0].id, role: 'CUSTOMER' },
        process.env.JWT_SECRET || 'dealflow360_fallback_secret_key',
        { expiresIn: '1d' }
      );
      console.log('\nTesting /api/customer/quotations/products with CUSTOMER role...');
      const prodRes = await fetch('http://localhost:5000/api/customer/quotations/products', {
        headers: { Authorization: 'Bearer ' + custToken }
      });
      console.log('CUSTOMER /customer/quotations/products STATUS:', prodRes.status);
      const prodText = await prodRes.text();
      console.log('CUSTOMER RESPONSE:', prodText.substring(0, 200));

      const prodData = JSON.parse(prodText);
      if (prodData.data && prodData.data.length > 0) {
        const testProd = prodData.data[0];
        
        console.log('\n--- 1. Testing Auto-Approval Customer Request ---');
        const autoReqRes = await fetch('http://localhost:5000/api/customer/quotations/requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + custToken
          },
          body: JSON.stringify({
            items: [{ productId: testProd.id, quantity: 2 }],
            requestedDeliveryDate: '2026-09-20',
            customerComment: 'Standard catalog order'
          })
        });
        console.log('Auto-Approval Request STATUS:', autoReqRes.status);
        const autoData = await autoReqRes.json();
        console.log('Auto-Approval Response:', autoData);

        console.log('\n--- 2. Testing Manual Review Customer Request ---');
        const manualReqRes = await fetch('http://localhost:5000/api/customer/quotations/requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + custToken
          },
          body: JSON.stringify({
            items: [{ productId: testProd.id, quantity: 15 }],
            requestedDeliveryDate: '2026-09-25',
            customerComment: 'Need special bulk discount and extended terms'
          })
        });
        console.log('Manual Review Request STATUS:', manualReqRes.status);
        const manualData = await manualReqRes.json();
        console.log('Manual Review Response:', manualData);

        console.log('\n--- 3. Testing Staff Dashboard Pending Requests Queue ---');
        const srRes = await pool.query("SELECT id FROM users WHERE role='SALES_REP' LIMIT 1");
        const srToken = jwt.sign(
          { userId: srRes.rows[0].id, role: 'SALES_REP' },
          process.env.JWT_SECRET || 'dealflow360_fallback_secret_key',
          { expiresIn: '1d' }
        );

        const listReqRes = await fetch('http://localhost:5000/api/quotations/customer-requests', {
          headers: { Authorization: 'Bearer ' + srToken }
        });
        console.log('Staff list pending requests STATUS:', listReqRes.status);
        const listData = await listReqRes.json();
        console.log('Staff pending requests count:', listData.data?.length);

        if (manualData.data?.id) {
          console.log('\n--- 4. Testing Staff Convert Request to Quotation ---');
          const convertRes = await fetch(`http://localhost:5000/api/quotations/customer-requests/${manualData.data.id}/convert`, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + srToken }
          });
          console.log('Convert Request STATUS:', convertRes.status);
          const convertData = await convertRes.json();
          console.log('Converted Quotation:', convertData.data?.quotationNumber, 'Status:', convertData.data?.status);
        }
      }
    }
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

test();
