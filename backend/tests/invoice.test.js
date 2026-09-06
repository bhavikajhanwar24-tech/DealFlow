const pool = require("../src/config/db");
const invoiceController = require("../src/controllers/invoice.controller");
const { generateInvoicePDF } = require("../src/services/pdf.service");

async function runInvoiceTests() {
  console.log("=======================================================");
  console.log("   DEALFLOW360: INVOICE GENERATION & MANAGEMENT TESTS  ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  try {
    // 1. Initialize database schema
    await pool.initDatabase();

    // 2. Fetch or create a test customer, sales rep, and quotation
    const client = await pool.pool.connect();
    let orderId;
    let customerId;
    let quotationId;

    try {
      // Find a confirmed order or create one
      const orderRes = await client.query(`
        SELECT o.id, o.order_number, o.customer_id, o.quotation_id
        FROM public.orders o
        JOIN public.quotations q ON o.quotation_id = q.id
        WHERE q.status IN ('CONFIRMED', 'FINALIZED')
        LIMIT 1
      `);

      if (orderRes.rows.length > 0) {
        orderId = orderRes.rows[0].id;
        customerId = orderRes.rows[0].customer_id;
        quotationId = orderRes.rows[0].quotation_id;
      } else {
        console.log("Setting up temporary test records for invoice flow...");
        const custRes = await client.query(`SELECT id FROM public.users WHERE role = 'CUSTOMER' LIMIT 1`);
        const salesRes = await client.query(`SELECT id FROM public.users WHERE role = 'SALES_REP' LIMIT 1`);
        const prodRes = await client.query(`SELECT id, unit_price FROM public.products LIMIT 2`);

        customerId = custRes.rows[0]?.id;
        const salesRepId = salesRes.rows[0]?.id;

        const qRes = await client.query(`
          INSERT INTO public.quotations 
            (quotation_number, customer_id, sales_rep_id, status, subtotal, final_amount)
          VALUES ('QT-TEST-INV-001', $1, $2, 'CONFIRMED', 100000, 100000)
          RETURNING id
        `, [customerId, salesRepId]);
        quotationId = qRes.rows[0].id;

        await client.query(`
          INSERT INTO public.quotation_items (quotation_id, product_id, quantity, unit_price, line_total)
          VALUES ($1, $2, 2, $3, $4)
        `, [quotationId, prodRes.rows[0].id, prodRes.rows[0].unit_price || 50000, (prodRes.rows[0].unit_price || 50000) * 2]);

        const oRes = await client.query(`
          INSERT INTO public.orders (order_number, quotation_id, customer_id, status, fulfillment_status, delivery_address, delivery_city, delivery_state, delivery_zip)
          VALUES ('ORD-TEST-INV-001', $1, $2, 'CONFIRMED', 'READY', '123 Tech Park Blvd', 'Bengaluru', 'Karnataka', '560100')
          RETURNING id
        `, [quotationId, customerId]);
        orderId = oRes.rows[0].id;
      }
    } finally {
      client.release();
    }

    console.log(`Testing with Order ID: ${orderId}, Quotation ID: ${quotationId}\n`);

    // TEST 1: Generate Invoice from Order
    console.log("[Test 1] Generating invoice from confirmed order...");
    let generatedInvoice;
    {
      const req = {
        params: { orderId },
        body: {},
        user: { id: customerId, role: "ADMIN" },
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => {
          resStatus = code;
          return {
            json: (payload) => {
              resData = payload;
            },
          };
        },
        json: (payload) => {
          resData = payload;
        },
      };

      await invoiceController.generateInvoice(req, res);

      if (resData && resData.success && resData.data?.invoice_number) {
        generatedInvoice = resData.data;
        console.log(`  ✓ PASS: Invoice created successfully: ${generatedInvoice.invoice_number}`);
        console.log(`    Total: INR ${generatedInvoice.total}, Status: ${generatedInvoice.status}`);
        passed++;
      } else {
        console.error("  ✗ FAIL: Invoice generation failed", resData);
        failed++;
      }
    }

    // TEST 2: Duplicate Protection
    console.log("\n[Test 2] Testing duplicate protection (re-generating for same order)...");
    {
      const req = {
        params: { orderId },
        body: {},
        user: { id: customerId, role: "ADMIN" },
      };
      let resData = null;
      const res = {
        status: () => ({ json: (p) => (resData = p) }),
        json: (p) => (resData = p),
      };

      await invoiceController.generateInvoice(req, res);

      if (resData && resData.success && resData.data.id === generatedInvoice.id) {
        console.log("  ✓ PASS: Duplicate prevented; existing invoice returned safely.");
        passed++;
      } else {
        console.error("  ✗ FAIL: Duplicate protection did not return existing invoice.", resData);
        failed++;
      }
    }

    // TEST 3: Invoice Details & Historical Snapshot Verification
    console.log("\n[Test 3] Verifying invoice details, items, and address snapshots...");
    {
      const req = {
        params: { id: generatedInvoice.id },
        user: { id: customerId, role: "ADMIN" },
      };
      let resData = null;
      const res = {
        status: () => ({ json: (p) => (resData = p) }),
        json: (p) => (resData = p),
      };

      await invoiceController.getInvoiceDetails(req, res);

      if (resData && resData.success && resData.data.items && resData.data.items.length > 0) {
        console.log(`  ✓ PASS: Found ${resData.data.items.length} line items with snapshots in invoice.`);
        console.log(`    Billing Address: ${JSON.stringify(resData.data.billing_address)}`);
        passed++;
      } else {
        console.error("  ✗ FAIL: Invoice items or snapshot missing.", resData);
        failed++;
      }
    }

    // TEST 4: Payment Recording and Status Transition
    console.log("\n[Test 4] Recording partial payment against invoice...");
    {
      const req = {
        params: { id: generatedInvoice.id },
        body: { amount: 1000, paymentMethod: "UPI", reference: "UPI-REF-12345" },
        user: { id: customerId, role: "FINANCE" },
      };
      let resData = null;
      const res = {
        status: () => ({ json: (p) => (resData = p) }),
        json: (p) => (resData = p),
      };

      await invoiceController.recordPayment(req, res);

      if (resData && resData.success && resData.data.status === "PARTIALLY_PAID") {
        console.log(`  ✓ PASS: Partial payment recorded. Status updated to: ${resData.data.status}`);
        passed++;
      } else {
        console.error("  ✗ FAIL: Payment recording failed.", resData);
        failed++;
      }
    }

    // TEST 5: PDF Generation
    console.log("\n[Test 5] Generating PDF binary from stored invoice snapshot...");
    {
      const completeInvoice = {
        ...generatedInvoice,
        items: [
          { product_name: "Enterprise Server Solution", sku: "SRV-001", quantity: 2, unit_price: 50000, discount_percent: 5, tax_rate: 18, line_total: 112100 },
        ],
      };
      const pdfBuffer = await generateInvoicePDF(completeInvoice);

      if (pdfBuffer && pdfBuffer.length > 1000 && pdfBuffer.toString("utf8", 0, 4) === "%PDF") {
        console.log(`  ✓ PASS: Valid PDF generated (${pdfBuffer.length} bytes, starts with %PDF).`);
        passed++;
      } else {
        console.error("  ✗ FAIL: Invalid PDF buffer generated.");
        failed++;
      }
    }

    // TEST 6: Finance Summary / KPIs
    console.log("\n[Test 6] Fetching dynamic Finance Summary & KPIs...");
    {
      const req = { user: { role: "ADMIN" } };
      let resData = null;
      const res = {
        status: () => ({ json: (p) => (resData = p) }),
        json: (p) => (resData = p),
      };

      await invoiceController.getFinanceSummary(req, res);

      if (resData && resData.success && Number(resData.data.total_invoices) > 0) {
        console.log(`  ✓ PASS: Dynamic Finance KPIs calculated:`);
        console.log(`    Total Invoices: ${resData.data.total_invoices}, Invoiced: INR ${resData.data.total_invoiced}, Paid: INR ${resData.data.total_paid}`);
        passed++;
      } else {
        console.error("  ✗ FAIL: Finance summary failed.", resData);
        failed++;
      }
    }

  } catch (err) {
    console.error("Unhandled test exception:", err);
    failed++;
  }

  console.log("\n-------------------------------------------------------");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("-------------------------------------------------------");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runInvoiceTests();
