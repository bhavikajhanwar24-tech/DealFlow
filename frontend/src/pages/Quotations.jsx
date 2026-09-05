import { useEffect, useState } from "react";
import { FilePlus2, RefreshCw, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:5000/api";
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Quotations({ onNavigate }) {
  const { token } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadQuotations() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/quotations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to load quotations.");
      setQuotations(data.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotations();
  }, [token]);

  return (
    <main className="main-content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div
            style={{
              color: "#2563eb",
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Sales Workspace
          </div>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "0.35rem",
            }}
          >
            Quotations
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
            Create and manage customer quotations.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.65rem" }}>
          <button
            className="btn-secondary"
            onClick={loadQuotations}
            disabled={loading}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            className="btn-primary"
            style={{ width: "auto" }}
            onClick={() => onNavigate("/sales/quotations/new")}
          >
            <FilePlus2 size={16} /> New Quotation
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      <div className="data-table-card">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Customer</th>
                <th>Sales Rep</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    Loading quotations...
                  </td>
                </tr>
              ) : null}
              {!loading && quotations.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    No quotations yet. Create your first draft.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                quotations.map((quotation) => (
                  <tr
                    key={quotation.id}
                    onClick={() =>
                      onNavigate(`/sales/quotations/${quotation.id}`)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontWeight: 800, color: "#1d4ed8" }}>
                      {quotation.quotationNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {quotation.customer?.companyName ||
                          quotation.customer?.fullName}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        {quotation.customer?.customerCode}
                      </div>
                    </td>
                    <td>{quotation.salesRep?.fullName}</td>
                    <td style={{ fontWeight: 800 }}>
                      {currency(quotation.finalAmount)}
                    </td>
                    <td>
                      <span className="badge badge-active">
                        {quotation.status}
                      </span>
                    </td>
                    <td style={{ color: "#64748b" }}>
                      {new Date(quotation.createdAt).toLocaleDateString(
                        "en-IN",
                      )}
                    </td>
                    <td>
                      <ArrowRight size={16} color="#94a3b8" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
