const nodemailer = require("nodemailer");

/**
 * Creates a Nodemailer transporter using Gmail SMTP credentials from process.env.
 * Never hardcodes credentials or exposes them to client responses.
 */
function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a confirmation email to the CUSTOMER when a quotation is finalized.
 *
 * @param {Object} params
 * @param {string} params.customerName - Name of the customer / company
 * @param {string} params.customerEmail - Destination Customer email address
 * @param {string} params.salespersonName - Full name of assigned salesperson
 * @param {string} params.salespersonEmail - Salesperson email address
 * @param {string} params.quotationNumber - E.g., QT-2026-0001
 * @param {number} params.totalAmount - Final quotation total amount
 * @param {number} params.marginPercentage - Gross margin percentage
 * @param {number} params.grossMargin - Gross margin in currency
 */
async function sendQuotationFinalizedEmail({
  customerName,
  customerEmail,
  salespersonName,
  salespersonEmail,
  quotationNumber,
  totalAmount,
  marginPercentage,
  grossMargin,
}) {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn(
        "[Email Service] EMAIL_USER or EMAIL_PASS not configured in backend/.env. Skipping email dispatch."
      );
      return {
        success: false,
        error: "SMTP credentials (EMAIL_USER / EMAIL_PASS) not configured",
      };
    }

    const recipientEmail = customerEmail || salespersonEmail;

    if (!recipientEmail) {
      console.warn(
        "[Email Service] No recipient email address provided for customer quotation finalization."
      );
      return { success: false, error: "No recipient email address available" };
    }

    const formattedAmount = `₹${Number(totalAmount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const formattedMargin = `${Number(marginPercentage || 0).toFixed(2)}% (₹${Number(
      grossMargin || 0
    ).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })})`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DealFlow360 — Quotation ${quotationNumber} Finalized</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 24px;
      color: #1e293b;
    }
    .email-card {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
    }
    .header-banner {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      padding: 28px 32px;
      color: #ffffff;
    }
    .brand-tag {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #93c5fd;
      margin-bottom: 6px;
    }
    .header-banner h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .content-body {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .intro-text {
      font-size: 14px;
      color: #475569;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .details-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px dashed #cbd5e1;
      font-size: 14px;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #64748b;
      font-weight: 600;
    }
    .detail-value {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      background: #dcfce7;
      color: #15803d;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      letter-spacing: 0.05em;
    }
    .next-steps {
      font-size: 14px;
      color: #334155;
      margin-top: 20px;
      line-height: 1.6;
    }
    .sign-off {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #f1f5f9;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="email-card">
    <div class="header-banner">
      <div class="brand-tag">DealFlow360</div>
      <h1>Quotation Finalized Successfully</h1>
    </div>
    <div class="content-body">
      <div class="greeting">Hello ${customerName || "Valued Customer"},</div>
      <div class="intro-text">
        Your quotation has been successfully finalized. Here are the confirmed quotation details for your records:
      </div>

      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Quotation Number:</span>
          <span class="detail-value" style="color: #2563eb;">${quotationNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Customer:</span>
          <span class="detail-value">${customerName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Amount:</span>
          <span class="detail-value" style="color: #2563eb;">${formattedAmount}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Margin:</span>
          <span class="detail-value" style="color: #059669;">${formattedMargin}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Sales Representative:</span>
          <span class="detail-value">${salespersonName} ${salespersonEmail ? `(${salespersonEmail})` : ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value"><span class="status-badge">FINALIZED</span></span>
        </div>
      </div>

      <div class="next-steps">
        You can now proceed with the next stage of the sales process.
      </div>

      <div class="sign-off">
        Regards,<br>
        <strong>DealFlow360 Sales Operations</strong>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const info = await transporter.sendMail({
      from: `"DealFlow360 Sales Operations" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `DealFlow360 — Quotation ${quotationNumber} Finalized`,
      html: htmlContent,
    });

    console.log(
      `[Email Service] Customer confirmation email sent for ${quotationNumber} to ${recipientEmail} (MessageId: ${info.messageId})`
    );

    return { success: true, messageId: info.messageId, email: recipientEmail };
  } catch (error) {
    console.error(
      `[Email Service Error] Failed to send customer email for ${quotationNumber}:`,
      error.message
    );
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendQuotationFinalizedEmail,
};
