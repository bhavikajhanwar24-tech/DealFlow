/**
 * DealFlow360 Export Utility
 * Handles formatted CSV/XLS export and professional printable/PDF report generation.
 */

export function exportToCSV(filename, rows, headers) {
  if (!rows || !rows.length) {
    alert("No data available to export.");
    return;
  }

  const headerKeys = headers ? headers.map((h) => h.key) : Object.keys(rows[0]);
  const headerLabels = headers ? headers.map((h) => h.label) : Object.keys(rows[0]);

  const csvRows = [];
  // Add header row
  csvRows.push(headerLabels.map((label) => `"${String(label).replace(/"/g, '""')}"`).join(","));

  // Add data rows
  for (const row of rows) {
    const values = headerKeys.map((key) => {
      let val = row[key];
      if (val === null || val === undefined) val = "";
      if (typeof val === "object") val = JSON.stringify(val);
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvContent = "\uFEFF" + csvRows.join("\r\n"); // UTF-8 BOM for Excel compatibility
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printOrExportPDF({ title, subtitle, metadata = [], headers = [], rows = [], summaryCards = [] }) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow popups to generate and print PDF reports.");
    return;
  }

  const dateStr = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const summaryHtml = summaryCards.length
    ? `
      <div class="summary-grid">
        ${summaryCards
          .map(
            (card) => `
          <div class="summary-card">
            <div class="card-label">${card.label}</div>
            <div class="card-value" style="color: ${card.color || "#0f172a"}">${card.value}</div>
            ${card.subtext ? `<div class="card-subtext">${card.subtext}</div>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
    `
    : "";

  const metadataHtml = metadata.length
    ? `
      <div class="metadata-bar">
        ${metadata.map((m) => `<span><strong>${m.label}:</strong> ${m.value}</span>`).join(" &bull; ")}
      </div>
    `
    : "";

  const tableHeaderHtml = headers.map((h) => `<th>${h.label}</th>`).join("");

  const tableRowsHtml = rows
    .map(
      (row) => `
    <tr>
      ${headers
        .map((h) => {
          const val = row[h.key] ?? "";
          return `<td>${val}</td>`;
        })
        .join("")}
    </tr>
  `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title} - DealFlow360</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            background: #ffffff;
            font-size: 13px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .brand {
            font-size: 20px;
            font-weight: 800;
            color: #1e40af;
            letter-spacing: -0.5px;
          }
          .brand-sub {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
          }
          .report-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 8px;
          }
          .report-subtitle {
            font-size: 12px;
            color: #475569;
            margin-top: 3px;
          }
          .meta-date {
            text-align: right;
            font-size: 12px;
            color: #64748b;
          }
          .metadata-bar {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 12px;
            color: #334155;
          }
          .summary-grid {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
          }
          .summary-card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
          }
          .card-label {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            color: #64748b;
          }
          .card-value {
            font-size: 18px;
            font-weight: 800;
            margin-top: 4px;
          }
          .card-subtext {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 12px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-align: left;
            padding: 9px 10px;
            border-bottom: 1.5px solid #cbd5e1;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
          }
          tr:nth-child(even) {
            background: #fafafa;
          }
          .footer {
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #94a3b8;
          }
          .print-actions {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            background: rgba(255, 255, 255, 0.95);
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .btn-print {
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn-close {
            background: #e2e8f0;
            color: #334155;
            border: none;
            padding: 8px 16px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
          }
          @media print {
            .print-actions {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">DealFlow360</div>
            <div class="brand-sub">Self-Governing Sales & Operations Platform</div>
            <div class="report-title">${title}</div>
            ${subtitle ? `<div class="report-subtitle">${subtitle}</div>` : ""}
          </div>
          <div class="meta-date">
            <div><strong>Generated:</strong> ${dateStr}</div>
            <div><strong>Status:</strong> Official System Export</div>
          </div>
        </div>

        ${metadataHtml}
        ${summaryHtml}

        <table>
          <thead>
            <tr>${tableHeaderHtml}</tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>DealFlow360 Operational Reporting &bull; Confidential</div>
          <div>Page 1 of 1</div>
        </div>

        <div class="print-actions">
          <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
          <button class="btn-close" onclick="window.close()">Close</button>
        </div>

        <script>
          // Automatically prompt print dialog after render
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
