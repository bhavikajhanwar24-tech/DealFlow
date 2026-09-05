const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/upload.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

// Authenticate and restrict to ADMIN
router.use(requireAuth);
router.use(requireActiveUser);
router.use(requireRole("ADMIN"));

// Download sample CSV template or schema JSON
router.get("/templates/:entity", uploadController.getTemplate);

// Upload rows (JSON array or CSV string) for entity
router.post("/:entity", uploadController.bulkUpload);

// One-click route to populate 200+ rows FOR EACH TABLE (Products, Customers, Staff, Warehouses, Quotations)
router.post("/seed/generate-dataset", async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const uploadService = require("../services/upload.service");

    const firstNames = [
      "Aarav", "Pooja", "Vikram", "Neha", "Rohan", "Sneha", "Aditya", "Priya", "Karan", "Divya",
      "Suresh", "Meera", "Anand", "Ritu", "Gaurav", "Nisha", "Rahul", "Kavita", "Sameer", "Swati",
      "Arjun", "Deepa", "Manish", "Shweta", "Rajesh", "Poonam", "Varun", "Sunita", "Tarun", "Aarti",
      "Kunal", "Bhavna", "Abhishek", "Preeti", "Siddharth", "Simran", "Naveen", "Jyoti", "Harsh", "Kajal"
    ];
    const lastNames = [
      "Sharma", "Verma", "Mehta", "Patel", "Reddy", "Nair", "Iyer", "Chopra", "Singhania", "Deshmukh",
      "Malhotra", "Kapoor", "Bhatia", "Joshi", "Bansal", "Saxena", "Agarwal", "Mishra", "Gupta", "Pandey",
      "Chauhan", "Yadav", "Trivedi", "Kulkarni", "Goswami", "Sen", "Roy", "Mukherjee", "Das", "Ghosh"
    ];
    const companies = [
      "Tata Consultancy Services", "Infosys Limited", "Wipro Digital", "HCL Tech Global", "Tech Mahindra",
      "Reliance Digital", "Bharti Airtel Enterprise", "Bajaj Finserv Tech", "L&T Infotech", "Zomato HQ",
      "Swiggy Delivery Corp", "Flipkart Commerce", "Razorpay Software", "Paytm Payments", "CRED Financial",
      "Delhivery Logistics", "Groww Investments", "PhonePe India", "Zerodha Broking", "Freshworks Cloud",
      "Zoho Corporation", "Postman Technologies", "Nykaa E-Commerce", "PolicyBazaar Group", "Pine Labs"
    ];

    // =========================================================================
    // 1. PRODUCTS: Exactly 200 items
    // =========================================================================
    const productCategories = ["HARDWARE", "SERVICE", "SUBSCRIPTION", "ELECTRONICS", "FURNITURE", "SOFTWARE"];
    const productBaseNames = [
      { name: "Pro Workstation X", cat: "HARDWARE", basePrice: 95000, baseCost: 65000, prefix: "HW-WS" },
      { name: "Edge AI Server", cat: "HARDWARE", basePrice: 145000, baseCost: 98000, prefix: "HW-EDG" },
      { name: "Managed 48-Port PoE Switch", cat: "HARDWARE", basePrice: 42000, baseCost: 28000, prefix: "HW-SWT" },
      { name: "NVMe Storage Array", cat: "HARDWARE", basePrice: 320000, baseCost: 210000, prefix: "HW-SAN" },
      { name: "Enterprise Dual-Band AP", cat: "HARDWARE", basePrice: 18000, baseCost: 11000, prefix: "HW-WAP" },
      { name: "Hardware Firewall Appliance", cat: "HARDWARE", basePrice: 78000, baseCost: 52000, prefix: "HW-FWL" },
      { name: "Rackmount UPS 10kVA", cat: "HARDWARE", basePrice: 115000, baseCost: 75000, prefix: "HW-UPS" },
      { name: "UltraWide 49-inch Curved Monitor", cat: "ELECTRONICS", basePrice: 88000, baseCost: 58000, prefix: "EL-DIS" },
      { name: "Ergonomic Mesh Task Chair", cat: "FURNITURE", basePrice: 18500, baseCost: 11000, prefix: "FN-CHR" },
      { name: "Motorized Standing Desk 72-inch", cat: "FURNITURE", basePrice: 34000, baseCost: 21000, prefix: "FN-DSK" },
      { name: "24/7 Dedicated NOC Support", cat: "SERVICE", basePrice: 35000, baseCost: 12000, prefix: "SVC-NOC" },
      { name: "Cybersecurity Vulnerability Audit", cat: "SERVICE", basePrice: 65000, baseCost: 22000, prefix: "SVC-SEC" },
      { name: "Zero-Downtime Migration Services", cat: "SERVICE", basePrice: 90000, baseCost: 38000, prefix: "SVC-MIG" },
      { name: "Disaster Recovery Drill & SLA", cat: "SERVICE", basePrice: 45000, baseCost: 16000, prefix: "SVC-BCP" },
      { name: "Datacenter Structured Cabling", cat: "SERVICE", basePrice: 28000, baseCost: 9500, prefix: "SVC-ENG" },
      { name: "Enterprise Cloud Subscription", cat: "SUBSCRIPTION", basePrice: 12000, baseCost: 2500, prefix: "SUB-ENT" },
      { name: "AI Predictive Analytics Suite", cat: "SUBSCRIPTION", basePrice: 18000, baseCost: 3500, prefix: "SUB-AIP" },
      { name: "Threat Intelligence Global Feed", cat: "SUBSCRIPTION", basePrice: 8500, baseCost: 1800, prefix: "SUB-THR" },
      { name: "SOC2 Compliance Automation License", cat: "SOFTWARE", basePrice: 15000, baseCost: 3000, prefix: "SW-SOC" },
      { name: "Automated Backup & DR Agent", cat: "SOFTWARE", basePrice: 6500, baseCost: 1200, prefix: "SW-BKP" }
    ];

    const productRows = [];
    for (let i = 1; i <= 200; i++) {
      const template = productBaseNames[(i - 1) % productBaseNames.length];
      const cycle = Math.floor((i - 1) / productBaseNames.length) + 1;
      const price = template.basePrice + (cycle - 1) * 2500;
      const cost = template.baseCost + (cycle - 1) * 1500;
      productRows.push({
        name: `${template.name} - Model ${String(i).padStart(3, "0")}`,
        sku: `${template.prefix}-${String(i).padStart(3, "0")}`,
        category: template.cat,
        description: `High performance enterprise ${template.cat.toLowerCase()} configuration variant #${i}.`,
        unit_price: price,
        cost: cost,
        inventory_reference: `RACK-${String.fromCharCode(65 + (i % 8))}-${100 + i}`,
        currency: "INR",
        is_active: "TRUE"
      });
    }
    const pResult = await uploadService.bulkUploadProducts(productRows, adminUserId, ip);

    // =========================================================================
    // 2. CUSTOMERS: Exactly 200 users
    // =========================================================================
    const customerTiers = ["GOLD", "SILVER", "BRONZE"];
    const customerRows = [];
    for (let i = 1; i <= 200; i++) {
      const fn = firstNames[(i * 3) % firstNames.length];
      const ln = lastNames[(i * 7) % lastNames.length];
      const comp = companies[i % companies.length];
      const tier = customerTiers[i % customerTiers.length];
      customerRows.push({
        full_name: `${fn} ${ln}`,
        email: `cust.${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@dealflow360corp.com`,
        company_name: `${comp} (Branch ${i})`,
        customer_tier: tier,
        password: "DealFlow@2025"
      });
    }
    const cResult = await uploadService.bulkUploadCustomers(customerRows, adminUserId, ip);

    // =========================================================================
    // 3. STAFF: Exactly 200 employees
    // =========================================================================
    const staffRoles = ["SALES_REP", "SALES_MANAGER", "FINANCE", "OPERATIONS"];
    const depts = ["Enterprise Sales", "Mid-Market Accounts", "Finance Operations", "Logistics & Fulfillment", "Strategic Solutions"];
    const staffRows = [];
    for (let i = 1; i <= 200; i++) {
      const fn = firstNames[(i * 5) % firstNames.length];
      const ln = lastNames[(i * 2) % lastNames.length];
      const role = staffRoles[i % staffRoles.length];
      const dept = depts[i % depts.length];
      staffRows.push({
        full_name: `${fn} ${ln}`,
        email: `staff.${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@dealflow360.com`,
        employee_id: `DF-EMP-${String(i).padStart(3, "0")}`,
        role,
        department: dept,
        password: "DealFlow@2025"
      });
    }
    const sResult = await uploadService.bulkUploadStaff(staffRows, adminUserId, ip);

    // =========================================================================
    // 4. WAREHOUSES: Exactly 200 distribution hubs
    // =========================================================================
    const cities = [
      { name: "Bengaluru", lat: 12.9716, lng: 77.5946, area: "Peenya Industrial Area" },
      { name: "Mumbai", lat: 19.0760, lng: 72.8777, area: "Bhiwandi Logistics Park" },
      { name: "Delhi NCR", lat: 28.7041, lng: 77.1025, area: "Manesar Hub Sector" },
      { name: "Hyderabad", lat: 17.3850, lng: 78.4867, area: "Shamshabad Cargo Corridor" },
      { name: "Chennai", lat: 13.0827, lng: 80.2707, area: "Sriperumbudur Industrial Zone" },
      { name: "Pune", lat: 18.5204, lng: 73.8567, area: "Chakan Auto Park" },
      { name: "Kolkata", lat: 22.5726, lng: 88.3639, area: "Dankuni Logistics Center" },
      { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, area: "Sanand GIDC Complex" },
      { name: "Jaipur", lat: 26.9124, lng: 75.7873, area: "Sitapura Industrial Area" },
      { name: "Indore", lat: 22.7196, lng: 75.8577, area: "Pithampur Logistics Bay" }
    ];
    const warehouseRows = [];
    for (let i = 1; i <= 200; i++) {
      const city = cities[(i - 1) % cities.length];
      const offset = Number(((i * 0.007) % 0.4).toFixed(4));
      const latSign = (i % 2 === 0) ? 1 : -1;
      const lngSign = (i % 3 === 0) ? 1 : -1;
      warehouseRows.push({
        name: `${city.name} Logistics Center #${String(i).padStart(3, "0")}`,
        address: `${city.area} Block ${String.fromCharCode(65 + (i % 6))}, Unit ${100 + i}, ${city.name}`,
        latitude: Number((city.lat + (latSign * offset)).toFixed(6)),
        longitude: Number((city.lng + (lngSign * offset)).toFixed(6))
      });
    }
    const wResult = await uploadService.bulkUploadWarehouses(warehouseRows, adminUserId, ip);

    // =========================================================================
    // 5. QUOTATIONS: Exactly 200 quotation rows
    // =========================================================================
    const salesReps = staffRows.filter(s => s.role === "SALES_REP");
    const quoteRows = [];
    for (let i = 1; i <= 200; i++) {
      const cust = customerRows[(i - 1) % customerRows.length];
      const rep = salesReps.length > 0 ? salesReps[(i - 1) % salesReps.length] : staffRows[0];
      const prod = productRows[(i * 3) % productRows.length];
      quoteRows.push({
        customer_email: cust.email,
        sales_rep_email: rep.email,
        status: "DRAFT",
        product_sku: prod.sku,
        quantity: 1 + (i % 10),
        unit_price: prod.unit_price,
        discount_percent: 2 + (i % 12)
      });
    }
    const qResult = await uploadService.bulkUploadQuotations(quoteRows, adminUserId, ip);

    const totalInserted = pResult.success + cResult.success + sResult.success + wResult.success + qResult.success;
    return res.status(200).json({
      success: true,
      message: `Successfully populated 200+ records into EVERY table (Total: ${totalInserted} rows)!`,
      summary: {
        totalRows: totalInserted,
        products: pResult.success,
        customers: cResult.success,
        staff: sResult.success,
        warehouses: wResult.success,
        quotations: qResult.success
      }
    });
  } catch (error) {
    console.error("Dataset generation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate dataset."
    });
  }
});

module.exports = router;
