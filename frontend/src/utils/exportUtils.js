/**
 * DealFlow360 Export Utility
 * Handles automated client-side CSV and PDF downloads without print screen popups.
 * Prompts user for preferred download name & format on first use, then remembers preference.
 */

const STORAGE_KEY_CONFIGURED = "dealflow360_export_configured";
const STORAGE_KEY_PREFS = "dealflow360_export_prefs";

/**
 * Check if the user has already configured their export preferences.
 */
export function isExportConfigured() {
  try {
    return localStorage.getItem(STORAGE_KEY_CONFIGURED) === "true";
  } catch {
    return false;
  }
}

/**
 * Reset stored export preferences so user will be prompted again on next export.
 */
export function resetExportPreferences() {
  try {
    localStorage.removeItem(STORAGE_KEY_CONFIGURED);
    localStorage.removeItem(STORAGE_KEY_PREFS);
  } catch (e) {
    console.error("Failed to reset export preferences:", e);
  }
}

/**
 * Retrieve stored export preferences.
 */
export function getExportPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Inject the modal styles once into the document head.
 */
function ensureModalStyles() {
  if (document.getElementById("df-export-modal-styles")) return;

  const style = document.createElement("style");
  style.id = "df-export-modal-styles";
  style.innerHTML = `
    @keyframes dfFadeInOverlay {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes dfScaleInModal {
      from { opacity: 0; transform: scale(0.94) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .df-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      animation: dfFadeInOverlay 0.18s ease-out;
      padding: 1rem;
    }
    .df-modal-box {
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.9);
      width: 100%;
      max-width: 480px;
      padding: 1.75rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      animation: dfScaleInModal 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .df-format-card {
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 0.9rem 1rem;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: #f8fafc;
      user-select: none;
    }
    .df-format-card:hover {
      border-color: #93c5fd;
      background: #eff6ff;
    }
    .df-format-card.selected {
      border-color: #2563eb;
      background: #eff6ff;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Prompt the user with a modal dialog asking for download name and format.
 * Returns a Promise that resolves to { filename, format, remember } or null if cancelled.
 */
export function promptExportDialog({ defaultName = "DealFlow360_Export", defaultFormat = "pdf" }) {
  ensureModalStyles();

  return new Promise((resolve) => {
    const existing = document.getElementById("df-export-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "df-export-modal-overlay";
    overlay.className = "df-modal-overlay";

    let selectedFormat = defaultFormat.toLowerCase() === "csv" ? "csv" : "pdf";

    const initialName =
      defaultName
        .trim()
        .replace(/[^a-zA-Z0-9_\-\s]/g, "")
        .replace(/\s+/g, "_") || "Export_Report";

    overlay.innerHTML = `
      <div class="df-modal-box" role="dialog" aria-modal="true" aria-labelledby="df-modal-title">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.28);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h3 id="df-modal-title" style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a;">Export & Download</h3>
                <span style="background: #e0f2fe; color: #0369a1; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 9999px; text-transform: uppercase;">First-Time Setup</span>
              </div>
              <p style="margin: 0.2rem 0 0 0; font-size: 0.825rem; color: #64748b;">Configure your download name & file format.</p>
            </div>
          </div>
          <button id="df-btn-close" style="background: none; border: none; font-size: 1.25rem; color: #94a3b8; cursor: pointer; padding: 0.25rem; line-height: 1;">✕</button>
        </div>

        <!-- File Name Input -->
        <div style="margin-bottom: 1.25rem;">
          <label for="df-input-filename" style="display: block; font-size: 0.825rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.03em;">
            Download File Name
          </label>
          <div style="display: flex; align-items: center; border: 1.5px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #ffffff;" id="df-input-wrapper">
            <input 
              id="df-input-filename" 
              type="text" 
              value="${initialName}" 
              placeholder="e.g. Sales_Quotations_Report" 
              style="flex: 1; padding: 0.7rem 0.9rem; font-size: 0.925rem; border: none; outline: none; font-weight: 600; color: #0f172a;" 
            />
            <span id="df-ext-badge" style="padding: 0.7rem 0.9rem; background: #f1f5f9; color: #475569; font-weight: 700; font-size: 0.825rem; border-left: 1px solid #e2e8f0;">
              .${selectedFormat}
            </span>
          </div>
          <span style="display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 0.35rem;">File will automatically download directly to your device.</span>
        </div>

        <!-- Format Options -->
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; font-size: 0.825rem; font-weight: 700; color: #334155; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.03em;">
            Select Format
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <!-- PDF Card -->
            <div id="df-card-pdf" class="df-format-card ${selectedFormat === "pdf" ? "selected" : ""}">
              <div style="font-size: 1.5rem;">📄</div>
              <div>
                <div style="font-weight: 700; font-size: 0.875rem; color: #0f172a;">PDF Document</div>
                <div style="font-size: 0.725rem; color: #64748b;">Direct download (.pdf)</div>
              </div>
            </div>

            <!-- CSV Card -->
            <div id="df-card-csv" class="df-format-card ${selectedFormat === "csv" ? "selected" : ""}">
              <div style="font-size: 1.5rem;">📊</div>
              <div>
                <div style="font-weight: 700; font-size: 0.875rem; color: #0f172a;">CSV / Excel</div>
                <div style="font-size: 0.725rem; color: #64748b;">Spreadsheet (.csv)</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Remember Choice Checkbox -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 0.9rem; margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 0.65rem;">
          <input 
            type="checkbox" 
            id="df-checkbox-remember" 
            checked 
            style="margin-top: 0.2rem; cursor: pointer; accent-color: #2563eb; width: 16px; height: 16px;" 
          />
          <div>
            <label for="df-checkbox-remember" style="font-size: 0.825rem; font-weight: 600; color: #1e293b; cursor: pointer; display: block;">
              Remember my choice for future downloads
            </label>
            <span style="font-size: 0.75rem; color: #64748b; display: block; margin-top: 0.1rem;">
              Future downloads will start immediately without prompting.
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button 
            id="df-btn-cancel" 
            type="button" 
            style="padding: 0.65rem 1.15rem; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 9px; font-size: 0.85rem; font-weight: 600; color: #475569; cursor: pointer;"
          >
            Cancel
          </button>
          <button 
            id="df-btn-confirm" 
            type="button" 
            style="padding: 0.65rem 1.4rem; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; border-radius: 9px; font-size: 0.85rem; font-weight: 700; color: #ffffff; cursor: pointer; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); display: flex; align-items: center; gap: 0.4rem;"
          >
            <span>Confirm & Download</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const inputName = overlay.querySelector("#df-input-filename");
    const extBadge = overlay.querySelector("#df-ext-badge");
    const cardPdf = overlay.querySelector("#df-card-pdf");
    const cardCsv = overlay.querySelector("#df-card-csv");
    const checkRemember = overlay.querySelector("#df-checkbox-remember");
    const btnCancel = overlay.querySelector("#df-btn-cancel");
    const btnClose = overlay.querySelector("#df-btn-close");
    const btnConfirm = overlay.querySelector("#df-btn-confirm");

    inputName.focus();
    inputName.select();

    function updateFormat(fmt) {
      selectedFormat = fmt;
      extBadge.textContent = `.${fmt}`;
      if (fmt === "pdf") {
        cardPdf.classList.add("selected");
        cardCsv.classList.remove("selected");
      } else {
        cardCsv.classList.add("selected");
        cardPdf.classList.remove("selected");
      }
    }

    cardPdf.onclick = () => updateFormat("pdf");
    cardCsv.onclick = () => updateFormat("csv");

    function cleanupAndResolve(result) {
      overlay.remove();
      document.removeEventListener("keydown", handleKeydown);
      resolve(result);
    }

    function handleConfirm() {
      let val = inputName.value.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
      if (!val) val = initialName;

      const remember = checkRemember.checked;
      if (remember) {
        try {
          localStorage.setItem(STORAGE_KEY_CONFIGURED, "true");
          localStorage.setItem(
            STORAGE_KEY_PREFS,
            JSON.stringify({ format: selectedFormat, namePrefix: val, remember: true })
          );
        } catch (e) {
          console.error("Storage write error:", e);
        }
      }

      cleanupAndResolve({
        filename: val,
        format: selectedFormat,
        remember,
      });
    }

    function handleKeydown(e) {
      if (e.key === "Escape") cleanupAndResolve(null);
      if (e.key === "Enter" && document.activeElement === inputName) handleConfirm();
    }

    btnConfirm.onclick = handleConfirm;
    btnCancel.onclick = () => cleanupAndResolve(null);
    btnClose.onclick = () => cleanupAndResolve(null);
    overlay.onclick = (e) => {
      if (e.target === overlay) cleanupAndResolve(null);
    };

    document.addEventListener("keydown", handleKeydown);
  });
}

/**
 * Direct CSV file download
 */
function runDirectCSVExport(filename, rows, headers) {
  if (!rows || !rows.length) {
    alert("No data available to export.");
    return;
  }

  const headerKeys = headers ? headers.map((h) => h.key) : Object.keys(rows[0]);
  const headerLabels = headers ? headers.map((h) => h.label) : Object.keys(rows[0]);

  const csvRows = [];
  csvRows.push(headerLabels.map((label) => `"${String(label).replace(/"/g, '""')}"`).join(","));

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

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const baseName = filename.replace(/\.csv$/i, "");
  link.setAttribute("download", `${baseName}_${dateSuffix}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Load jsPDF dynamically if not already available on window
 */
async function getJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf;
  }

  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.jspdf && window.jspdf.jsPDF) {
        clearInterval(interval);
        resolve(window.jspdf);
      } else if (attempts > 15) {
        clearInterval(interval);
        // Inject scripts dynamically
        const s1 = document.createElement("script");
        s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s1.onload = () => {
          const s2 = document.createElement("script");
          s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
          s2.onload = () => resolve(window.jspdf || null);
          s2.onerror = () => resolve(null);
          document.head.appendChild(s2);
        };
        s1.onerror = () => resolve(null);
        document.head.appendChild(s1);
      }
    }, 60);
  });
}

/**
 * Direct PDF generation and automatic file download without print screen
 */
async function runDirectPDFExport({
  title = "Commercial Report",
  subtitle,
  metadata = [],
  headers = [],
  rows = [],
  summaryCards = [],
  customFileName,
}) {
  const baseName = (customFileName || title)
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_");
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const finalPdfName = `${baseName}_${dateSuffix}.pdf`;

  const jspdfLib = await getJsPdf();

  if (jspdfLib && jspdfLib.jsPDF) {
    try {
      const { jsPDF } = jspdfLib;
      const orientation = headers.length > 5 ? "landscape" : "portrait";
      const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Top brand banner
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 52, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("DealFlow360", 30, 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text("Intelligent Sales Operations Platform", 30, 42);

      const dateStr = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      doc.setFontSize(8);
      doc.text(`Generated: ${dateStr}`, pageWidth - 30, 26, { align: "right" });
      doc.text("Official Commercial Proposal", pageWidth - 30, 40, { align: "right" });

      // Title & Subtitle
      let currentY = 76;
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(title || "Commercial Report", 30, currentY);

      if (subtitle) {
        currentY += 15;
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(subtitle, 30, currentY);
      }

      // Metadata Bar
      if (metadata && metadata.length) {
        currentY += 14;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(30, currentY, pageWidth - 60, 22, 4, 4, "FD");

        doc.setFontSize(8);
        let metaX = 40;
        metadata.forEach((m, idx) => {
          doc.setTextColor(71, 85, 105);
          doc.setFont("helvetica", "bold");
          const labelStr = `${m.label}: `;
          doc.text(labelStr, metaX, currentY + 14);
          const labelWidth = doc.getTextWidth(labelStr);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(15, 23, 42);
          const valStr = `${m.value || "N/A"}${idx < metadata.length - 1 ? "   •   " : ""}`;
          doc.text(valStr, metaX + labelWidth, currentY + 14);
          metaX += labelWidth + doc.getTextWidth(valStr) + 8;
        });
        currentY += 26;
      }

      // Summary KPI Cards
      if (summaryCards && summaryCards.length) {
        currentY += 6;
        const cardGap = 10;
        const totalCardsWidth = pageWidth - 60;
        const cardWidth = (totalCardsWidth - (summaryCards.length - 1) * cardGap) / summaryCards.length;
        const cardHeight = 40;

        summaryCards.forEach((c, idx) => {
          const cardX = 30 + idx * (cardWidth + cardGap);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 6, 6, "FD");

          doc.setFillColor(37, 99, 235);
          doc.roundedRect(cardX, currentY, cardWidth, 3, 2, 2, "F");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(String(c.label || "").toUpperCase(), cardX + 8, currentY + 14);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(String(c.value || ""), cardX + 8, currentY + 31);
        });
        currentY += cardHeight + 10;
      }

      // AutoTable data
      const tableHeaders = headers.map((h) => h.label);
      const tableRows = rows.map((r) => headers.map((h) => String(r[h.key] ?? "")));

      if (typeof doc.autoTable === "function") {
        doc.autoTable({
          startY: currentY + 6,
          head: [tableHeaders],
          body: tableRows,
          margin: { left: 30, right: 30 },
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 5,
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
            textColor: [30, 41, 59],
          },
          headStyles: {
            fillColor: [241, 245, 249],
            textColor: [51, 65, 85],
            fontStyle: "bold",
            fontSize: 8,
            lineWidth: 0.8,
            lineColor: [203, 213, 225],
          },
          alternateRowStyles: {
            fillColor: [250, 250, 250],
          },
          didDrawPage: (data) => {
            const pageNum = doc.internal.getNumberOfPages();
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text("DealFlow360 Operational Reporting • Confidential", 30, pageHeight - 15);
            doc.text(`Page ${data.pageNumber} of ${pageNum}`, pageWidth - 30, pageHeight - 15, { align: "right" });
          },
        });
      }

      // Automatically triggers browser file download!
      doc.save(finalPdfName);
      return;
    } catch (e) {
      console.error("jsPDF generation failed, falling back to direct download blob:", e);
    }
  }

  // Fallback: download as text/CSV blob if PDF renderer failed
  runDirectCSVExport(baseName, rows, headers);
}

/**
 * Main exportToCSV function:
 * Prompts user on first export, then automatically downloads on subsequent exports.
 */
export async function exportToCSV(filename, rows, headers) {
  if (!rows || !rows.length) {
    alert("No data available to export.");
    return;
  }

  let chosenName = filename;
  let chosenFormat = "csv";

  if (!isExportConfigured()) {
    const config = await promptExportDialog({
      defaultName: filename,
      defaultFormat: "csv",
    });
    if (!config) return; // User cancelled
    chosenName = config.filename;
    chosenFormat = config.format;
  }

  if (chosenFormat === "pdf") {
    await runDirectPDFExport({
      title: chosenName.replace(/_/g, " "),
      subtitle: "Tabular Export Ledger",
      headers,
      rows,
      customFileName: chosenName,
    });
  } else {
    runDirectCSVExport(chosenName, rows, headers);
  }
}

/**
 * Main printOrExportPDF function:
 * Prompts user on first export, then automatically downloads PDF on subsequent exports.
 */
export async function printOrExportPDF(params) {
  const { title = "Report", subtitle, metadata = [], headers = [], rows = [], summaryCards = [] } = params;

  let chosenName = params.customFileName || title.replace(/[^a-zA-Z0-9_-]/g, "_");
  let chosenFormat = "pdf";

  if (!isExportConfigured()) {
    const config = await promptExportDialog({
      defaultName: chosenName,
      defaultFormat: "pdf",
    });
    if (!config) return; // User cancelled
    chosenName = config.filename;
    chosenFormat = config.format;
  }

  if (chosenFormat === "csv" && rows && rows.length && headers && headers.length) {
    runDirectCSVExport(chosenName, rows, headers);
  } else {
    await runDirectPDFExport({
      ...params,
      customFileName: chosenName,
    });
  }
}
