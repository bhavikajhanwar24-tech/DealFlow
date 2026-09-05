import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  Users,
  Briefcase,
  Warehouse,
  Package,
  ArrowRight,
  Database,
  Info
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

const ENTITIES = [
  {
    id: "products",
    title: "Products & Catalog",
    icon: Package,
    description: "Import hardware, services, and SaaS subscriptions with SKU, pricing, and cost margins.",
    columns: ["name", "sku", "category", "unit_price", "cost", "description", "inventory_reference", "currency", "is_active"],
    color: "#3b82f6"
  },
  {
    id: "customers",
    title: "Customers & Accounts",
    icon: Users,
    description: "Import customer accounts with tier categorization (BRONZE, SILVER, GOLD) and company info.",
    columns: ["full_name", "email", "company_name", "customer_tier", "password"],
    color: "#8b5cf6"
  },
  {
    id: "staff",
    title: "Staff & Employees",
    icon: Briefcase,
    description: "Import sales representatives, managers, finance, and operations personnel.",
    columns: ["full_name", "email", "employee_id", "role", "department", "password"],
    color: "#10b981"
  },
  {
    id: "warehouses",
    title: "Warehouses & Hubs",
    icon: Warehouse,
    description: "Import distribution centers and storage hubs with exact GPS coordinates (latitude/longitude).",
    columns: ["name", "address", "latitude", "longitude"],
    color: "#f59e0b"
  },
  {
    id: "quotations",
    title: "Quotations & Deals",
    icon: FileText,
    description: "Import quotations and multi-item deals mapped by customer and sales rep email addresses.",
    columns: ["customer_email", "sales_rep_email", "status", "product_sku", "quantity", "unit_price", "discount_percent"],
    color: "#ec4899"
  }
];

export default function BulkUpload() {
  const { token } = useAuth();
  const [selectedEntity, setSelectedEntity] = useState("products");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [parsingError, setParsingError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  const currentEntityConfig = ENTITIES.find((e) => e.id === selectedEntity);

  const resetUploadState = () => {
    setFileName("");
    setRawContent("");
    setParsedRows([]);
    setParsingError("");
    setUploadResult(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEntityChange = (id) => {
    setSelectedEntity(id);
    resetUploadState();
  };

  // Simple CSV parser for client-side preview
  const parseCSVToRows = (text) => {
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const values = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]).map((h) =>
      h.trim().toLowerCase().replace(/[\s\-_]+/g, "_")
    );

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = vals[idx] !== undefined ? vals[idx] : "";
      });
      rows.push(row);
    }
    return rows;
  };

  const processFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setUploadResult(null);
    setErrorMsg("");
    setParsingError("");

    const isCSV = file.name.endsWith(".csv");
    const isText = file.name.endsWith(".txt") || isCSV;

    if (!isText && !file.name.endsWith(".xlsx")) {
      setParsingError("Please select a valid CSV (.csv) or text file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        setRawContent(text);
        const rows = parseCSVToRows(text);
        if (rows.length === 0) {
          setParsingError("File appears to be empty or missing data rows.");
        } else {
          setParsedRows(rows);
        }
      } catch (err) {
        setParsingError("Failed to parse file: " + err.message);
      }
    };
    reader.onerror = () => setParsingError("Failed to read file.");
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Download Sample Template
  const downloadTemplate = async () => {
    try {
      const res = await fetch(`${API_BASE}/upload/templates/${selectedEntity}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not download template");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedEntity}_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error downloading template: " + err.message);
    }
  };

  // Execute Bulk Upload to PostgreSQL
  const submitBulkUpload = async () => {
    if (parsedRows.length === 0) return;
    setIsUploading(true);
    setErrorMsg("");
    setUploadResult(null);

    try {
      const res = await fetch(`${API_BASE}/upload/${selectedEntity}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rows: parsedRows })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Bulk upload failed.");
      }

      setUploadResult(data.data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Seed 200+ Records in EACH Table (1,000 Total Rows)
  const handleSeedDataset = async () => {
    if (!window.confirm("This will import 200 records into EACH table (Products, Customers, Staff, Warehouses, Quotations - 1,000 total rows) into PostgreSQL. Proceed?")) {
      return;
    }
    setIsUploading(true);
    setErrorMsg("");
    setUploadResult(null);
    try {
      const res = await fetch(`${API_BASE}/upload/seed/generate-dataset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Dataset generation failed.");
      alert(`Success! ${data.summary.totalRows} records imported:\n- Products: ${data.summary.products}\n- Customers: ${data.summary.customers}\n- Staff: ${data.summary.staff}\n- Warehouses: ${data.summary.warehouses}\n- Quotations: ${data.summary.quotations}`);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="admin-page-container" style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header Banner */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
            }}
          >
            <Database size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
              Bulk Database Upload
            </h1>
            <p style={{ margin: 0, fontSize: "0.95rem", color: "#64748b" }}>
              Import bulk records directly into PostgreSQL database with automated validation and duplicate handling.
            </p>
          </div>
        </div>

        <button
          onClick={handleSeedDataset}
          disabled={isUploading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            border: "none",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.92rem",
            cursor: isUploading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
            transition: "all 0.15s ease"
          }}
        >
          <Database size={18} /> Populate 200 Records for Each Table (1,000 Total)
        </button>
      </div>

      {/* Entity Selection Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem"
        }}
      >
        {ENTITIES.map((ent) => {
          const Icon = ent.icon;
          const isSelected = selectedEntity === ent.id;
          return (
            <button
              key={ent.id}
              onClick={() => handleEntityChange(ent.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "1.25rem",
                borderRadius: "12px",
                border: isSelected ? `2px solid ${ent.color}` : "1px solid #e2e8f0",
                background: isSelected ? "#ffffff" : "#f8fafc",
                boxShadow: isSelected
                  ? "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)"
                  : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease"
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: isSelected ? `${ent.color}15` : "#e2e8f0",
                  color: isSelected ? ent.color : "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "0.75rem"
                }}
              >
                <Icon size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: isSelected ? "#0f172a" : "#475569" }}>
                {ent.title}
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#64748b",
                  marginTop: "0.35rem",
                  lineHeight: "1.3"
                }}
              >
                {ent.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Action Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          marginBottom: "2rem"
        }}
      >
        {/* Card Header with Entity Specs */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f172a" }}>
                Target: {currentEntityConfig.title}
              </span>
              <span
                style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: "#dbeafe",
                  color: "#1d4ed8"
                }}
              >
                PostgreSQL Table: public.{selectedEntity}
              </span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
              Accepted columns: {currentEntityConfig.columns.map((c) => `"${c}"`).join(", ")}
            </div>
          </div>

          <button
            onClick={downloadTemplate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#1e293b",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              transition: "all 0.15s ease"
            }}
          >
            <Download size={16} /> Download Sample Template
          </button>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div style={{ padding: "2rem 1.75rem" }}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              border: isDragging ? "2px dashed #3b82f6" : "2px dashed #cbd5e1",
              background: isDragging ? "#eff6ff" : "#fbfcfd",
              borderRadius: "12px",
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx"
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
                color: "#3b82f6"
              }}
            >
              <UploadCloud size={28} />
            </div>

            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1e293b", marginBottom: "0.35rem" }}>
              {fileName ? fileName : "Drag & Drop CSV / Excel sheet here"}
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              or <span style={{ color: "#3b82f6", fontWeight: 600 }}>browse file</span> from your computer (.csv, .xlsx)
            </p>
          </div>

          {/* Parsing error alert */}
          {parsingError && (
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "0.875rem"
              }}
            >
              <AlertCircle size={18} />
              <span>{parsingError}</span>
            </div>
          )}

          {/* General API error alert */}
          {errorMsg && (
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "0.875rem"
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload Results Banner */}
          {uploadResult && (
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1.5rem",
                borderRadius: "12px",
                background: uploadResult.failed === 0 ? "#f0fdf4" : "#fffbeb",
                border: uploadResult.failed === 0 ? "1px solid #bbf7d0" : "1px solid #fde68a"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                {uploadResult.failed === 0 ? (
                  <CheckCircle2 size={24} color="#16a34a" />
                ) : (
                  <AlertTriangle size={24} color="#d97706" />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#0f172a" }}>
                    Bulk Upload Result: {uploadResult.success} Succeeded, {uploadResult.failed} Failed
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                    {uploadResult.total} total rows processed into PostgreSQL.
                  </div>
                </div>
              </div>

              {/* Stat Chips */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <div
                  style={{
                    background: "#ffffff",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Total Rows: </span>
                  <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{uploadResult.total}</strong>
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "8px",
                    border: "1px solid #bbf7d0"
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "#16a34a" }}>Imported / Upserted: </span>
                  <strong style={{ fontSize: "1.1rem", color: "#16a34a" }}>{uploadResult.success}</strong>
                </div>
                {uploadResult.failed > 0 && (
                  <div
                    style={{
                      background: "#ffffff",
                      padding: "0.6rem 1.25rem",
                      borderRadius: "8px",
                      border: "1px solid #fecaca"
                    }}
                  >
                    <span style={{ fontSize: "0.8rem", color: "#dc2626" }}>Errors / Skipped: </span>
                    <strong style={{ fontSize: "1.1rem", color: "#dc2626" }}>{uploadResult.failed}</strong>
                  </div>
                )}
              </div>

              {/* Detailed Row Errors Table */}
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#991b1b", marginBottom: "0.5rem" }}>
                    Error Breakdown by Row:
                  </div>
                  <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #fecaca", borderRadius: "8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca", textAlign: "left" }}>
                          <th style={{ padding: "0.5rem 0.75rem", color: "#991b1b", width: "80px" }}>Row</th>
                          <th style={{ padding: "0.5rem 0.75rem", color: "#991b1b", width: "180px" }}>Identifier</th>
                          <th style={{ padding: "0.5rem 0.75rem", color: "#991b1b" }}>Error Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.errors.map((err, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{err.row}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>{err.identifier}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#dc2626" }}>{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pre-Upload Data Preview Table */}
          {parsedRows.length > 0 && !uploadResult && (
            <div style={{ marginTop: "2rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem"
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#0f172a" }}>
                    Data Preview ({parsedRows.length} rows detected)
                  </span>
                  <span style={{ marginLeft: "0.75rem", fontSize: "0.85rem", color: "#64748b" }}>
                    Review before committing to PostgreSQL database.
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    onClick={resetUploadState}
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "8px",
                      background: "#f1f5f9",
                      border: "none",
                      color: "#475569",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      cursor: "pointer"
                    }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={submitBulkUpload}
                    disabled={isUploading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.6rem 1.5rem",
                      borderRadius: "8px",
                      background: isUploading ? "#93c5fd" : "#2563eb",
                      border: "none",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      cursor: isUploading ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)"
                    }}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw size={16} className="spin-animation" /> Uploading to DB...
                      </>
                    ) : (
                      <>
                        <ArrowRight size={16} /> Bulk Upload {parsedRows.length} Records
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Responsive Scrollable Table */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  maxHeight: "360px",
                  overflow: "auto"
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "0.6rem 0.75rem", color: "#64748b", width: "50px" }}>#</th>
                      {Object.keys(parsedRows[0] || {}).map((col) => (
                        <th key={col} style={{ padding: "0.6rem 0.75rem", color: "#1e293b", fontWeight: 600 }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: idx % 2 === 0 ? "#ffffff" : "#fbfcfd"
                        }}
                      >
                        <td style={{ padding: "0.5rem 0.75rem", color: "#94a3b8" }}>{idx + 1}</td>
                        {Object.keys(parsedRows[0] || {}).map((col) => (
                          <td key={col} style={{ padding: "0.5rem 0.75rem", color: "#334155" }}>
                            {String(row[col] !== undefined ? row[col] : "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "right", marginTop: "0.5rem" }}>
                  Showing first 50 rows of {parsedRows.length} total.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Helpful Instructions Box */}
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "1rem"
        }}
      >
        <Info size={22} color="#16a34a" style={{ flexShrink: 0, marginTop: "2px" }} />
        <div style={{ fontSize: "0.875rem", color: "#166534", lineHeight: "1.5" }}>
          <strong>Pro Tip for Bulk Operations:</strong>
          <ul style={{ margin: "0.4rem 0 0 0", paddingLeft: "1.25rem" }}>
            <li>
              <strong>Products</strong> are automatically updated if the SKU already exists (upsert logic).
            </li>
            <li>
              <strong>Customers & Staff</strong> with existing email addresses will have their details updated while preserving accounts.
            </li>
            <li>
              <strong>Quotations</strong> can combine multiple product items by matching the same customer and sales representative emails.
            </li>
            <li>
              Every bulk upload action is logged directly in the <strong>Admin Audit Logs</strong> for governance compliance.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
