const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
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

    // Create indexes for performance if not exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
      CREATE INDEX IF NOT EXISTS idx_users_employee_id ON public.users(employee_id);
      CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
      CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
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
