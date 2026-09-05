const db = require("../config/db");
const bcrypt = require("bcryptjs");

const DEFAULT_PASSWORD = process.env.BULK_UPLOAD_DEFAULT_PASSWORD || "DealFlow@2025";

const TEMPLATES = {
  products: {
    headers: ["name", "sku", "category", "description", "unit_price", "cost", "inventory_reference", "currency", "is_active"],
    sample: [
      {
        name: "Enterprise Server Rack 42U",
        sku: "HW-SRV-42U",
        category: "HARDWARE",
        description: "Heavy duty 42U server cabinet with ventilation and lock",
        unit_price: 65000,
        cost: 42000,
        inventory_reference: "BIN-A-102",
        currency: "INR",
        is_active: "TRUE"
      },
      {
        name: "DevOps Consulting Retainer",
        sku: "SVC-DEVOPS-RET",
        category: "SERVICE",
        description: "Monthly dedicated DevOps advisory and pipeline support",
        unit_price: 45000,
        cost: 18000,
        inventory_reference: "",
        currency: "INR",
        is_active: "TRUE"
      }
    ]
  },
  customers: {
    headers: ["full_name", "email", "company_name", "customer_tier", "password"],
    sample: [
      {
        full_name: "Vikram Malhotra",
        email: "vikram@apextech.com",
        company_name: "Apex Technologies Ltd",
        customer_tier: "GOLD",
        password: "DealFlow@2025"
      },
      {
        full_name: "Ananya Sharma",
        email: "ananya@solarisit.in",
        company_name: "Solaris Infotech",
        customer_tier: "SILVER",
        password: "DealFlow@2025"
      }
    ]
  },
  staff: {
    headers: ["full_name", "email", "employee_id", "role", "department", "password"],
    sample: [
      {
        full_name: "Rohan Kapoor",
        email: "rohan.kapoor@dealflow360.com",
        employee_id: "DF-REP-104",
        role: "SALES_REP",
        department: "Enterprise Sales",
        password: "DealFlow@2025"
      },
      {
        full_name: "Deepika Sen",
        email: "deepika.sen@dealflow360.com",
        employee_id: "DF-MGR-008",
        role: "SALES_MANAGER",
        department: "Sales Leadership",
        password: "DealFlow@2025"
      }
    ]
  },
  warehouses: {
    headers: ["name", "address", "latitude", "longitude"],
    sample: [
      {
        name: "Bangalore Central Hub",
        address: "Plot 42, Electronic City Phase 1, Bengaluru, Karnataka 560100",
        latitude: 12.8399,
        longitude: 77.677
      },
      {
        name: "Mumbai Logistics Terminal",
        address: "Sector 19, Vashi, Navi Mumbai, Maharashtra 400703",
        latitude: 19.076,
        longitude: 72.998
      }
    ]
  },
  quotations: {
    headers: ["customer_email", "sales_rep_email", "status", "product_sku", "quantity", "unit_price", "discount_percent"],
    sample: [
      {
        customer_email: "vikram@apextech.com",
        sales_rep_email: "rohan.kapoor@dealflow360.com",
        status: "DRAFT",
        product_sku: "HW-LP-2025",
        quantity: 5,
        unit_price: 85000,
        discount_percent: 5
      },
      {
        customer_email: "vikram@apextech.com",
        sales_rep_email: "rohan.kapoor@dealflow360.com",
        status: "DRAFT",
        product_sku: "SVC-SLA-5YR",
        quantity: 5,
        unit_price: 12000,
        discount_percent: 10
      }
    ]
  }
};

function getTemplateData(entity) {
  const tpl = TEMPLATES[entity.toLowerCase()];
  if (!tpl) {
    throw new Error(`Unknown entity '${entity}'. Supported: products, customers, staff, warehouses, quotations`);
  }
  return tpl;
}

function normalizeHeader(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, "_");
}

function parseCSV(csvString) {
  if (!csvString || typeof csvString !== "string") return [];
  const lines = csvString
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(normalizeHeader);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] !== undefined ? vals[idx] : "";
    });
    rows.push(row);
  }
  return rows;
}

// -------------------------------------------------------------
// Products Bulk Upload
// -------------------------------------------------------------
async function bulkUploadProducts(rows, adminUserId, ipAddress) {
  const VALID_CATEGORIES = ["HARDWARE", "SERVICE", "SUBSCRIPTION", "ELECTRONICS", "FURNITURE", "SOFTWARE", "SERVICES", "OTHER"];
  const results = { total: rows.length, success: 0, failed: 0, errors: [], imported: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];
    try {
      const name = (r.name || r.product_name || "").trim();
      const sku = (r.sku || r.product_sku || r.product_id || "").trim().toUpperCase();
      let category = (r.category || "HARDWARE").trim().toUpperCase();
      if (!VALID_CATEGORIES.includes(category)) {
        category = "OTHER";
      }

      const unitPrice = parseFloat(r.unit_price || r.price || r.selling_price || 0);
      const cost = parseFloat(r.cost || r.cost_price || 0);
      const description = (r.description || "").trim();
      const inventoryRef = (r.inventory_reference || r.inventory_ref || "").trim();
      const currency = (r.currency || "INR").trim().toUpperCase();
      const isActive = r.is_active !== undefined ? String(r.is_active).toUpperCase() !== "FALSE" : true;

      if (!name) throw new Error("Product name is required.");
      if (!sku) throw new Error("Product SKU is required.");
      if (isNaN(unitPrice) || unitPrice < 0) throw new Error("Valid non-negative unit_price is required.");
      if (isNaN(cost) || cost < 0) throw new Error("Valid non-negative cost is required.");

      const result = await db.query(
        `INSERT INTO public.products (
          name, sku, category, description, unit_price, cost, inventory_reference, currency, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (sku) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          description = COALESCE(EXCLUDED.description, public.products.description),
          unit_price = EXCLUDED.unit_price,
          cost = EXCLUDED.cost,
          inventory_reference = COALESCE(EXCLUDED.inventory_reference, public.products.inventory_reference),
          currency = EXCLUDED.currency,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, sku, category, unit_price, cost, is_active`,
        [name, sku, category, description || null, unitPrice, cost, inventoryRef || null, currency, isActive]
      );

      results.success++;
      results.imported.push(result.rows[0]);
    } catch (err) {
      results.failed++;
      results.errors.push({
        row: rowNum,
        identifier: r.sku || r.name || `Row #${rowNum}`,
        error: err.message
      });
    }
  }

  if (results.success > 0) {
    await db.query(
      `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        adminUserId,
        "BULK_PRODUCTS_IMPORTED",
        JSON.stringify({ total: results.total, imported: results.success, failed: results.failed }),
        ipAddress || null
      ]
    );
  }

  return results;
}

// -------------------------------------------------------------
// Customers Bulk Upload
// -------------------------------------------------------------
async function bulkUploadCustomers(rows, adminUserId, ipAddress) {
  const VALID_TIERS = ["BRONZE", "SILVER", "GOLD"];
  const results = { total: rows.length, success: 0, failed: 0, errors: [], imported: [] };

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];
    try {
      const fullName = (r.full_name || r.name || "").trim();
      const email = (r.email || "").trim().toLowerCase();
      const companyName = (r.company_name || r.company || "").trim();
      let customerTier = (r.customer_tier || r.tier || "BRONZE").trim().toUpperCase();
      if (!VALID_TIERS.includes(customerTier)) customerTier = "BRONZE";

      const password = (r.password || "").trim();
      const hash = password ? await bcrypt.hash(password, 10) : defaultHash;

      if (!fullName) throw new Error("Full name is required.");
      if (!email || !email.includes("@")) throw new Error("Valid email is required.");

      const result = await db.query(
        `INSERT INTO public.users (
          full_name, email, password_hash, company_name, customer_tier, role, status
        ) VALUES ($1, $2, $3, $4, $5, 'CUSTOMER', 'ACTIVE')
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          company_name = COALESCE(EXCLUDED.company_name, public.users.company_name),
          customer_tier = EXCLUDED.customer_tier,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, full_name, email, company_name, customer_tier, role, status`,
        [fullName, email, hash, companyName || null, customerTier]
      );

      results.success++;
      results.imported.push(result.rows[0]);
    } catch (err) {
      results.failed++;
      results.errors.push({
        row: rowNum,
        identifier: r.email || r.full_name || `Row #${rowNum}`,
        error: err.message
      });
    }
  }

  if (results.success > 0) {
    await db.query(
      `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        adminUserId,
        "BULK_CUSTOMERS_IMPORTED",
        JSON.stringify({ total: results.total, imported: results.success, failed: results.failed }),
        ipAddress || null
      ]
    );
  }

  return results;
}

// -------------------------------------------------------------
// Staff Bulk Upload
// -------------------------------------------------------------
async function bulkUploadStaff(rows, adminUserId, ipAddress) {
  const VALID_ROLES = ["SALES_REP", "SALES_MANAGER", "FINANCE", "OPERATIONS"];
  const results = { total: rows.length, success: 0, failed: 0, errors: [], imported: [] };

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];
    try {
      const fullName = (r.full_name || r.name || "").trim();
      const email = (r.email || "").trim().toLowerCase();
      let employeeId = (r.employee_id || r.staff_id || "").trim().toUpperCase();
      let role = (r.role || "SALES_REP").trim().toUpperCase();
      if (!VALID_ROLES.includes(role)) role = "SALES_REP";
      const department = (r.department || "Sales Operations").trim();

      if (!fullName) throw new Error("Full name is required.");
      if (!email || !email.includes("@")) throw new Error("Valid email is required.");
      if (!employeeId) {
        employeeId = `EMP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      }

      const password = (r.password || "").trim();
      const hash = password ? await bcrypt.hash(password, 10) : defaultHash;

      const result = await db.query(
        `INSERT INTO public.users (
          full_name, email, employee_id, password_hash, role, status, department
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          employee_id = EXCLUDED.employee_id,
          role = EXCLUDED.role,
          department = EXCLUDED.department,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, full_name, email, employee_id, role, status, department`,
        [fullName, email, employeeId, hash, role, department]
      );

      results.success++;
      results.imported.push(result.rows[0]);
    } catch (err) {
      results.failed++;
      results.errors.push({
        row: rowNum,
        identifier: r.email || r.employee_id || `Row #${rowNum}`,
        error: err.message
      });
    }
  }

  if (results.success > 0) {
    await db.query(
      `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        adminUserId,
        "BULK_STAFF_IMPORTED",
        JSON.stringify({ total: results.total, imported: results.success, failed: results.failed }),
        ipAddress || null
      ]
    );
  }

  return results;
}

// -------------------------------------------------------------
// Warehouses Bulk Upload
// -------------------------------------------------------------
async function bulkUploadWarehouses(rows, adminUserId, ipAddress) {
  const results = { total: rows.length, success: 0, failed: 0, errors: [], imported: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];
    try {
      const name = (r.name || r.warehouse_name || "").trim();
      const address = (r.address || "").trim();
      const latitude = parseFloat(r.latitude || r.lat || 0);
      const longitude = parseFloat(r.longitude || r.lng || r.long || 0);

      if (!name) throw new Error("Warehouse name is required.");
      if (!address) throw new Error("Address is required.");
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        throw new Error("Valid latitude (-90 to +90) is required.");
      }
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        throw new Error("Valid longitude (-180 to +180) is required.");
      }

      const existing = await db.query(
        "SELECT id FROM public.warehouses WHERE LOWER(name) = LOWER($1)",
        [name]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await db.query(
          `UPDATE public.warehouses
           SET address = $1, latitude = $2, longitude = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING id, name, address, latitude, longitude, is_active`,
          [address, latitude, longitude, existing.rows[0].id]
        );
      } else {
        result = await db.query(
          `INSERT INTO public.warehouses (name, address, latitude, longitude, created_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, address, latitude, longitude, is_active`,
          [name, address, latitude, longitude, adminUserId]
        );
      }

      results.success++;
      results.imported.push(result.rows[0]);
    } catch (err) {
      results.failed++;
      results.errors.push({
        row: rowNum,
        identifier: r.name || `Row #${rowNum}`,
        error: err.message
      });
    }
  }

  if (results.success > 0) {
    await db.query(
      `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        adminUserId,
        "BULK_WAREHOUSES_IMPORTED",
        JSON.stringify({ total: results.total, imported: results.success, failed: results.failed }),
        ipAddress || null
      ]
    );
  }

  return results;
}

// -------------------------------------------------------------
// Quotations Bulk Upload
// Groups rows by customer_email + sales_rep_email to form quotes
// -------------------------------------------------------------
async function bulkUploadQuotations(rows, adminUserId, ipAddress) {
  const results = { total: rows.length, success: 0, failed: 0, errors: [], imported: [] };

  const groups = new Map();
  rows.forEach((r, idx) => {
    const custEmail = (r.customer_email || r.customer || "").trim().toLowerCase();
    const repEmail = (r.sales_rep_email || r.rep_email || "").trim().toLowerCase();
    const key = `${custEmail}::${repEmail}`;
    if (!groups.has(key)) {
      groups.set(key, { custEmail, repEmail, items: [], rowNums: [] });
    }
    groups.get(key).items.push(r);
    groups.get(key).rowNums.push(idx + 1);
  });

  const client = await db.pool.connect();
  try {
    for (const [key, group] of groups.entries()) {
      try {
        if (!group.custEmail) throw new Error("customer_email is missing in group.");

        const custRes = await client.query(
          "SELECT id, full_name FROM public.users WHERE email = $1 AND role = 'CUSTOMER'",
          [group.custEmail]
        );
        if (custRes.rows.length === 0) {
          throw new Error(`Customer with email '${group.custEmail}' not found.`);
        }
        const customer = custRes.rows[0];

        let salesRepId = adminUserId;
        if (group.repEmail) {
          const repRes = await client.query(
            "SELECT id FROM public.users WHERE email = $1 AND role IN ('SALES_REP', 'SALES_MANAGER', 'ADMIN')",
            [group.repEmail]
          );
          if (repRes.rows.length > 0) {
            salesRepId = repRes.rows[0].id;
          }
        }

        let subtotal = 0;
        let discountTotal = 0;
        let totalCost = 0;
        const lineItems = [];

        for (const item of group.items) {
          const sku = (item.product_sku || item.sku || "").trim().toUpperCase();
          const quantity = parseInt(item.quantity || 1, 10);
          if (!sku) throw new Error("product_sku is required for quote line item.");
          if (isNaN(quantity) || quantity <= 0) throw new Error(`Invalid quantity '${item.quantity}' for SKU ${sku}.`);

          const prodRes = await client.query(
            "SELECT id, name, sku, unit_price, cost FROM public.products WHERE sku = $1 AND is_active = TRUE",
            [sku]
          );
          if (prodRes.rows.length === 0) {
            throw new Error(`Active product with SKU '${sku}' not found.`);
          }
          const product = prodRes.rows[0];

          const unitPrice = item.unit_price !== undefined && item.unit_price !== ""
            ? parseFloat(item.unit_price)
            : parseFloat(product.unit_price);
          const discountPercent = parseFloat(item.discount_percent || 0);

          const lineSubtotal = Number((unitPrice * quantity).toFixed(2));
          const lineDiscount = Number((lineSubtotal * (discountPercent / 100)).toFixed(2));
          const lineFinal = Number((lineSubtotal - lineDiscount).toFixed(2));
          const lineCost = Number((parseFloat(product.cost) * quantity).toFixed(2));

          subtotal += lineSubtotal;
          discountTotal += lineDiscount;
          totalCost += lineCost;

          lineItems.push({
            productId: product.id,
            quantity,
            unitPrice,
            discountPercent,
            discountAmount: lineDiscount,
            lineTotal: lineFinal
          });
        }

        const finalAmount = Number((subtotal - discountTotal).toFixed(2));
        const grossMargin = Number((finalAmount - totalCost).toFixed(2));
        const marginPercentage = finalAmount === 0 ? 0 : Number(((grossMargin / finalAmount) * 100).toFixed(2));

        const numRes = await client.query(
          `SELECT COUNT(*)::int + 1 AS next_num
           FROM public.quotations WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
        );
        const qNum = `QT-${new Date().getFullYear()}-${String(numRes.rows[0].next_num).padStart(4, "0")}`;

        const quoteInsert = await client.query(
          `INSERT INTO public.quotations (
            quotation_number, customer_id, sales_rep_id, status, subtotal,
            discount_amount, final_amount, total_cost, gross_margin, margin_percentage
          ) VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9)
          RETURNING id, quotation_number, status, final_amount, gross_margin, margin_percentage`,
          [qNum, customer.id, salesRepId, subtotal, discountTotal, finalAmount, totalCost, grossMargin, marginPercentage]
        );

        const quoteId = quoteInsert.rows[0].id;

        for (const it of lineItems) {
          await client.query(
            `INSERT INTO public.quotation_items (
              quotation_id, product_id, quantity, unit_price, discount_percent, discount_amount, line_total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [quoteId, it.productId, it.quantity, it.unitPrice, it.discountPercent, it.discountAmount, it.lineTotal]
          );
        }

        results.success += group.items.length;
        results.imported.push({
          quotationId: quoteId,
          quotationNumber: qNum,
          customer: customer.full_name,
          itemCount: lineItems.length,
          finalAmount
        });
      } catch (err) {
        results.failed += group.items.length;
        results.errors.push({
          row: group.rowNums.join(", "),
          identifier: `${group.custEmail}`,
          error: err.message
        });
      }
    }
  } finally {
    client.release();
  }

  if (results.success > 0) {
    await db.query(
      `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        adminUserId,
        "BULK_QUOTATIONS_IMPORTED",
        JSON.stringify({ total: results.total, imported: results.success, failed: results.failed }),
        ipAddress || null
      ]
    );
  }

  return results;
}

module.exports = {
  getTemplateData,
  parseCSV,
  bulkUploadProducts,
  bulkUploadCustomers,
  bulkUploadStaff,
  bulkUploadWarehouses,
  bulkUploadQuotations
};
