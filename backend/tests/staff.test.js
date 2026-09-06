const pool = require("../src/config/db");
const authService = require("../src/services/auth.service");
const adminService = require("../src/services/admin.service");
const bcrypt = require("bcryptjs");

async function runStaffManagementTests() {
  console.log("===============================================================");
  console.log("   DEALFLOW360: STAFF MANAGEMENT & CREATION SYSTEM TESTS       ");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    await pool.initDatabase();

    // 1. Fetch admin user
    const client = await pool.pool.connect();
    let adminUser;
    try {
      const adminRes = await client.query("SELECT * FROM public.users WHERE role = 'ADMIN' LIMIT 1");
      if (adminRes.rows.length === 0) {
        throw new Error("No ADMIN user found in database for testing.");
      }
      adminUser = adminRes.rows[0];
    } finally {
      client.release();
    }

    console.log(`[1] Testing Public Registration Restrictions...`);
    try {
      await authService.registerEmployee({
        fullName: "Unauthorized Self Staff",
        employeeId: "EMP-UNAUTH-01",
        email: "unauth@company.com",
        password: "Password123!",
        department: "Sales",
        requestedRole: "SALES_REP"
      });
      assert(false, "Public staff self-registration should be rejected with 403");
    } catch (err) {
      assert(err.statusCode === 403, "Public staff registration blocked with HTTP 403");
      assert(
        err.message.includes("Public staff registration is disabled") || err.message.includes("Staff accounts are created directly"),
        "Polite administrator directive returned on public attempt"
      );
    }

    console.log(`\n[2] Testing Admin Staff Account Creation...`);
    const testEmployeeId = `STF-TEST-${Date.now().toString().slice(-4)}`;
    const testEmail = `staff.${Date.now()}@dealflow360.com`;
    const initialPassword = "SecureStaffPass123!";

    const createdStaff = await adminService.createStaff(
      {
        fullName: "Aarav Mehra",
        employeeId: testEmployeeId,
        email: testEmail,
        phone: "+91 98765 12345",
        designation: "Key Accounts Manager",
        department: "Sales",
        role: "SALES_REP",
        password: initialPassword
      },
      adminUser.id,
      "127.0.0.1"
    );

    assert(createdStaff.id !== undefined, "Staff member successfully created with valid ID");
    assert(createdStaff.full_name === "Aarav Mehra", "Staff full name matches input");
    assert(createdStaff.employee_id === testEmployeeId, "Staff employee ID matches input");
    assert(createdStaff.status === "ACTIVE", "New staff account defaults to ACTIVE status");
    assert(createdStaff.phone === "+91 98765 12345", "Staff phone persisted");
    assert(createdStaff.designation === "Key Accounts Manager", "Staff designation persisted");
    assert(createdStaff.password === undefined, "Password hash is never returned in staff response");

    console.log(`\n[3] Testing Password Hashing & Authentication...`);
    // Verify password is encrypted with bcrypt
    const fetchClient = await pool.pool.connect();
    let dbRecord;
    try {
      const res = await fetchClient.query("SELECT password_hash, status FROM public.users WHERE id = $1", [createdStaff.id]);
      dbRecord = res.rows[0];
    } finally {
      fetchClient.release();
    }

    assert(dbRecord.password_hash.startsWith("$2b$") || dbRecord.password_hash.startsWith("$2a$"), "Password is encrypted with bcrypt hash");
    const isBcryptMatch = await bcrypt.compare(initialPassword, dbRecord.password_hash);
    assert(isBcryptMatch === true, "Bcrypt verifies initial plaintext password against hash");

    // Test Login with newly created credentials
    const loginResult = await authService.loginUser(testEmail, initialPassword);
    assert(loginResult.user !== undefined, "Staff user can immediately log in with issued credentials");
    assert(loginResult.user.role === "SALES_REP", "Staff role is properly assigned on login");

    console.log(`\n[4] Testing Role Escalation Protection...`);
    try {
      await adminService.createStaff(
        {
          fullName: "Rogue Admin Attempt",
          employeeId: `EMP-ROGUE-${Date.now()}`,
          email: `rogue.${Date.now()}@company.com`,
          department: "IT",
          role: "ADMIN",
          password: "Password123!"
        },
        adminUser.id,
        "127.0.0.1"
      );
      assert(false, "Creating ADMIN accounts via staff management should be blocked");
    } catch (err) {
      assert(err.statusCode === 400 || err.statusCode === 403, "ADMIN role escalation blocked with HTTP 400/403");
    }

    console.log(`\n[5] Testing Duplicate Email & Employee ID Detection...`);
    try {
      await adminService.createStaff(
        {
          fullName: "Duplicate Email Person",
          employeeId: `STF-DIFF-${Date.now()}`,
          email: testEmail,
          department: "Sales",
          role: "SALES_REP",
          password: "Password123!"
        },
        adminUser.id,
        "127.0.0.1"
      );
      assert(false, "Duplicate email should be blocked");
    } catch (err) {
      assert(err.statusCode === 409, "Duplicate email rejected with HTTP 409 Conflict");
    }

    console.log(`\n[6] Testing Staff Directory Listing & Search/Filter...`);
    const allStaff = await adminService.getStaff({});
    assert(allStaff.length >= 1, "Staff listing returns array of staff members");

    const searchStaff = await adminService.getStaff({ search: "Aarav" });
    assert(searchStaff.some((s) => s.id === createdStaff.id), "Search query finds staff by full name");

    const deptStaff = await adminService.getStaff({ department: "Sales" });
    assert(deptStaff.every((s) => s.department === "Sales"), "Department filter correctly scopes results");

    console.log(`\n[7] Testing Staff Details Update...`);
    const updatedStaff = await adminService.updateStaff(
      createdStaff.id,
      {
        fullName: "Aarav Mehra (Senior)",
        phone: "+91 99999 88888",
        designation: "Principal Account Lead",
        department: "Sales",
        role: "SALES_MANAGER"
      },
      adminUser.id,
      "127.0.0.1"
    );

    assert(updatedStaff.full_name === "Aarav Mehra (Senior)", "Staff name updated successfully");
    assert(updatedStaff.designation === "Principal Account Lead", "Staff designation updated successfully");
    assert(updatedStaff.role === "SALES_MANAGER", "Staff role updated to SALES_MANAGER");

    console.log(`\n[8] Testing Soft Deactivation & Login Revocation...`);
    const deactivatedStaff = await adminService.toggleStaffStatus(createdStaff.id, "INACTIVE", adminUser.id, "127.0.0.1");
    assert(deactivatedStaff.status === "INACTIVE", "Staff status changed to INACTIVE");

    // Attempt login as deactivated user
    try {
      await authService.loginUser(testEmail, initialPassword);
      assert(false, "Deactivated staff user should not be allowed to log in");
    } catch (err) {
      assert(err.statusCode === 403, "Login denied with HTTP 403 for deactivated staff");
      assert(
        err.message.includes("Your account has been deactivated"),
        "Friendly deactivation message returned to user"
      );
    }

    console.log(`\n[9] Testing Account Reactivation & Password Reset...`);
    const reactivatedStaff = await adminService.toggleStaffStatus(createdStaff.id, "ACTIVE", adminUser.id, "127.0.0.1");
    assert(reactivatedStaff.status === "ACTIVE", "Staff status restored to ACTIVE");

    const newPassword = "BrandNewSecurePassword456!";
    await adminService.resetStaffPassword(createdStaff.id, newPassword, adminUser.id, "127.0.0.1");

    // Login with new password
    const newLoginResult = await authService.loginUser(testEmail, newPassword);
    assert(newLoginResult.user !== undefined, "Staff user can log in with newly reset password");

    console.log(`\n[10] Testing Audit Trail Verification...`);
    const auditClient = await pool.pool.connect();
    let auditLogs;
    try {
      const logsRes = await auditClient.query(
        "SELECT action, details FROM public.audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
        [adminUser.id]
      );
      auditLogs = logsRes.rows;
    } finally {
      auditClient.release();
    }

    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes("STAFF_CREATED"), "Audit trail captured STAFF_CREATED event");
    assert(actions.includes("STAFF_UPDATED") || actions.includes("STAFF_ROLE_CHANGED"), "Audit trail captured STAFF_UPDATED/STAFF_ROLE_CHANGED");
    assert(actions.includes("STAFF_DEACTIVATED"), "Audit trail captured STAFF_DEACTIVATED");
    assert(actions.includes("STAFF_ACTIVATED"), "Audit trail captured STAFF_ACTIVATED");
    assert(actions.includes("STAFF_PASSWORD_RESET"), "Audit trail captured STAFF_PASSWORD_RESET");

    // Cleanup test user
    const cleanupClient = await pool.pool.connect();
    try {
      await cleanupClient.query("DELETE FROM public.audit_logs WHERE details->>'staff_id' = $1", [createdStaff.id]);
      await cleanupClient.query("DELETE FROM public.users WHERE id = $1", [createdStaff.id]);
    } finally {
      cleanupClient.release();
    }

    console.log(`\n===============================================================`);
    console.log(`   TEST SUMMARY: ${passed} PASSED, ${failed} FAILED               `);
    console.log(`===============================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    if (pool.pool) {
      await pool.pool.end();
    }
  }
}

runStaffManagementTests();
