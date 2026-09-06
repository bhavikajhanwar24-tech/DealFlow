const pool = require("../config/db");

// 1. Get Deal Health
exports.getDealHealth = async (req, res) => {
  try {
    const dealsRes = await pool.query(`
      SELECT 
        q.id, q.quotation_number, q.risk_score, q.risk_level, q.approval_route, q.margin_percentage, q.discount_amount, q.final_amount, q.status, q.updated_at,
        u.full_name as customer_name
      FROM public.quotations q
      JOIN public.users u ON q.customer_id = u.id
      WHERE q.status NOT IN ('CANCELLED', 'REJECTED')
      ORDER BY q.updated_at DESC
    `);

    const deals = dealsRes.rows.map(deal => {
      let score = 100;
      let reasons = [];

      const rawRiskScore = deal.risk_score !== null && deal.risk_score !== undefined ? Number(deal.risk_score) : 0;
      const riskScoreFormatted = rawRiskScore.toFixed(1);
      const riskLevel = deal.risk_level || (rawRiskScore > 60 ? 'HIGH' : rawRiskScore > 30 ? 'MEDIUM' : 'LOW');

      // Reason: High Discount
      const discountPercent = deal.final_amount > 0 ? (Number(deal.discount_amount) / (Number(deal.final_amount) + Number(deal.discount_amount))) * 100 : 0;
      if (discountPercent > 15) {
        score -= 20;
        reasons.push("High discount (>" + discountPercent.toFixed(1) + "%)");
      }

      // Reason: High Risk Score from Risk Engine
      if (rawRiskScore > 60) {
        score -= 30;
        reasons.push("High risk score (" + riskScoreFormatted + ")");
      } else if (rawRiskScore > 35) {
        score -= 10;
        reasons.push("Moderate risk score (" + riskScoreFormatted + ")");
      }

      // Reason: Low margin
      if (deal.margin_percentage && Number(deal.margin_percentage) < 25) {
        score -= 15;
        reasons.push("Low margin (<25%)");
      }

      // Reason: Pending Approval for long
      if (deal.status === 'PENDING_APPROVAL') {
        const daysPending = Math.floor((new Date() - new Date(deal.updated_at)) / (1000 * 60 * 60 * 24));
        if (daysPending > 2) {
          score -= 15;
          reasons.push(`Approval pending for ${daysPending} days`);
        }
      }

      // Cap score
      if (score < 0) score = 0;

      let healthStatus = 'HEALTHY';
      if (score < 50) healthStatus = 'CRITICAL';
      else if (score < 80) healthStatus = 'AT RISK';

      return {
        ...deal,
        risk_score: riskScoreFormatted,
        risk_level: riskLevel,
        healthScore: score,
        healthStatus,
        reasons,
        discountPercent: discountPercent.toFixed(2) + '%'
      };
    });

    res.json({ success: true, data: deals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error calculating deal health", error: error.message });
  }
};

// 2. Get Reports
exports.getReports = async (req, res) => {
  try {
    const { dateRange, salesRep } = req.query;

    let timeFilter = "1=1";
    if (dateRange === '30') timeFilter = "q.created_at >= NOW() - INTERVAL '30 days'";
    else if (dateRange === '90') timeFilter = "q.created_at >= NOW() - INTERVAL '90 days'";

    let repFilter = "1=1";
    if (salesRep && salesRep !== 'All') {
      repFilter = `q.sales_rep_id = '${salesRep}'`;
    }

    // A. Sales KPIs
    const kpiRes = await pool.query(`
      SELECT 
        COUNT(q.id) as total_quotes,
        SUM(CASE WHEN q.status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_deals,
        SUM(CASE WHEN q.status = 'CONFIRMED' THEN q.final_amount ELSE 0 END) as total_revenue,
        SUM(q.discount_amount) as total_discount,
        AVG(q.discount_amount) as avg_discount
      FROM public.quotations q
      WHERE ${timeFilter} AND ${repFilter}
    `);

    // B. Complete Staff Performance Across All Categories & Roles
    let quoteTimeFilter = "1=1";
    if (dateRange === '30') quoteTimeFilter = "q.created_at >= NOW() - INTERVAL '30 days'";
    else if (dateRange === '90') quoteTimeFilter = "q.created_at >= NOW() - INTERVAL '90 days'";

    const repPerfRes = await pool.query(`
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.employee_id,
        COALESCE(u.department, 'Sales') as department,
        u.role,
        u.status,
        COUNT(q.id)::int as total_deals,
        COUNT(CASE WHEN q.status = 'CONFIRMED' THEN 1 END)::int as won_deals,
        COALESCE(SUM(CASE WHEN q.status = 'CONFIRMED' THEN q.final_amount ELSE 0 END), 0)::numeric as revenue,
        COALESCE(SUM(q.final_amount), 0)::numeric as total_pipeline_value,
        COALESCE(SUM(q.discount_amount), 0)::numeric as discount
      FROM public.users u
      LEFT JOIN public.quotations q ON q.sales_rep_id = u.id AND (${quoteTimeFilter})
      WHERE u.role != 'CUSTOMER'
      GROUP BY u.id, u.full_name, u.email, u.employee_id, u.department, u.role, u.status
      ORDER BY revenue DESC, total_deals DESC, u.full_name ASC
    `);

    // Department Breakdown
    const deptBreakdownRes = await pool.query(`
      SELECT 
        COALESCE(u.department, u.role) as name,
        COUNT(DISTINCT u.id)::int as staff_count,
        COUNT(q.id)::int as deals_count,
        COALESCE(SUM(CASE WHEN q.status = 'CONFIRMED' THEN q.final_amount ELSE 0 END), 0)::numeric as revenue
      FROM public.users u
      LEFT JOIN public.quotations q ON q.sales_rep_id = u.id AND (${quoteTimeFilter})
      WHERE u.role != 'CUSTOMER'
      GROUP BY COALESCE(u.department, u.role)
      ORDER BY staff_count DESC
    `);

    // C. Top Products
    const productRes = await pool.query(`
      SELECT 
        p.name,
        SUM(qi.quantity) as quantity_sold,
        SUM(qi.line_total) as revenue
      FROM public.quotation_items qi
      JOIN public.products p ON qi.product_id = p.id
      JOIN public.quotations q ON qi.quotation_id = q.id
      WHERE q.status = 'CONFIRMED' AND ${timeFilter} AND ${repFilter}
      GROUP BY p.name
      ORDER BY revenue DESC
      LIMIT 5
    `);
    
    // D. Approvals
    const approvalRes = await pool.query(`
      SELECT 
        SUM(CASE WHEN status = 'PENDING_APPROVAL' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
      FROM public.quotations q
      WHERE ${timeFilter} AND ${repFilter}
    `);

    // E. Real Monthly Trends
    const monthlyTrendRes = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', q.created_at), 'Mon') as month,
        DATE_TRUNC('month', q.created_at) as month_date,
        COUNT(q.id) as total_quotes,
        COALESCE(SUM(q.final_amount), 0)::numeric as revenue,
        COALESCE(SUM(q.final_amount * (COALESCE(q.margin_percentage, 25) / 100)), 0)::numeric as margin,
        COALESCE(SUM(q.discount_amount), 0)::numeric as discount
      FROM public.quotations q
      WHERE ${timeFilter} AND ${repFilter}
      GROUP BY DATE_TRUNC('month', q.created_at)
      ORDER BY month_date ASC
    `);

    // F. Real Pipeline Funnel by Status
    const pipelineRes = await pool.query(`
      SELECT 
        status,
        COUNT(id)::int as count,
        COALESCE(SUM(final_amount), 0)::numeric as total_value
      FROM public.quotations q
      WHERE ${timeFilter} AND ${repFilter}
      GROUP BY status
    `);

    // G. Real Category Distribution
    const categoryRes = await pool.query(`
      SELECT 
        COALESCE(p.category, 'General') as name,
        COUNT(DISTINCT p.id)::int as count,
        COALESCE(SUM(p.unit_price * p.stock_quantity), 0)::numeric as value
      FROM public.products p
      GROUP BY p.category
      ORDER BY value DESC
    `);

    res.json({
      success: true,
      data: {
        kpis: kpiRes.rows[0],
        salesRepPerformance: repPerfRes.rows,
        topProducts: productRes.rows,
        approvals: approvalRes.rows[0],
        monthlyTrends: monthlyTrendRes.rows,
        pipelineFunnel: pipelineRes.rows,
        categoryBreakdown: categoryRes.rows,
        departmentBreakdown: deptBreakdownRes.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error generating reports", error: error.message });
  }
};

// 3. Get Activity Feed
exports.getActivityFeed = async (req, res) => {
  try {
    const activityRes = await pool.query(`
      SELECT 
        a.*, u.full_name as actor_name
      FROM public.audit_logs a
      LEFT JOIN public.users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `);

    res.json({ success: true, data: activityRes.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching activity feed", error: error.message });
  }
};
