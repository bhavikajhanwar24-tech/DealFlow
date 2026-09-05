const assert = require("assert");
const db = require("../src/config/db");
const complaintService = require("../src/services/complaint.service");

async function runTests() {
  console.log("Starting Staff Complaints integration test...");

  // 1. Fetch test customer, test staff, and test admin
  const customerRes = await db.query(
    "SELECT id, full_name, role FROM public.users WHERE role = 'CUSTOMER' LIMIT 1"
  );
  if (customerRes.rows.length === 0) {
    throw new Error("No customer user found for testing.");
  }
  const customer = customerRes.rows[0];

  const staffRes = await db.query(
    "SELECT id, full_name, role FROM public.users WHERE role IN ('SALES_REP', 'SALES_MANAGER') LIMIT 1"
  );
  if (staffRes.rows.length === 0) {
    throw new Error("No sales staff found for testing.");
  }
  const staff = staffRes.rows[0];

  const adminRes = await db.query(
    "SELECT id, full_name, role FROM public.users WHERE role = 'ADMIN' LIMIT 1"
  );
  if (adminRes.rows.length === 0) {
    throw new Error("No admin user found for testing.");
  }
  const admin = adminRes.rows[0];

  console.log(`Testing with Customer: ${customer.full_name} (${customer.id})`);
  console.log(`Testing with Staff: ${staff.full_name} (${staff.id}, ${staff.role})`);
  console.log(`Testing with Admin: ${admin.full_name} (${admin.id})`);

  // Test 1: getStaffMembers
  console.log("\n[Test 1] Fetching staff members...");
  const staffMembers = await complaintService.getStaffMembers();
  assert(Array.isArray(staffMembers), "Staff members should be an array");
  assert(staffMembers.length > 0, "Should have at least 1 staff member");
  console.log(`✓ Fetched ${staffMembers.length} staff members.`);

  // Test 2: createComplaint (Pending)
  console.log("\n[Test 2] Customer filing complaint...");
  const complaintData = {
    staff_id: staff.id,
    category: "COMMUNICATION",
    subject: "Automated Test Complaint - Unresponsive rep",
    description: "The sales rep took 5 business days to answer pricing queries on quote.",
  };
  const created = await complaintService.createComplaint(customer.id, complaintData, "127.0.0.1");
  assert(created.id, "Created complaint should have an id");
  assert.strictEqual(created.status, "PENDING", "Initial status must be PENDING");
  assert.strictEqual(created.subject, complaintData.subject);
  console.log(`✓ Complaint created with ID: ${created.id}`);

  // Test 3: getCustomerComplaints
  console.log("\n[Test 3] Customer viewing their filed complaints...");
  const myComplaints = await complaintService.getCustomerComplaints(customer.id);
  const found = myComplaints.find((c) => c.id === created.id);
  assert(found, "Customer complaints list must include the newly created complaint");
  assert.strictEqual(found.staff_name, staff.full_name);
  assert.strictEqual(found.status, "PENDING");
  console.log("✓ Customer can see their pending complaint with staff details.");

  // Test 4: getAdminComplaints & Stats
  console.log("\n[Test 4] Admin viewing all complaints and stats...");
  const stats = await complaintService.getAdminComplaintStats();
  assert(stats.total > 0, "Total complaints should be > 0");
  assert(stats.pending > 0, "Pending complaints should be > 0");
  console.log(`✓ Admin stats: Total = ${stats.total}, Pending = ${stats.pending}`);

  const adminComplaints = await complaintService.getAdminComplaints({ status: "PENDING" });
  const adminFound = adminComplaints.find((c) => c.id === created.id);
  assert(adminFound, "Admin list must contain the filed complaint");
  assert.strictEqual(adminFound.customer_name, customer.full_name);
  console.log("✓ Admin can view complaint with customer and staff details.");

  // Test 5: Admin takes action with message
  console.log("\n[Test 5] Admin taking action on complaint...");
  const actionMessage = "Reprimanded sales rep and re-routed discount approval to sales manager.";
  const resolved = await complaintService.takeActionOnComplaint(
    created.id,
    admin.id,
    actionMessage,
    "127.0.0.1"
  );
  assert.strictEqual(resolved.status, "ACTION_TAKEN");
  assert.strictEqual(resolved.admin_notes, actionMessage);
  assert(resolved.resolved_at, "resolved_at must be populated");
  console.log("✓ Complaint status updated to ACTION_TAKEN with admin resolution note.");

  // Test 6: Customer views resolved complaint
  console.log("\n[Test 6] Customer sees ACTION_TAKEN and admin note...");
  const customerUpdated = await complaintService.getCustomerComplaints(customer.id);
  const updatedFound = customerUpdated.find((c) => c.id === created.id);
  assert.strictEqual(updatedFound.status, "ACTION_TAKEN");
  assert.strictEqual(updatedFound.admin_notes, actionMessage);
  assert.strictEqual(updatedFound.resolver_name, admin.full_name);
  console.log(`✓ Customer sees admin response: "${updatedFound.admin_notes}"`);

  // Test 7: Create another complaint and test rejection
  console.log("\n[Test 7] Filing second complaint to test Admin rejection flow...");
  const complaint2 = await complaintService.createComplaint(
    customer.id,
    {
      staff_id: staff.id,
      category: "PRICING",
      subject: "Test Complaint 2 - Price too high",
      description: "Sales rep refused 60% discount on enterprise hardware.",
    },
    "127.0.0.1"
  );

  const rejectionReason = "Discount limits are strictly governed by enterprise policy. Rep followed rules.";
  const rejected = await complaintService.rejectComplaint(
    complaint2.id,
    admin.id,
    rejectionReason,
    "127.0.0.1"
  );
  assert.strictEqual(rejected.status, "REJECTED");
  assert.strictEqual(rejected.admin_notes, rejectionReason);
  console.log("✓ Complaint rejected with explanation.");

  const customerRejected = await complaintService.getCustomerComplaints(customer.id);
  const rejectedFound = customerRejected.find((c) => c.id === complaint2.id);
  assert.strictEqual(rejectedFound.status, "REJECTED");
  assert.strictEqual(rejectedFound.admin_notes, rejectionReason);
  console.log(`✓ Customer sees rejection reason: "${rejectedFound.admin_notes}"`);

  console.log("\nALL 7 STAFF COMPLAINT TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
