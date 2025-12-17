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
    // when switching tab, clear fields so user always types manually
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const role =
      mode === "admin"
        ? "admin"
        : mode === "manager"
        ? "manager"
        : "employee";

    await login({ email, password, role, auto: false });
  };

  const resetMessage =
    mode === "employee"
      ? "Forgot password? Ask your Manager to reset it from the Manager dashboard."
      : mode === "manager"
      ? "Forgot password? Ask the Admin to reset it from the Admin dashboard."
      : "Forgot password? Another Admin can reset it from the Admin dashboard.";

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Company logo at the very top */}
        <div className="login-logo-wrapper">
          {/* File is in /public as "Company Logo.PNG" */}
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
          <button
            type="button"
            className={mode === "manager" ? "tab active" : "tab"}
            onClick={() => handleModeChange("manager")}
          >
            Manager Login
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
