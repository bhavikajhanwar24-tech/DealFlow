const db = require("../config/db");
const aiService = require("./ai.service");

/**
 * Service handling Staff Complaints submitted by Customers to Admin
 */

async function getStaffMembers() {
  const result = await db.query(
    `SELECT id, full_name, email, employee_id, role, department
     FROM public.users
     WHERE role IN ('SALES_REP', 'SALES_MANAGER', 'OPERATIONS', 'FINANCE', 'ADMIN')
       AND status = 'ACTIVE'
     ORDER BY full_name ASC`
  );
  return result.rows;
}

async function createComplaint(customerId, data, ipAddress = null) {
  const { staff_id, quotation_id, category, subject, description } = data;

  if (!staff_id) {
    const error = new Error("Staff member ID is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!subject || !subject.trim()) {
    const error = new Error("Complaint subject is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!description || !description.trim()) {
    const error = new Error("Complaint description is required.");
    error.statusCode = 400;
    throw error;
  }

  // Fetch customer details
  const custCheck = await db.query(
    `SELECT id, full_name, email, company_name FROM public.users WHERE id = $1`,
    [customerId]
  );
  const customer = custCheck.rows[0] || { full_name: "Customer" };

  // Verify staff exists and is active internal user
  const staffCheck = await db.query(
    `SELECT id, full_name, email, role, department FROM public.users WHERE id = $1`,
    [staff_id]
  );
  if (staffCheck.rows.length === 0) {
    const error = new Error("Selected staff member does not exist.");
    error.statusCode = 404;
    throw error;
  }

  const staff = staffCheck.rows[0];

  // If quotation_id provided, verify it belongs to this customer
  let validQuotationId = null;
  let quotationNumber = null;
  if (quotation_id) {
    const quoteCheck = await db.query(
      `SELECT id, quotation_number FROM public.quotations WHERE id = $1 AND customer_id = $2`,
      [quotation_id, customerId]
    );
    if (quoteCheck.rows.length > 0) {
      validQuotationId = quoteCheck.rows[0].id;
      quotationNumber = quoteCheck.rows[0].quotation_number;
    }
  }

  const cleanCategory = (category || "GENERAL").trim().toUpperCase();

  // Run AI Grievance & Compliance Screener
  let aiResult = {
    is_relevant: true,
    confidence_score: 80.0,
    classification: "GENUINE_COMPLAINT",
    reason: "Submitted for manual administrative review.",
    suggested_priority: "MEDIUM",
    suggested_action: "Review customer grievance and staff response.",
  };

  try {
    aiResult = await aiService.evaluateComplaint({
      customer,
      staff,
      category: cleanCategory,
      subject: subject.trim(),
      description: description.trim(),
      quotationNumber,
    });
  } catch (aiErr) {
    console.warn("[Complaint AI Screener] Non-fatal AI evaluation error:", aiErr?.message);
  }

  const isAutoRejected = !aiResult.is_relevant;
  const initialStatus = isAutoRejected ? "REJECTED" : "PENDING";
  const adminNotes = isAutoRejected
    ? `[AI Auto-Rejected] ${aiResult.reason || "Submission identified as irrelevant / non-business timepass without legitimate staff grievance."}`
    : null;
  const resolvedAt = isAutoRejected ? new Date() : null;

  const insertResult = await db.query(
    `INSERT INTO public.staff_complaints
      (customer_id, staff_id, quotation_id, category, subject, description, status,
       admin_notes, resolved_at, ai_evaluated, ai_is_relevant, ai_relevance_score,
       ai_classification, ai_reason, ai_suggested_priority, ai_suggested_action,
       auto_rejected_by_ai, ai_analyzed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      customerId,
      staff_id,
      validQuotationId,
      cleanCategory,
      subject.trim(),
      description.trim(),
      initialStatus,
      adminNotes,
      resolvedAt,
      true, // ai_evaluated
      aiResult.is_relevant,
      aiResult.confidence_score,
      aiResult.classification,
      aiResult.reason,
      aiResult.suggested_priority,
      aiResult.suggested_action,
      isAutoRejected,
    ]
  );

  const created = insertResult.rows[0];

  // Record audit log
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      customerId,
      isAutoRejected ? "STAFF_COMPLAINT_AUTO_REJECTED_BY_AI" : "STAFF_COMPLAINT_LODGED_AI_VERIFIED",
      JSON.stringify({
        complaintId: created.id,
        staffId: staff.id,
        staffName: staff.full_name,
        category: cleanCategory,
        subject: created.subject,
        aiClassification: aiResult.classification,
        aiRelevant: aiResult.is_relevant,
        status: initialStatus,
      }),
      ipAddress,
    ]
  );

  return {
    ...created,
    is_auto_rejected: isAutoRejected,
    ai_result: aiResult,
  };
}

async function getCustomerComplaints(customerId) {
  const result = await db.query(
    `SELECT
       c.id,
       c.category,
       c.subject,
       c.description,
       c.status,
       c.admin_notes,
       c.resolved_at,
       c.created_at,
       c.updated_at,
       c.quotation_id,
       c.ai_evaluated,
       c.ai_is_relevant,
       c.ai_relevance_score,
       c.ai_classification,
       c.ai_reason,
       c.ai_suggested_priority,
       c.ai_suggested_action,
       c.auto_rejected_by_ai,
       c.ai_analyzed_at,
       s.id AS staff_id,
       s.full_name AS staff_name,
       s.email AS staff_email,
       s.role AS staff_role,
       s.employee_id AS staff_employee_id,
       q.quotation_number,
       admin.full_name AS resolver_name
     FROM public.staff_complaints c
     JOIN public.users s ON s.id = c.staff_id
     LEFT JOIN public.quotations q ON q.id = c.quotation_id
     LEFT JOIN public.users admin ON admin.id = c.resolved_by
     WHERE c.customer_id = $1
     ORDER BY c.created_at DESC`,
    [customerId]
  );

  return result.rows;
}

async function getAdminComplaints(filters = {}) {
  const { status, search } = filters;

  let query = `
    SELECT
      c.id,
      c.category,
      c.subject,
      c.description,
      c.status,
      c.admin_notes,
      c.resolved_at,
      c.created_at,
      c.updated_at,
      c.quotation_id,
      c.ai_evaluated,
      c.ai_is_relevant,
      c.ai_relevance_score,
      c.ai_classification,
      c.ai_reason,
      c.ai_suggested_priority,
      c.ai_suggested_action,
      c.auto_rejected_by_ai,
      c.ai_analyzed_at,
      cust.id AS customer_id,
      cust.full_name AS customer_name,
      cust.email AS customer_email,
      cust.company_name AS customer_company,
      s.id AS staff_id,
      s.full_name AS staff_name,
      s.email AS staff_email,
      s.role AS staff_role,
      s.employee_id AS staff_employee_id,
      q.quotation_number,
      admin.full_name AS resolver_name,
      admin.email AS resolver_email
    FROM public.staff_complaints c
    JOIN public.users cust ON cust.id = c.customer_id
    JOIN public.users s ON s.id = c.staff_id
    LEFT JOIN public.quotations q ON q.id = c.quotation_id
    LEFT JOIN public.users admin ON admin.id = c.resolved_by
    WHERE 1=1
  `;

  const values = [];

  if (status && status !== "ALL") {
    values.push(status);
    query += ` AND c.status = $${values.length}`;
  }

  if (search && search.trim()) {
    values.push(`%${search.trim()}%`);
    const idx = values.length;
    query += ` AND (
      cust.full_name ILIKE $${idx} OR
      cust.company_name ILIKE $${idx} OR
      s.full_name ILIKE $${idx} OR
      c.subject ILIKE $${idx} OR
      c.ai_reason ILIKE $${idx} OR
      q.quotation_number ILIKE $${idx}
    )`;
  }

  query += ` ORDER BY c.created_at DESC`;

  const result = await db.query(query, values);
  return result.rows;
}

async function getAdminComplaintStats() {
  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'ACTION_TAKEN')::int AS action_taken,
      COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE auto_rejected_by_ai = TRUE)::int AS auto_rejected_ai
    FROM public.staff_complaints
  `);

  return result.rows[0] || { total: 0, pending: 0, action_taken: 0, rejected: 0, auto_rejected_ai: 0 };
}

async function takeActionOnComplaint(complaintId, adminId, adminNotes, ipAddress = null) {
  if (!adminNotes || !adminNotes.trim()) {
    const error = new Error("Please provide resolution / action details for the customer.");
    error.statusCode = 400;
    throw error;
  }

  // Ensure complaint exists
  const check = await db.query(
    `SELECT id, customer_id, staff_id, subject FROM public.staff_complaints WHERE id = $1`,
    [complaintId]
  );
  if (check.rows.length === 0) {
    const error = new Error("Complaint not found.");
    error.statusCode = 404;
    throw error;
  }

  const result = await db.query(
    `UPDATE public.staff_complaints
     SET status = 'ACTION_TAKEN',
         admin_notes = $1,
         resolved_by = $2,
         resolved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [adminNotes.trim(), adminId, complaintId]
  );

  const updated = result.rows[0];

  // Audit log
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminId,
      "STAFF_COMPLAINT_ACTION_TAKEN",
      JSON.stringify({
        complaintId: updated.id,
        customerId: updated.customer_id,
        staffId: updated.staff_id,
        adminNotes: adminNotes.trim(),
      }),
      ipAddress,
    ]
  );

  return updated;
}

async function rejectComplaint(complaintId, adminId, adminNotes, ipAddress = null) {
  if (!adminNotes || !adminNotes.trim()) {
    const error = new Error("Please provide a reason for rejecting the complaint.");
    error.statusCode = 400;
    throw error;
  }

  const check = await db.query(
    `SELECT id, customer_id, staff_id, subject FROM public.staff_complaints WHERE id = $1`,
    [complaintId]
  );
  if (check.rows.length === 0) {
    const error = new Error("Complaint not found.");
    error.statusCode = 404;
    throw error;
  }

  const result = await db.query(
    `UPDATE public.staff_complaints
     SET status = 'REJECTED',
         admin_notes = $1,
         resolved_by = $2,
         resolved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [adminNotes.trim(), adminId, complaintId]
  );

  const updated = result.rows[0];

  // Audit log
  await db.query(
    `INSERT INTO public.audit_logs (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      adminId,
      "STAFF_COMPLAINT_REJECTED",
      JSON.stringify({
        complaintId: updated.id,
        customerId: updated.customer_id,
        staffId: updated.staff_id,
        rejectionReason: adminNotes.trim(),
      }),
      ipAddress,
    ]
  );

  return updated;
}

module.exports = {
  getStaffMembers,
  createComplaint,
  getCustomerComplaints,
  getAdminComplaints,
  getAdminComplaintStats,
  takeActionOnComplaint,
  rejectComplaint,
};
