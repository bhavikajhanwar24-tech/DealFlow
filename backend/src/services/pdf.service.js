const PDFDocument = require("pdfkit");

/**
 * Formats a numeric value into INR currency string
 */
function formatCurrency(val) {
  return `INR ${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateVal) {
  if (!dateVal) return "N/A";
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? String(dateVal) : d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Generates an invoice PDF as a Buffer using PDFKit
 * @param {Object} invoice - complete invoice record with items, customer, and payment details
 * @returns {Promise<Buffer>}
 */
function generateInvoicePDF(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
        info: {
          Title: `Invoice - ${invoice.invoice_number}`,
          Author: "DealFlow360 Enterprise",
          Subject: `Official Tax Invoice for Order ${invoice.order_number || ""}`,
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const company = invoice.company_snapshot || {
        name: "DealFlow360 Enterprise Solutions",
        address: "7th Floor, Innovation Tower, Cyber City, Bangalore - 560100, India",
        email: "billing@dealflow360.com",
        phone: "+91 80 4567 8900",
        gstin: "29AABCD9081E1ZR",
      };

      const customer = invoice.customer_snapshot || {
        name: invoice.customer_name || "Valued Customer",
        company: invoice.company_name || "",
        email: invoice.customer_email || "",
      };

      const billTo = invoice.billing_address || {};
      const shipTo = invoice.shipping_address || {};

      // ----------------------------------------------------
      // TOP BRANDING & HEADER
      // ----------------------------------------------------
      // Top colored bar
      doc.rect(40, 40, 515, 6).fill("#2563eb");

      // Company Info (Left)
      doc.fillColor("#0f172a").fontSize(18).font("Helvetica-Bold").text(company.name || "DealFlow360", 40, 56);
      doc.fontSize(8.5).font("Helvetica").fillColor("#64748b");
      doc.text(company.address || "DealFlow360 Tech Park, Bengaluru, India", 40, 78, { width: 280 });
      doc.text(`Email: ${company.email || "billing@dealflow360.com"}  |  Phone: ${company.phone || "+91 80 4567 8900"}`, 40, 96);
      doc.text(`GSTIN / Tax ID: ${company.gstin || "29AABCD9081E1ZR"}`, 40, 108);

      // Invoice Meta (Right)
      doc.fillColor("#1e3a8a").fontSize(22).font("Helvetica-Bold").text("TAX INVOICE", 340, 56, { align: "right" });
      doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text(`Invoice #: ${invoice.invoice_number}`, 340, 82, { align: "right" });
      doc.fontSize(8.5).font("Helvetica").fillColor("#475569");
      doc.text(`Invoice Date: ${formatDate(invoice.created_at || invoice.invoice_date)}`, 340, 96, { align: "right" });
      doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 340, 108, { align: "right" });
      doc.text(`Payment Terms: ${invoice.payment_terms || "NET_30"}`, 340, 120, { align: "right" });
      doc.text(`Order Ref: ${invoice.order_number || "N/A"}`, 340, 132, { align: "right" });
      if (invoice.quotation_number) {
        doc.text(`Quotation Ref: ${invoice.quotation_number}`, 340, 144, { align: "right" });
      }

      // Status Badge
      const status = (invoice.status || "ISSUED").toUpperCase();
      let statusBg = "#eff6ff";
      let statusColor = "#1d4ed8";
      if (status === "PAID") {
        statusBg = "#ecfdf5";
        statusColor = "#047857";
      } else if (status === "OVERDUE" || status === "CANCELLED") {
        statusBg = "#fef2f2";
        statusColor = "#b91c1c";
      } else if (status === "PARTIALLY_PAID") {
        statusBg = "#fffbeb";
        statusColor = "#b45309";
      }

      doc.roundedRect(460, 160, 95, 20, 4).fill(statusBg);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(statusColor).text(status, 460, 166, { width: 95, align: "center" });

      // ----------------------------------------------------
      // BILL TO & SHIP TO SECTION
      // ----------------------------------------------------
      doc.rect(40, 185, 515, 1).fill("#e2e8f0");

      const yAddr = 195;
      // Bill To Box
      doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#1e293b").text("BILL TO:", 40, yAddr);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(customer.name || "Customer", 40, yAddr + 14);
      doc.fontSize(8.5).font("Helvetica").fillColor("#475569");
      if (customer.company && customer.company !== customer.name) {
        doc.text(customer.company, 40, yAddr + 26);
      }
      const billAddrLine = billTo.address || billTo.addressLine1 || invoice.delivery_address || "Customer Business Address";
      doc.text(billAddrLine, 40, yAddr + 38, { width: 230 });
      const billCityState = `${billTo.city || invoice.delivery_city || ""} ${billTo.state || invoice.delivery_state || ""} ${billTo.zip || invoice.delivery_zip || ""}`.trim();
      if (billCityState) doc.text(billCityState, 40, yAddr + 50);
      if (customer.email) doc.text(`Email: ${customer.email}`, 40, yAddr + 62);

      // Ship To Box
      doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#1e293b").text("SHIP TO:", 310, yAddr);
      const isSameShip = !shipTo.address || shipTo.address === billAddrLine;
      if (isSameShip) {
        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a").text("Same as Billing Address", 310, yAddr + 14);
        doc.fontSize(8.5).font("Helvetica").fillColor("#475569").text(billAddrLine, 310, yAddr + 28, { width: 230 });
        if (billCityState) doc.text(billCityState, 310, yAddr + 42);
      } else {
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(shipTo.recipientName || customer.name, 310, yAddr + 14);
        doc.fontSize(8.5).font("Helvetica").fillColor("#475569").text(shipTo.address || "Shipping Destination", 310, yAddr + 26, { width: 230 });
        const shipCityState = `${shipTo.city || ""} ${shipTo.state || ""} ${shipTo.zip || ""}`.trim();
        if (shipCityState) doc.text(shipCityState, 310, yAddr + 38);
      }

      // ----------------------------------------------------
      // LINE ITEMS TABLE
      // ----------------------------------------------------
      let tableY = 280;
      doc.rect(40, tableY, 515, 22).fill("#f1f5f9");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#334155");
      doc.text("ITEM / DESCRIPTION", 46, tableY + 6, { width: 190 });
      doc.text("QTY", 240, tableY + 6, { width: 40, align: "center" });
      doc.text("PRICE", 285, tableY + 6, { width: 65, align: "right" });
      doc.text("DISC %", 355, tableY + 6, { width: 45, align: "right" });
      doc.text("TAX %", 405, tableY + 6, { width: 45, align: "right" });
      doc.text("TOTAL", 455, tableY + 6, { width: 95, align: "right" });

      tableY += 26;
      const items = invoice.items || [];

      items.forEach((item, index) => {
        // Page overflow check
        if (tableY > 680) {
          doc.addPage();
          tableY = 45;
        }

        const bgRow = index % 2 === 1 ? "#f8fafc" : "#ffffff";
        doc.rect(40, tableY - 4, 515, 24).fill(bgRow);

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text(item.product_name || item.name || "Product", 46, tableY, { width: 190, lineBreak: false });
        if (item.sku) {
          doc.fontSize(7.5).font("Helvetica").fillColor("#64748b").text(`SKU: ${item.sku}`, 46, tableY + 11, { width: 190 });
        }

        doc.fontSize(8.5).font("Helvetica").fillColor("#1e293b");
        doc.text(String(item.quantity || 1), 240, tableY + 2, { width: 40, align: "center" });
        doc.text(formatCurrency(item.unit_price), 285, tableY + 2, { width: 65, align: "right" });
        doc.text(`${Number(item.discount_percent || 0).toFixed(1)}%`, 355, tableY + 2, { width: 45, align: "right" });
        doc.text(`${Number(item.tax_rate || 0).toFixed(0)}%`, 405, tableY + 2, { width: 45, align: "right" });
        doc.font("Helvetica-Bold").text(formatCurrency(item.line_total), 455, tableY + 2, { width: 95, align: "right" });

        tableY += 26;
      });

      // Bottom border for table
      doc.rect(40, tableY, 515, 1).fill("#cbd5e1");
      tableY += 14;

      // ----------------------------------------------------
      // TOTALS SUMMARY (RIGHT) & PAYMENT DETAILS (LEFT)
      // ----------------------------------------------------
      if (tableY > 640) {
        doc.addPage();
        tableY = 45;
      }

      // Left: Payment & Notes
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#1e293b").text("PAYMENT INFORMATION & NOTES", 40, tableY);
      doc.fontSize(8).font("Helvetica").fillColor("#475569");
      doc.text("Bank Transfer / NEFT / RTGS:", 40, tableY + 14);
      doc.text("Bank: HDFC Bank Ltd.", 40, tableY + 26);
      doc.text("Account Name: DealFlow360 Enterprise Solutions", 40, tableY + 38);
      doc.text("Account Number: 50200084920194", 40, tableY + 50);
      doc.text("IFSC Code: HDFC0000128", 40, tableY + 62);

      if (invoice.notes) {
        doc.text(`Notes: ${invoice.notes}`, 40, tableY + 76, { width: 230 });
      }

      // Right: Calculation Totals Box
      const totX = 320;
      const valX = 455;
      const boxWidth = 235;

      doc.rect(totX - 10, tableY, boxWidth, 128).fill("#f8fafc");
      doc.rect(totX - 10, tableY, boxWidth, 128).stroke("#e2e8f0");

      let curY = tableY + 8;
      const subtotal = Number(invoice.subtotal || 0);
      const discount = Number(invoice.discount || invoice.discount_amount || 0);
      const taxable = Number(invoice.taxable_amount || subtotal - discount);
      const tax = Number(invoice.tax || invoice.tax_amount || 0);
      const shipping = Number(invoice.shipping_amount || 0);
      const grandTotal = Number(invoice.total || invoice.grand_total || taxable + tax + shipping);
      const paid = Number(invoice.amount_paid || 0);
      const due = Math.max(0, grandTotal - paid);

      // Subtotal
      doc.fontSize(8.5).font("Helvetica").fillColor("#475569").text("Subtotal:", totX, curY);
      doc.text(formatCurrency(subtotal), valX, curY, { width: 90, align: "right" });
      curY += 14;

      // Discount
      if (discount > 0) {
        doc.text("Discount:", totX, curY);
        doc.fillColor("#b91c1c").text(`-${formatCurrency(discount)}`, valX, curY, { width: 90, align: "right" });
        doc.fillColor("#475569");
        curY += 14;
      }

      // Taxable Amount
      doc.text("Taxable Amount:", totX, curY);
      doc.text(formatCurrency(taxable), valX, curY, { width: 90, align: "right" });
      curY += 14;

      // Tax (GST)
      doc.text("GST / Taxes:", totX, curY);
      doc.text(formatCurrency(tax), valX, curY, { width: 90, align: "right" });
      curY += 14;

      // Shipping
      if (shipping > 0) {
        doc.text("Shipping & Freight:", totX, curY);
        doc.text(formatCurrency(shipping), valX, curY, { width: 90, align: "right" });
        curY += 14;
      }

      // Divider
      doc.rect(totX, curY, 215, 1).fill("#cbd5e1");
      curY += 6;

      // Grand Total
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("Grand Total:", totX, curY);
      doc.text(formatCurrency(grandTotal), valX, curY, { width: 90, align: "right" });
      curY += 16;

      // Amount Paid
      doc.fontSize(8.5).font("Helvetica").fillColor("#047857").text("Amount Paid:", totX, curY);
      doc.text(formatCurrency(paid), valX, curY, { width: 90, align: "right" });
      curY += 14;

      // Balance Due
      doc.fontSize(9.5).font("Helvetica-Bold").fillColor(due > 0 ? "#b91c1c" : "#047857").text("Amount Due:", totX, curY);
      doc.text(formatCurrency(due), valX, curY, { width: 90, align: "right" });

      // ----------------------------------------------------
      // FOOTER
      // ----------------------------------------------------
      doc.fontSize(8).font("Helvetica").fillColor("#94a3b8");
      doc.text(
        "Thank you for doing business with DealFlow360. This is a computer-generated tax invoice and requires no physical signature.",
        40,
        760,
        { align: "center", width: 515 },
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePDF,
  formatCurrency,
};
