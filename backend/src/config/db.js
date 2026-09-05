const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

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
        customer_tier VARCHAR(30),
        approved_by UUID,
        approved_at TIMESTAMPTZ,
        rejected_by UUID,
        rejected_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.customer_tiers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO public.customer_tiers (name) VALUES ('BRONZE'), ('SILVER'), ('GOLD')
      ON CONFLICT (name) DO NOTHING;
    `);

    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS customer_tier VARCHAR(50)`);

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
      CREATE TABLE IF NOT EXISTS public.billing_configuration (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV-',
        payment_terms VARCHAR(20) NOT NULL DEFAULT 'NET_30',
        tax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 18 CHECK (default_tax_rate >= 0 AND default_tax_rate <= 100),
        invoice_due_period INTEGER NOT NULL DEFAULT 30 CHECK (invoice_due_period >= 0),
        updated_by UUID REFERENCES public.users(id),
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        billing_frequency VARCHAR(20) NOT NULL CHECK (billing_frequency IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
        discount_incentive NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_incentive >= 0 AND discount_incentive <= 100),
        status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(30) NOT NULL CHECK (category IN ('HARDWARE', 'SERVICE', 'SUBSCRIPTION')),
        description TEXT,
        unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price > 0),
        cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (cost > 0),
        inventory_reference VARCHAR(150),
        quantity INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.product_pairings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        paired_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        pairing_type VARCHAR(20) NOT NULL DEFAULT 'CROSS_SELL' CHECK (pairing_type IN ('UPSELL', 'CROSS_SELL')),
        priority INTEGER NOT NULL DEFAULT 0,
        promotion_tag VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (product_id, paired_product_id),
        CHECK (product_id <> paired_product_id)
      );
      ALTER TABLE public.product_pairings ADD COLUMN IF NOT EXISTS pairing_type VARCHAR(20) DEFAULT 'CROSS_SELL';

    `);

    await client.query(`
<<<<<<< HEAD
      DO $$
      BEGIN
        ALTER TABLE public.products
        DROP CONSTRAINT IF EXISTS products_category_check;
        
        ALTER TABLE public.products
        ADD CONSTRAINT products_category_check
        CHECK (category IN ('HARDWARE', 'SERVICE', 'SUBSCRIPTION', 'ELECTRONICS', 'FURNITURE', 'SOFTWARE', 'SERVICES', 'OTHER'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
=======
      CREATE TABLE IF NOT EXISTS public.product_promotions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        tag VARCHAR(100) NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
    `);


    await client.query(`
      ALTER TABLE public.products
      DROP CONSTRAINT IF EXISTS products_category_check
    `);

    await client.query(`
      ALTER TABLE public.products
      ADD CONSTRAINT products_category_check
      CHECK (category IN ('HARDWARE', 'SERVICE', 'SUBSCRIPTION', 'ELECTRONICS', 'FURNITURE', 'SOFTWARE', 'SERVICES', 'OTHER'))
>>>>>>> bd541dcf9c2c76578c98a28fbdbb81556b14381c
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
        total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
        gross_margin NUMERIC(14, 2) NOT NULL DEFAULT 0,
        margin_percentage NUMERIC(7, 2) NOT NULL DEFAULT 0 CHECK (margin_percentage >= -100 AND margin_percentage <= 100),
        risk_score NUMERIC(6, 3),
        risk_level VARCHAR(20),
        approval_route VARCHAR(40),
        risk_factors JSONB,
        risk_analysis JSONB,
        risk_analyzed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE public.quotations
      ADD COLUMN IF NOT EXISTS total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gross_margin NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(7, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS risk_score NUMERIC(6, 3),
      ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
      ADD COLUMN IF NOT EXISTS approval_route VARCHAR(40),
      ADD COLUMN IF NOT EXISTS risk_factors JSONB,
      ADD COLUMN IF NOT EXISTS risk_analysis JSONB,
      ADD COLUMN IF NOT EXISTS risk_analyzed_at TIMESTAMPTZ
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
      UPDATE public.quotations q
      SET total_cost = totals.total_cost,
          gross_margin = q.final_amount - totals.total_cost,
          margin_percentage = CASE
            WHEN q.final_amount = 0 THEN 0
            ELSE ROUND(((q.final_amount - totals.total_cost) / q.final_amount) * 100, 2)
          END
      FROM (
        SELECT qi.quotation_id, COALESCE(SUM(p.cost * qi.quantity), 0) AS total_cost
        FROM public.quotation_items qi
        JOIN public.products p ON p.id = qi.product_id
        GROUP BY qi.quotation_id
      ) totals
      WHERE q.id = totals.quotation_id
        AND q.total_cost = 0
        AND q.gross_margin = 0
        AND q.margin_percentage = 0
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
      CREATE TABLE IF NOT EXISTS public.customer_quote_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES public.users(id),
        requested_delivery_date DATE,
        customer_comment TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        quotation_id UUID REFERENCES public.quotations(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.customer_quote_request_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES public.customer_quote_requests(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES public.products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0)
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.discount_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_tier VARCHAR(20) NOT NULL CHECK (customer_tier IN ('BRONZE', 'SILVER', 'GOLD')),
        product_category VARCHAR(30) NOT NULL CHECK (product_category IN ('HARDWARE', 'SERVICE', 'SUBSCRIPTION', 'ELECTRONICS', 'FURNITURE', 'SOFTWARE', 'SERVICES', 'OTHER')),
        max_discount NUMERIC(5, 2) NOT NULL CHECK (max_discount >= 0 AND max_discount <= 100),
        status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT discount_policies_tier_category_unique UNIQUE (customer_tier, product_category)
      );
    `);

    await client.query(`
      ALTER TABLE public.discount_policies
      DROP CONSTRAINT IF EXISTS discount_policies_product_category_check
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        updated_by UUID REFERENCES public.users(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (warehouse_id, product_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(30) UNIQUE NOT NULL,
        quotation_id UUID NOT NULL UNIQUE REFERENCES public.quotations(id),
        customer_id UUID NOT NULL REFERENCES public.users(id),
        status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
        fulfillment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        delivery_address TEXT,
        delivery_city VARCHAR(100),
        delivery_state VARCHAR(100),
        delivery_zip VARCHAR(30),
        delivery_country VARCHAR(100),
        delivery_latitude NUMERIC(10, 7),
        delivery_longitude NUMERIC(10, 7),
        destination_submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS delivery_address TEXT,
      ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS delivery_state VARCHAR(100),
      ADD COLUMN IF NOT EXISTS delivery_zip VARCHAR(30),
      ADD COLUMN IF NOT EXISTS delivery_country VARCHAR(100),
      ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS destination_submitted_at TIMESTAMPTZ;
    `);

    await client.query(`
      ALTER TABLE public.warehouses
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS state VARCHAR(100);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES public.products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.fulfillment_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
        warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        allocation_type VARCHAR(20) NOT NULL DEFAULT 'RECOMMENDED',
        shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.backorders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.quotation_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES public.users(id),
        sender_role VARCHAR(50) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        recipient_role VARCHAR(50),
        recipient_id UUID REFERENCES public.users(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR(30) UNIQUE NOT NULL,
        order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES public.users(id),
        subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
        tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
        discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total NUMERIC(14, 2) NOT NULL DEFAULT 0,
        amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        due_date DATE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
        amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
        payment_method VARCHAR(50) NOT NULL,
        reference VARCHAR(100),
        payment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        recorded_by UUID REFERENCES public.users(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE public.quotation_messages
      ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.users(id)
    `);

    // Create indexes for performance if not exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
      CREATE INDEX IF NOT EXISTS idx_users_employee_id ON public.users(employee_id);
      CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
      CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
      CREATE INDEX IF NOT EXISTS idx_product_pairings_product ON public.product_pairings(product_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_product_promotions_product ON public.product_promotions(product_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_quotations_sales_rep ON public.quotations(sales_rep_id);
      CREATE INDEX IF NOT EXISTS idx_quotation_messages_quotation ON public.quotation_messages(quotation_id);
      CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);
      CREATE INDEX IF NOT EXISTS idx_negotiation_requests_quotation ON public.negotiation_requests(quotation_id);
      CREATE INDEX IF NOT EXISTS idx_negotiation_requests_customer ON public.negotiation_requests(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_quote_requests_customer ON public.customer_quote_requests(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_quote_requests_status ON public.customer_quote_requests(status);
      CREATE INDEX IF NOT EXISTS idx_customer_quote_request_items_request ON public.customer_quote_request_items(request_id);
      CREATE INDEX IF NOT EXISTS idx_warehouses_active ON public.warehouses(is_active);
      CREATE INDEX IF NOT EXISTS idx_discount_policies_lookup ON public.discount_policies(customer_tier, product_category, status);
      CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse ON public.warehouse_inventory(warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_product ON public.warehouse_inventory(product_id);
      CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);
      CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_order ON public.fulfillment_allocations(order_id);
      CREATE INDEX IF NOT EXISTS idx_backorders_order ON public.backorders(order_id);
    `);

    await client.query(`
      INSERT INTO public.discount_policies (customer_tier, product_category, max_discount)
      SELECT tier, category, CASE
        WHEN tier = 'BRONZE' AND category = 'FURNITURE' THEN 8
        WHEN tier = 'SILVER' AND category = 'FURNITURE' THEN 12
        WHEN tier = 'GOLD' AND category IN ('SUBSCRIPTION', 'SOFTWARE') THEN 20
        WHEN tier = 'GOLD' AND category = 'FURNITURE' THEN 18
        WHEN tier = 'GOLD' THEN 15
        WHEN tier = 'SILVER' THEN 10
        ELSE 5
      END
      FROM (VALUES ('BRONZE'), ('SILVER'), ('GOLD')) AS tiers(tier)
      CROSS JOIN (VALUES ('HARDWARE'), ('SERVICE'), ('SUBSCRIPTION'), ('ELECTRONICS'), ('FURNITURE'), ('SOFTWARE'), ('SERVICES'), ('OTHER')) AS categories(category)
      ON CONFLICT (customer_tier, product_category) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO public.products (name, sku, category, description, unit_price, cost)
      VALUES
        ('Laptop Pro', 'HW-LP-2025', 'HARDWARE', 'Enterprise mobile workstation', 85000, 55000),
        ('Workstation Ultra', 'HW-WS-ULTRA', 'HARDWARE', 'High-performance AI & computing workstation with dual GPU', 135000, 90000),
        ('Dock & Accessories Bundle', 'HW-ACC-DOCK', 'HARDWARE', 'Thunderbolt 4 dock with ergonomic wireless mouse and keyboard', 9500, 4500),
        ('Support Plan', 'SVC-SLA-5YR', 'SERVICE', '24/7 dedicated enterprise response SLA with 1-hour resolution guarantee', 12000, 3500),
        ('Onsite Deployment & Training', 'SVC-ONSITE-TRN', 'SERVICE', 'On-premises engineer setup and staff onboarding workshop', 25000, 9500),
        ('Cloud Pro', 'SUB-CLOUD-PRO', 'SUBSCRIPTION', 'Monthly cloud platform subscription with multi-region backup', 5000, 1200),
        ('Cloud Enterprise Security', 'SUB-SEC-ENT', 'SUBSCRIPTION', 'Advanced SOC2 compliance and automated threat protection', 8500, 2200)
      ON CONFLICT (sku) DO UPDATE SET 
        cost = CASE WHEN public.products.cost = 0 THEN EXCLUDED.cost ELSE public.products.cost END;
    `);

    // Ensure cost is updated if it was previously 0
    await client.query(`
      UPDATE public.products SET cost = 55000 WHERE sku = 'HW-LP-2025' AND (cost = 0 OR cost IS NULL);
      UPDATE public.products SET cost = 3500 WHERE sku = 'SVC-SLA-5YR' AND (cost = 0 OR cost IS NULL);
      UPDATE public.products SET cost = 1200 WHERE sku = 'SUB-CLOUD-PRO' AND (cost = 0 OR cost IS NULL);
    `);

    // Seed realistic product pairings (Upsell & Cross-Sell)
    await client.query(`
      INSERT INTO public.product_pairings (product_id, paired_product_id, pairing_type, priority, promotion_tag, is_active)
      SELECT p1.id, p2.id, 'UPSELL', 90, '⭐ Enterprise Upgrade Offer', TRUE
      FROM public.products p1, public.products p2
      WHERE p1.sku = 'HW-LP-2025' AND p2.sku = 'HW-WS-ULTRA'
      ON CONFLICT (product_id, paired_product_id) DO NOTHING;

      INSERT INTO public.product_pairings (product_id, paired_product_id, pairing_type, priority, promotion_tag, is_active)
      SELECT p1.id, p2.id, 'CROSS_SELL', 85, '🔥 10% Bundle Discount', TRUE
      FROM public.products p1, public.products p2
      WHERE p1.sku = 'HW-LP-2025' AND p2.sku = 'SVC-SLA-5YR'
      ON CONFLICT (product_id, paired_product_id) DO NOTHING;

      INSERT INTO public.product_pairings (product_id, paired_product_id, pairing_type, priority, promotion_tag, is_active)
      SELECT p1.id, p2.id, 'CROSS_SELL', 80, '🎁 Free Accessory with Workstation', TRUE
      FROM public.products p1, public.products p2
      WHERE p1.sku = 'HW-LP-2025' AND p2.sku = 'HW-ACC-DOCK'
      ON CONFLICT (product_id, paired_product_id) DO NOTHING;

      INSERT INTO public.product_pairings (product_id, paired_product_id, pairing_type, priority, promotion_tag, is_active)
      SELECT p1.id, p2.id, 'CROSS_SELL', 75, '💰 Save ₹2,000 on Cloud Combo', TRUE
      FROM public.products p1, public.products p2
      WHERE p1.sku = 'HW-LP-2025' AND p2.sku = 'SUB-CLOUD-PRO'
      ON CONFLICT (product_id, paired_product_id) DO NOTHING;

      INSERT INTO public.product_pairings (product_id, paired_product_id, pairing_type, priority, promotion_tag, is_active)
      SELECT p1.id, p2.id, 'UPSELL', 88, '🛡️ Security Tier Upgrade', TRUE
      FROM public.products p1, public.products p2
      WHERE p1.sku = 'SUB-CLOUD-PRO' AND p2.sku = 'SUB-SEC-ENT'
      ON CONFLICT (product_id, paired_product_id) DO NOTHING;

      INSERT INTO public.product_pairings (product_id, paired_product_id, pairing_type, priority, promotion_tag, is_active)
      SELECT p1.id, p2.id, 'CROSS_SELL', 70, NULL, TRUE
      FROM public.products p1, public.products p2
      WHERE p1.sku = 'SVC-SLA-5YR' AND p2.sku = 'SVC-ONSITE-TRN'
      ON CONFLICT (product_id, paired_product_id) DO NOTHING;
    `);

    // Seed product promotions
    await client.query(`
      INSERT INTO public.product_promotions (product_id, tag, priority, is_active, starts_at, ends_at)
      SELECT p.id, '🔥 10% Bundle Discount', 10, TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days'
      FROM public.products p WHERE p.sku = 'SVC-SLA-5YR'
      AND NOT EXISTS (SELECT 1 FROM public.product_promotions pp WHERE pp.product_id = p.id AND pp.tag = '🔥 10% Bundle Discount');

      INSERT INTO public.product_promotions (product_id, tag, priority, is_active, starts_at, ends_at)
      SELECT p.id, '🎁 Free Accessory Bundle', 8, TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '15 days'
      FROM public.products p WHERE p.sku = 'HW-ACC-DOCK'
      AND NOT EXISTS (SELECT 1 FROM public.product_promotions pp WHERE pp.product_id = p.id AND pp.tag = '🎁 Free Accessory Bundle');
    `);

    // Seed default Warehouses for Route Optimizer Demo if absent
    const whCheck = await client.query("SELECT COUNT(*)::int AS count FROM public.warehouses");
    if (whCheck.rows[0].count === 0) {
      const whMumbai = await client.query(
        `INSERT INTO public.warehouses (name, address, city, state, latitude, longitude, is_active)
         VALUES ('Mumbai Warehouse', 'Bandra Kurla Complex, Mumbai', 'Mumbai', 'Maharashtra', 19.0760, 72.8777, TRUE)
         RETURNING id`
      );
      const whPune = await client.query(
        `INSERT INTO public.warehouses (name, address, city, state, latitude, longitude, is_active)
         VALUES ('Pune Warehouse', 'Hinjewadi Tech Park, Pune', 'Pune', 'Maharashtra', 18.5204, 73.8567, TRUE)
         RETURNING id`
      );
      const whBlr = await client.query(
        `INSERT INTO public.warehouses (name, address, city, state, latitude, longitude, is_active)
         VALUES ('Bangalore Warehouse', 'Electronic City, Bengaluru', 'Bengaluru', 'Karnataka', 12.9716, 77.5946, TRUE)
         RETURNING id`
      );

      const laptop = await client.query("SELECT id FROM public.products WHERE sku = 'HW-LP-2025'");
      if (laptop.rows.length > 0) {
        const laptopId = laptop.rows[0].id;
        await client.query(
          `INSERT INTO public.warehouse_inventory (warehouse_id, product_id, quantity)
           VALUES ($1, $4, 40), ($2, $4, 10), ($3, $4, 30)
           ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [whMumbai.rows[0].id, whPune.rows[0].id, whBlr.rows[0].id, laptopId]
        );
      }
    } else {
      // Ensure city and state fields are filled if missing
      await client.query(`
        UPDATE public.warehouses SET city = 'Mumbai', state = 'Maharashtra' WHERE name ILIKE '%Mumbai%' AND city IS NULL;
        UPDATE public.warehouses SET city = 'Pune', state = 'Maharashtra' WHERE name ILIKE '%Pune%' AND city IS NULL;
        UPDATE public.warehouses SET city = 'Bengaluru', state = 'Karnataka' WHERE name ILIKE '%Bangalore%' AND city IS NULL;
      `);
    }

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
