const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const db = require("../src/config/db");
const uploadService = require("../src/services/upload.service");

async function seedBulkData() {
  console.log("Connecting to PostgreSQL...");
  const adminRes = await db.query("SELECT id FROM public.users WHERE role = 'ADMIN' LIMIT 1");
  if (adminRes.rows.length === 0) {
    throw new Error("No Admin user found. Please ensure DB is initialized.");
  }
  const adminId = adminRes.rows[0].id;
  console.log("Admin ID found:", adminId);

  // -------------------------------------------------------------
  // 1. Generate 80 Realistic Products
  // -------------------------------------------------------------
  console.log("\nGenerating 80 Products...");
  const hardwareTypes = [
    { name: "Pro Workstation X", baseSku: "HW-WS", price: 95000, cost: 65000 },
    { name: "Edge AI Server", baseSku: "HW-EDG", price: 145000, cost: 98000 },
    { name: "Managed 48-Port PoE Switch", baseSku: "HW-SWT", price: 42000, cost: 28000 },
    { name: "NVMe SAN Storage Array 32TB", baseSku: "HW-SAN", price: 320000, cost: 210000 },
    { name: "Enterprise Dual-Band AP", baseSku: "HW-WAP", price: 18000, cost: 11000 },
    { name: "Hardware Firewall Appliance", baseSku: "HW-FWL", price: 78000, cost: 52000 },
    { name: "Rackmount UPS 10kVA", baseSku: "HW-UPS", price: 115000, cost: 75000 },
    { name: "UltraWide 49-inch Curved Monitor", baseSku: "HW-DIS", price: 88000, cost: 58000 }
  ];

  const serviceTypes = [
    { name: "24/7 Dedicated NOC Support", baseSku: "SVC-NOC", price: 35000, cost: 12000 },
    { name: "Cybersecurity Vulnerability Audit", baseSku: "SVC-SEC", price: 65000, cost: 22000 },
    { name: "Zero-Downtime Migration Services", baseSku: "SVC-MIG", price: 90000, cost: 38000 },
    { name: "Disaster Recovery Drill & SLA", baseSku: "SVC-BCP", price: 45000, cost: 16000 },
    { name: "On-site Datacenter Cabling & Setup", baseSku: "SVC-ENG", price: 28000, cost: 9500 }
  ];

  const subTypes = [
    { name: "DealFlow Enterprise Cloud Tier", baseSku: "SUB-ENT", price: 12000, cost: 2500 },
    { name: "AI Predictive Analytics Suite", baseSku: "SUB-AIP", price: 18000, cost: 3500 },
    { name: "Global Threat Intelligence Feed", baseSku: "SUB-THR", price: 8500, cost: 1800 },
    { name: "SOC2 Compliance Automation License", baseSku: "SUB-SOC", price: 15000, cost: 3000 }
  ];

  const productRows = [];
  let pIndex = 1;

  for (const h of hardwareTypes) {
    for (let v = 1; v <= 5; v++) {
      productRows.push({
        name: `${h.name} Gen-${v}`,
        sku: `${h.baseSku}-G${v}-${100 + pIndex}`,
        category: "HARDWARE",
        description: `Enterprise-grade hardware asset with 3-year warranty and high-availability architecture. Variant G${v}.`,
        unit_price: h.price + v * 3000,
        cost: h.cost + v * 1800,
        inventory_reference: `RACK-SEC-${String.fromCharCode(65 + (pIndex % 6))}-${100 + v}`,
        currency: "INR",
        is_active: "TRUE"
      });
      pIndex++;
    }
  }

  for (const s of serviceTypes) {
    for (let v = 1; v <= 4; v++) {
      productRows.push({
        name: `${s.name} - Tier ${v}`,
        sku: `${s.baseSku}-T${v}-${200 + pIndex}`,
        category: "SERVICE",
        description: `Custom SLA deployment service with certified engineers and structured milestones. Tier ${v}.`,
        unit_price: s.price + v * 5000,
        cost: s.cost + v * 1500,
        inventory_reference: `SVC-SPEC-${v}`,
        currency: "INR",
        is_active: "TRUE"
      });
      pIndex++;
    }
  }

  for (const sub of subTypes) {
    for (let v = 1; v <= 5; v++) {
      productRows.push({
        name: `${sub.name} - ${v * 10} Seats`,
        sku: `${sub.baseSku}-S${v * 10}-${300 + pIndex}`,
        category: "SUBSCRIPTION",
        description: `Monthly cloud SaaS license bundled with priority SLA and audit logs. ${v * 10} User Seats.`,
        unit_price: sub.price * v,
        cost: sub.cost * v,
        inventory_reference: `SAAS-POOL-${v}`,
        currency: "INR",
        is_active: "TRUE"
      });
      pIndex++;
    }
  }

  const pResult = await uploadService.bulkUploadProducts(productRows, adminId, "127.0.0.1");
  console.log(`✓ Products imported: ${pResult.success} succeeded, ${pResult.failed} failed.`);

  // -------------------------------------------------------------
  // 2. Generate 50 Realistic Customers
  // -------------------------------------------------------------
  console.log("\nGenerating 50 Customers...");
  const firstNames = ["Aarav", "Pooja", "Vikram", "Neha", "Rohan", "Sneha", "Aditya", "Priya", "Karan", "Divya", "Suresh", "Meera", "Anand", "Ritu", "Gaurav", "Nisha", "Rahul", "Kavita", "Sameer", "Swati"];
  const lastNames = ["Sharma", "Verma", "Mehta", "Patel", "Reddy", "Nair", "Iyer", "Chopra", "Singhania", "Deshmukh", "Malhotra", "Kapoor", "Bhatia", "Joshi", "Bansal"];
  const companies = [
    "Tata Consultancy Services", "Infosys Limited", "Wipro Digital", "HCL Tech Global", "Tech Mahindra",
    "Reliance Digital", "Bharti Airtel Enterprise", "Bajaj Finserv Tech", "L&T Infotech", "Zomato HQ",
    "Swiggy Delivery Corp", "Flipkart Commerce", "Razorpay Software", "Paytm Payments", "CRED Financial",
    "Delhivery Logistics", "Groww Investments", "PhonePe India", "Zerodha Broking", "Freshworks Cloud"
  ];
  const tiers = ["GOLD", "SILVER", "BRONZE"];

  const customerRows = [];
  for (let i = 1; i <= 50; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const comp = companies[i % companies.length];
    const tier = tiers[i % tiers.length];
    customerRows.push({
      full_name: `${fn} ${ln}`,
      email: `customer.${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@example.com`,
      company_name: `${comp} (Div ${i})`,
      customer_tier: tier,
      password: "DealFlow@2025"
    });
  }

  const cResult = await uploadService.bulkUploadCustomers(customerRows, adminId, "127.0.0.1");
  console.log(`✓ Customers imported: ${cResult.success} succeeded, ${cResult.failed} failed.`);

  // -------------------------------------------------------------
  // 3. Generate 30 Staff Members
  // -------------------------------------------------------------
  console.log("\nGenerating 30 Staff Members...");
  const staffRoles = ["SALES_REP", "SALES_MANAGER", "FINANCE", "OPERATIONS"];
  const depts = ["Direct Sales", "Key Accounts", "Finance Operations", "Supply Chain", "Enterprise Solutions"];

  const staffRows = [];
  for (let i = 1; i <= 30; i++) {
    const fn = firstNames[(i + 5) % firstNames.length];
    const ln = lastNames[(i + 3) % lastNames.length];
    const role = staffRoles[i % staffRoles.length];
    const dept = depts[i % depts.length];
    staffRows.push({
      full_name: `${fn} ${ln}`,
      email: `staff.${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@dealflow360.com`,
      employee_id: `DF-STAFF-${String(i).padStart(3, "0")}`,
      role,
      department: dept,
      password: "DealFlow@2025"
    });
  }

  const sResult = await uploadService.bulkUploadStaff(staffRows, adminId, "127.0.0.1");
  console.log(`✓ Staff imported: ${sResult.success} succeeded, ${sResult.failed} failed.`);

  // -------------------------------------------------------------
  // 4. Generate 25 Warehouses across Major Indian Logistics Hubs
  // -------------------------------------------------------------
  console.log("\nGenerating 25 Warehouses...");
  const hubs = [
    { city: "Bengaluru", lat: 12.9716, lng: 77.5946, addr: "Peenya Industrial Area Phase 2" },
    { city: "Mumbai", lat: 19.0760, lng: 72.8777, addr: "Bhiwandi Logistics Park, Zone 4" },
    { city: "Delhi NCR", lat: 28.7041, lng: 77.1025, addr: "Manesar Industrial Township Sector 8" },
    { city: "Hyderabad", lat: 17.3850, lng: 78.4867, addr: "Shamshabad Cargo Airport Road" },
    { city: "Chennai", lat: 13.0827, lng: 80.2707, addr: "Sriperumbudur Auto & Tech Corridor" },
    { city: "Pune", lat: 18.5204, lng: 73.8567, addr: "Chakan Industrial Area Phase 3" },
    { city: "Kolkata", lat: 22.5726, lng: 88.3639, addr: "Dankuni Logistics Hub" },
    { city: "Ahmedabad", lat: 23.0225, lng: 72.5714, addr: "Sanand GIDC Industrial Estate" }
  ];

  const warehouseRows = [];
  for (let i = 1; i <= 25; i++) {
    const hub = hubs[i % hubs.length];
    const variance = (i * 0.015).toFixed(4);
    warehouseRows.push({
      name: `Hub ${hub.city} Mega-Center ${i}`,
      address: `${hub.addr}, Plot ${100 + i * 5}, ${hub.city}`,
      latitude: Number(hub.lat) + (i % 2 === 0 ? Number(variance) : -Number(variance)),
      longitude: Number(hub.lng) + (i % 2 === 0 ? Number(variance) : -Number(variance))
    });
  }

  const wResult = await uploadService.bulkUploadWarehouses(warehouseRows, adminId, "127.0.0.1");
  console.log(`✓ Warehouses imported: ${wResult.success} succeeded, ${wResult.failed} failed.`);

  // -------------------------------------------------------------
  // 5. Generate 60 Quotations with Line Items
  // -------------------------------------------------------------
  console.log("\nGenerating 60 Quotations...");
  const quoteRows = [];
  for (let i = 0; i < 30; i++) {
    const cust = customerRows[i];
    const rep = staffRows.find(s => s.role === "SALES_REP") || staffRows[0];
    const prod1 = productRows[i % productRows.length];
    const prod2 = productRows[(i + 7) % productRows.length];

    quoteRows.push({
      customer_email: cust.email,
      sales_rep_email: rep.email,
      status: "DRAFT",
      product_sku: prod1.sku,
      quantity: 2 + (i % 5),
      unit_price: prod1.unit_price,
      discount_percent: 5 + (i % 8)
    });

    quoteRows.push({
      customer_email: cust.email,
      sales_rep_email: rep.email,
      status: "DRAFT",
      product_sku: prod2.sku,
      quantity: 1 + (i % 3),
      unit_price: prod2.unit_price,
      discount_percent: 3 + (i % 5)
    });
  }

  const qResult = await uploadService.bulkUploadQuotations(quoteRows, adminId, "127.0.0.1");
  console.log(`✓ Quotations imported: ${qResult.success} lines imported, ${qResult.failed} failed.`);

  // Summary
  const grandTotal = pResult.success + cResult.success + sResult.success + wResult.success + qResult.success;
  console.log("\n========================================================");
  console.log(`🎉 BULK DATA SEEDING COMPLETED SUCCESSFULLY!`);
  console.log(`Total Rows Inserted / Upserted: ${grandTotal}`);
  console.log(`  - Products:   ${pResult.success}`);
  console.log(`  - Customers:  ${cResult.success}`);
  console.log(`  - Staff:      ${sResult.success}`);
  console.log(`  - Warehouses: ${wResult.success}`);
  console.log(`  - Quotation Lines: ${qResult.success}`);
  console.log("========================================================\n");

  process.exit(0);
}

seedBulkData().catch(err => {
  console.error("Error seeding bulk data:", err);
  process.exit(1);
});
