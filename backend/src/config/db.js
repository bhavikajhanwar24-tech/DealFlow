const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const isLocalDB = process.env.DB_HOST === "localhost" || process.env.DB_HOST === "127.0.0.1";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log("Ensuring database tables exist in public schema...");

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        employee_id VARCHAR(100) UNIQUE,
        company_name VARCHAR(255),
        role VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
        department VARCHAR(100),
        approved_by UUID,
        approved_at TIMESTAMPTZ,
        rejected_by UUID,
        rejected_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        ip_address VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(30) NOT NULL CHECK (category IN ('HARDWARE', 'SERVICE', 'SUBSCRIPTION')),
        description TEXT,
        unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_number VARCHAR(30) UNIQUE NOT NULL,
        customer_id UUID NOT NULL REFERENCES public.users(id),
        sales_rep_id UUID NOT NULL REFERENCES public.users(id),
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        final_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quotation_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES public.products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
        discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
        discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        line_total NUMERIC(14, 2) NOT NULL DEFAULT 0
      );
    `);

    await client.query(`
      ALTER TABLE public.quotations
      ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.negotiation_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES public.users(id),
        requested_discount_percent NUMERIC(5, 2),
        requested_delivery_date DATE,
        customer_comment TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.warehouses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        latitude NUMERIC(10, 7) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
        longitude NUMERIC(10, 7) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID REFERENCES public.users(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for performance if not exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
      CREATE INDEX IF NOT EXISTS idx_users_employee_id ON public.users(employee_id);
      CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
      CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
      CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_quotations_sales_rep ON public.quotations(sales_rep_id);
      CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);
      CREATE INDEX IF NOT EXISTS idx_negotiation_requests_quotation ON public.negotiation_requests(quotation_id);
      CREATE INDEX IF NOT EXISTS idx_negotiation_requests_customer ON public.negotiation_requests(customer_id);
      CREATE INDEX IF NOT EXISTS idx_warehouses_active ON public.warehouses(is_active);
    `);

    await client.query(`
      INSERT INTO public.products (name, sku, category, description, unit_price)
      VALUES
        ('Laptop Pro', 'HW-LP-2025', 'HARDWARE', 'Enterprise mobile workstation', 85000),
        ('Support Plan', 'SVC-SLA-5YR', 'SERVICE', '24/7 dedicated enterprise response SLA', 12000),
        ('Cloud Pro', 'SUB-CLOUD-PRO', 'SUBSCRIPTION', 'Monthly cloud platform subscription', 5000)
      ON CONFLICT (sku) DO NOTHING;
    `);

    // Seed default Admin if not exists
    const adminCheck = await client.query(
      "SELECT id FROM public.users WHERE role = 'ADMIN' LIMIT 1"
    );

    if (adminCheck.rows.length === 0) {
      const defaultAdminEmail = "admin@dealflow360.com";
      const defaultAdminPass = "Admin@123456";
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(defaultAdminPass, salt);

      const inserted = await client.query(
        `INSERT INTO public.users (
          full_name, email, password_hash, employee_id, role, status, department
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          "System Administrator",
          defaultAdminEmail,
          hash,
          "ADM-001",
          "ADMIN",
          "ACTIVE",
          "Executive"
        ]
      );

      await client.query(
        `INSERT INTO public.audit_logs (user_id, action, details)
         VALUES ($1, $2, $3)`,
        [
          inserted.rows[0].id,
          "SYSTEM_INITIALIZED",
          JSON.stringify({ note: "Default Admin account created" })
        ]
      );

      console.log(`Default Admin seeded successfully: ${defaultAdminEmail} / ${defaultAdminPass}`);
    } else {
      console.log("Admin account already exists.");
    }

    console.log("Database schema initialized successfully.");
  } catch (err) {
    console.error("Error during database initialization:", err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDatabase
};
