import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const API_BASE = "http://localhost:5000/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("dealflow_token") || null);
  const [loading, setLoading] = useState(true);

  // Validate session on boot
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();

        if (res.ok && data.success && data.user) {
          setUser(data.user);
        } else {
          // Token expired or invalid
          localStorage.removeItem("dealflow_token");
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error("Failed to fetch current user session:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  // Login handler
  async function login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          status: data.status,
          message: data.message || "Invalid credentials"
        };
      }

      if (data.token) {
        localStorage.setItem("dealflow_token", data.token);
        setToken(data.token);
        setUser(data.user);
      }

      return {
        success: true,
        user: data.user,
        token: data.token,
        message: data.message
      };
    } catch (err) {
      return {
        success: false,
        message: "Unable to connect to DealFlow360 server. Please try again."
      };
    }
  }

  // Employee registration handler (returns PENDING_APPROVAL, no session)
  async function registerEmployee(formData) {
    try {
      const res = await fetch(`${API_BASE}/auth/employee/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          message: data.message || "Registration failed."
        };
      }

      return {
        success: true,
        status: data.status,
        message: data.message,
        user: data.user
      };
    } catch (err) {
      return {
        success: false,
        message: "Server connection failed during registration."
      };
    }
  }

  // Customer registration handler (returns ACTIVE, creates session)
  async function registerCustomer(formData) {
    try {
      const res = await fetch(`${API_BASE}/auth/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          message: data.message || "Customer registration failed."
        };
      }

      if (data.token) {
        localStorage.setItem("dealflow_token", data.token);
        setToken(data.token);
        setUser(data.user);
      }

      return {
        success: true,
        user: data.user,
        token: data.token,
        message: data.message
      };
    } catch (err) {
      return {
        success: false,
        message: "Server connection failed during customer registration."
      };
    }
  }

  // Logout handler
  async function logout() {
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // ignore logout network errors
      }
    }
    localStorage.removeItem("dealflow_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        registerEmployee,
        registerCustomer,
        logout,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
