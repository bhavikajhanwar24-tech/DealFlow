import React, { useState } from "react";
import {
  Mail,
  Lock,
  User,
  Building,
  Briefcase,
  IdCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Receipt,
  Truck,
  ArrowRight,
  Info,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AuthPage({ onLoginSuccess }) {
  const { login, registerEmployee, registerCustomer } = useAuth();

  // Active view: 'login' | 'signup'
  const [activeTab, setActiveTab] = useState("login");
  // User type: 'employee' | 'customer'
  const [userCategory, setUserCategory] = useState("employee");

  // Form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    employeeId: "",
    email: "",
    department: "Sales",
    requestedRole: "SALES_REP",
    password: "",
    confirmPassword: ""
  });
  const [customerForm, setCustomerForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusNotice, setStatusNotice] = useState(null); // { type: 'pending'|'rejected', message: '' }
  const [successMessage, setSuccessMessage] = useState("");
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);

  // Quick-fill credentials helper for demo
  const fillDemoCredentials = (email, password, category) => {
    setLoginForm({ email, password });
    setUserCategory(category);
    setActiveTab("login");
    setErrorMessage("");
    setStatusNotice(null);
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setStatusNotice(null);
    setSuccessMessage("");
    setLoading(true);

    const result = await login(loginForm.email, loginForm.password);
    setLoading(false);

    if (!result.success) {
      if (result.status === "PENDING_APPROVAL") {
        setStatusNotice({
          type: "pending",
          title: "Account Awaiting Approval",
          message: "Your account is still awaiting administrator approval. You will be notified once an administrator approves your registration."
        });
      } else if (result.status === "REJECTED") {
        setStatusNotice({
          type: "rejected",
          title: "Registration Rejected",
          message: result.message || "Your employee registration was rejected. Please contact your administrator."
        });
      } else if (result.status === "SUSPENDED") {
        setStatusNotice({
          type: "suspended",
          title: "Account Suspended",
          message: "Your account has been suspended. Please contact your administrator."
        });
      } else {
        setErrorMessage(result.message || "Invalid email or password.");
      }
      return;
    }

    if (onLoginSuccess) {
      onLoginSuccess(result.user);
    }
  };

  // Handle Employee Registration Submit
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setStatusNotice(null);
    setSuccessMessage("");

    if (employeeForm.password !== employeeForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await registerEmployee(employeeForm);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    // Per requirements: DO NOT authenticate, DO NOT give sales access, show message and redirect to login
    setSuccessMessage(
      "Your employee account is waiting for administrator approval. You will be able to log in once an administrator approves your account."
    );
    setStatusNotice({
      type: "pending",
      title: "Registration Submitted Successfully",
      message: "Your employee account is waiting for administrator approval. You will be able to log in once an administrator approves your account."
    });

    // Reset form and switch to login tab
    setEmployeeForm({
      fullName: "",
      employeeId: "",
      email: "",
      department: "Sales",
      requestedRole: "SALES_REP",
      password: "",
      confirmPassword: ""
    });
    setActiveTab("login");
  };

  // Handle Customer Registration Submit
  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setStatusNotice(null);
    setSuccessMessage("");

    if (customerForm.password !== customerForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await registerCustomer(customerForm);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    // Customer can immediately login
    if (onLoginSuccess) {
      onLoginSuccess(result.user);
    }
  };

  return (
    <div className="atmospheric-bg">
      {/* Floating feature pills inspired by DealFlow360 reference Image 2 */}
      <div className="floating-badge badge-approvals">
        <div style={{ color: "#f97316" }}><ShieldCheck size={18} /></div>
        <span>Approvals</span>
      </div>

      <div className="floating-badge badge-quotes">
        <div style={{ color: "#2563eb" }}><MessageSquare size={18} /></div>
        <span>Quotes</span>
      </div>

      <div className="floating-badge badge-fulfillment">
        <div style={{ color: "#10b981" }}><Truck size={18} /></div>
        <span>Fulfillment</span>
      </div>

      <div className="floating-badge badge-billing">
        <div style={{ color: "#6366f1" }}><Receipt size={18} /></div>
        <span>Billing</span>
      </div>

      <div className="floating-badge badge-insights">
        <div style={{ color: "#06b6d4" }}><TrendingUp size={18} /></div>
        <span>Insights</span>
      </div>

      {/* Main Auth Container */}
      <div className="auth-container">
        {/* DealFlow360 Hero Branding */}
        <div className="auth-header-brand">
          <div className="brand-logo-container">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 4h7a8 8 0 0 1 8 8 8 8 0 0 1-8 8H5V4z"
                stroke="#ffffff"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 12h5a3 3 0 0 0 3-3 3 3 0 0 0-3-3H5"
                stroke="#bfdbfe"
                strokeWidth="2.25"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="brand-title">DealFlow360</h1>
          <p className="brand-subtitle">From Opportunity to Outcome</p>
          <div className="brand-tagline">Smarter Deals. Stronger Business.</div>
        </div>

        {/* Card Component */}
        <div className="auth-card">
          {/* Main Tabs: Login / Signup */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === "login" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("login");
                setErrorMessage("");
              }}
            >
              Log In
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "signup" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("signup");
                setErrorMessage("");
              }}
            >
              Sign Up
            </button>
          </div>

          {/* User Category: Employee vs Customer */}
          <div className="category-switcher">
            <button
              type="button"
              className={`category-btn ${userCategory === "employee" ? "active" : ""}`}
              onClick={() => {
                setUserCategory("employee");
                setErrorMessage("");
              }}
            >
              <Briefcase size={15} /> Internal Employee
            </button>
            <button
              type="button"
              className={`category-btn ${userCategory === "customer" ? "active" : ""}`}
              onClick={() => {
                setUserCategory("customer");
                setErrorMessage("");
              }}
            >
              <Building size={15} /> Customer Portal
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="alert alert-danger">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="alert alert-success">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Status Notice (Pending Approval or Rejected banner) */}
          {statusNotice && (
            <div
              className={`alert ${
                statusNotice.type === "pending"
                  ? "alert-warning"
                  : statusNotice.type === "rejected"
                  ? "alert-danger"
                  : "alert-info"
              }`}
            >
              <Info size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>{statusNotice.title}</strong>
                <div style={{ marginTop: "3px" }}>{statusNotice.message}</div>
              </div>
            </div>
          )}

          {/* ================= LOGIN FORM ================= */}
          {activeTab === "login" && (
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label">
                  {userCategory === "employee" ? "Work Email Address" : "Email Address"}
                </label>
                <div className="input-wrapper">
                  <div className="input-icon"><Mail size={16} /></div>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder={
                      userCategory === "employee"
                        ? "employee@dealflow360.com"
                        : "name@company.com"
                    }
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="form-label">Password</label>
                  <button
                    type="button"
                    style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}
                    onClick={() => setForgotPasswordModal(true)}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="input-wrapper">
                  <div className="input-icon"><Lock size={16} /></div>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ marginTop: "1rem" }}
              >
                {loading ? "Signing in..." : "Log In"}
                {!loading && <ArrowRight size={16} />}
              </button>

              {/* Quick Demo Credentials Bar for Hackathon judges & testers */}
              <div className="demo-bar">
                <div className="demo-title">
                  <HelpCircle size={14} /> Hackathon Quick Demo Accounts:
                </div>
                <div className="demo-chips">
                  <button
                    type="button"
                    className="demo-chip"
                    onClick={() =>
                      fillDemoCredentials(
                        "admin@dealflow360.com",
                        "Admin@123456",
                        "employee"
                      )
                    }
                    title="System Admin Account"
                  >
                    👑 Demo Admin
                  </button>
                  <button
                    type="button"
                    className="demo-chip"
                    onClick={() =>
                      fillDemoCredentials(
                        "sales@demo.com",
                        "SalesPassword123!",
                        "employee"
                      )
                    }
                    title="Approved Sales User (requires approval first)"
                  >
                    💼 Demo Sales
                  </button>
                  <button
                    type="button"
                    className="demo-chip"
                    onClick={() =>
                      fillDemoCredentials(
                        "customer@acme.com",
                        "CustomerPassword123!",
                        "customer"
                      )
                    }
                    title="Customer Portal User"
                  >
                    🏢 Demo Customer
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================= EMPLOYEE SIGNUP FORM ================= */}
          {activeTab === "signup" && userCategory === "employee" && (
            <form onSubmit={handleEmployeeSubmit}>
              <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                  Employee Registration
                </h2>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Requires administrator approval before access is granted.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-wrapper">
                  <div className="input-icon"><User size={16} /></div>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Rahul Sharma"
                    value={employeeForm.fullName}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, fullName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <div className="input-wrapper">
                    <div className="input-icon"><IdCard size={16} /></div>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="EMP-1024"
                      value={employeeForm.employeeId}
                      onChange={(e) =>
                        setEmployeeForm({
                          ...employeeForm,
                          employeeId: e.target.value
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select no-icon"
                    value={employeeForm.department}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        department: e.target.value
                      })
                    }
                  >
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Work Email</label>
                <div className="input-wrapper">
                  <div className="input-icon"><Mail size={16} /></div>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="rahul@company.com"
                    value={employeeForm.email}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Requested Role</label>
                <select
                  className="form-select no-icon"
                  value={employeeForm.requestedRole}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      requestedRole: e.target.value
                    })
                  }
                >
                  <option value="SALES_REP">Sales Representative</option>
                  <option value="SALES_MANAGER">Sales Manager</option>
                  <option value="FINANCE">Finance Specialist</option>
                  <option value="OPERATIONS">Operations Coordinator</option>
                </select>
                <small style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                  * ADMIN roles are not self-service and require executive appointment.
                </small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrapper">
                    <div className="input-icon"><Lock size={16} /></div>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="Min 6 chars"
                      value={employeeForm.password}
                      onChange={(e) =>
                        setEmployeeForm({
                          ...employeeForm,
                          password: e.target.value
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-wrapper">
                    <div className="input-icon"><Lock size={16} /></div>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="Re-enter password"
                      value={employeeForm.confirmPassword}
                      onChange={(e) =>
                        setEmployeeForm({
                          ...employeeForm,
                          confirmPassword: e.target.value
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ marginTop: "0.5rem" }}
              >
                {loading ? "Submitting Registration..." : "Submit Registration"}
              </button>
            </form>
          )}

          {/* ================= CUSTOMER SIGNUP FORM ================= */}
          {activeTab === "signup" && userCategory === "customer" && (
            <form onSubmit={handleCustomerSubmit}>
              <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                  Customer Registration
                </h2>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Instant access to your quotations and order portal.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Company Name</label>
                <div className="input-wrapper">
                  <div className="input-icon"><Building size={16} /></div>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Acme Corporation"
                    value={customerForm.companyName}
                    onChange={(e) =>
                      setCustomerForm({
                        ...customerForm,
                        companyName: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-wrapper">
                  <div className="input-icon"><User size={16} /></div>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Rahul Sharma"
                    value={customerForm.fullName}
                    onChange={(e) =>
                      setCustomerForm({
                        ...customerForm,
                        fullName: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-wrapper">
                  <div className="input-icon"><Mail size={16} /></div>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="rahul@acme.com"
                    value={customerForm.email}
                    onChange={(e) =>
                      setCustomerForm({
                        ...customerForm,
                        email: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrapper">
                    <div className="input-icon"><Lock size={16} /></div>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="Min 6 chars"
                      value={customerForm.password}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          password: e.target.value
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-wrapper">
                    <div className="input-icon"><Lock size={16} /></div>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="Re-enter password"
                      value={customerForm.confirmPassword}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          confirmPassword: e.target.value
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ marginTop: "0.5rem" }}
              >
                {loading ? "Creating Customer Account..." : "Create Account"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotPasswordModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Reset Your Password</h3>
              <button
                type="button"
                onClick={() => setForgotPasswordModal(false)}
                style={{ color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "1.25rem" }}>
              For enterprise security and governance in DealFlow360:
            </p>
            <div
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                color: "#334155",
                lineHeight: "1.6"
              }}
            >
              <div>• <strong>Internal Employees:</strong> Please contact your System Administrator at <code>admin@dealflow360.com</code> or reach out to internal IT.</div>
              <div style={{ marginTop: "8px" }}>• <strong>Customer Accounts:</strong> Password recovery links are dispatched to your registered domain email.</div>
            </div>
            <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto", padding: "0.5rem 1.25rem" }}
                onClick={() => setForgotPasswordModal(false)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
