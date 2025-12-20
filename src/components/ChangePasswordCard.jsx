// src/components/ChangePasswordCard.jsx
import React, { useState } from "react";
import api from "../utils/api";

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      alert("New passwords do not match");
      return;
    }
    try {
      setSaving(true);
      await api.patch("/auth/change-password", {
        currentPassword,
        newPassword
      });
      alert("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      alert(err.response?.data?.message || "Error updating password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>Change My Password</h2>
      <form className="form-grid" onSubmit={handleChange}>
        <label className="full-row">
          Current Password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          New Password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Confirm New Password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <div className="full-row">
          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
