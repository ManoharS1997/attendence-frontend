// src/pages/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";

export default function LoginPage() {
  const { login, loading } = useAuth();

  // "admin" | "manager" | "employee"
  const [mode, setMode] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const role =
      mode === "admin"
        ? "admin"
        : mode === "manager"
        ? "manager" // ✅ HR still logs in as manager role
        : "employee";

    await login({ email, password, role, auto: false });
  };

  // ✅ Updated helper messages
  const resetMessage =
    mode === "employee"
      ? "Forgot password? Ask HR to reset it from the HR dashboard."
      : mode === "manager"
      ? "Forgot password? Ask the Admin to reset it from the Admin dashboard."
      : "Forgot password? Another Admin can reset it from the Admin dashboard.";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrapper">
          <img
            src="/Company Logo.PNG"
            alt="NowIT Services"
            className="login-logo"
          />
        </div>

        <h1>2026 Attendance Tracker</h1>
        <p className="subtitle">Sign in with your NowIT email account</p>

        <div className="login-tabs">
          <button
            type="button"
            className={mode === "admin" ? "tab active" : "tab"}
            onClick={() => handleModeChange("admin")}
          >
            Admin Login
          </button>

          {/* ✅ Manager renamed to HR */}
          <button
            type="button"
            className={mode === "manager" ? "tab active" : "tab"}
            onClick={() => handleModeChange("manager")}
          >
            HR Login
          </button>

          <button
            type="button"
            className={mode === "employee" ? "tab active" : "tab"}
            onClick={() => handleModeChange("employee")}
          >
            Employee Login
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              placeholder="you@nowitservices.com"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            Password
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
            />
          </label>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="helper">{resetMessage}</p>
      </div>
    </div>
  );
}
