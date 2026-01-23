import React, { useState, useEffect } from "react";
import api from "../api";

const STATUSES = [
  "PRESENT FULL DAY",
  "PRESENT HALF DAY",
  "EMERGENCY LEAVE",
  "CASUAL LEAVE",
  "PUBLIC HOLIDAY",
  "2ND SATURDAY",
  "SUNDAY",
  "Half Day - Fun Thursday",
  "Half Day - Development",
  "COMPOFF",
  "SICK LEAVE"
];

// statuses that always go through Manager approval
const APPROVAL_STATUSES = [
  "PRESENT HALF DAY",
  "Half Day - Fun Thursday",
  "Half Day - Development",
  "EMERGENCY LEAVE",
  "CASUAL LEAVE",
  "COMPOFF",
  "SICK LEAVE",
  "ABSENT"
];

export default function AttendanceForm({ onSaved, currentMonth, currentYear }) {
  const todayString = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const [date, setDate] = useState(todayString());
  const [status, setStatus] = useState("PRESENT FULL DAY");
  const [workInTime, setWorkInTime] = useState("10:00");
  const [workOutTime, setWorkOutTime] = useState("18:00");
  const [lunchBreak, setLunchBreak] = useState("30"); // in minutes
  const [note, setNote] = useState("");
  const [extraHours, setExtraHours] = useState(0);
  const [extraHoursReason, setExtraHoursReason] = useState("");

  const [extraWork, setExtraWork] = useState({
    workedDate: "",
    workedTime: "",
    hours: "",
    compOffDate: "",
    compOffTime: ""
  });

  const [saving, setSaving] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [showNotification, setShowNotification] = useState(false);

  // Calculate extra hours
  useEffect(() => {
    if (workInTime && workOutTime && status === "PRESENT FULL DAY") {
      const [inHour, inMin] = workInTime.split(":").map(Number);
      const [outHour, outMin] = workOutTime.split(":").map(Number);
      const lunchMinutes = parseInt(lunchBreak) || 0;

      const inMinutes = inHour * 60 + inMin;
      const outMinutes = outHour * 60 + outMin;

      const totalMinutes = outMinutes - inMinutes - lunchMinutes;
      const regularMinutes = 8 * 60;

      if (totalMinutes > regularMinutes) {
        const extra = (totalMinutes - regularMinutes) / 60;
        setExtraHours(parseFloat(extra.toFixed(1)));
      } else {
        setExtraHours(0);
      }
    } else {
      setExtraHours(0);
    }
  }, [workInTime, workOutTime, status, lunchBreak]);

  useEffect(() => {
    checkMonthlyNotification();
  }, []);

  const checkMonthlyNotification = async () => {
    try {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      await api.post("/notifications/monthly-welcome", { month, year });

      const notifications = await api.get("/notifications/my?unreadOnly=true");
      if (notifications.data.length > 0) {
        const latest = notifications.data[0];
        setNotificationMessage(`${latest.title}: ${latest.message}`);
        setShowNotification(true);

        setTimeout(() => setShowNotification(false), 10000);
      }
    } catch (error) {
      console.error("Notification error:", error);
    }
  };

  const handleExtraChange = (field, value) => {
    setExtraWork((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      const payload = {
        date,
        status,
        workInTime,
        workOutTime,
        lunchBreak: parseInt(lunchBreak) || 0,
        note
      };

      const needsApproval =
        APPROVAL_STATUSES.includes(status) ||
        (status === "PRESENT FULL DAY" && extraHours > 0);

      if (status === "COMPOFF") {
        payload.isLeaveRequest = true;
        payload.extraWork = extraWork;
      }

      if (status === "PRESENT FULL DAY" && extraHours > 0) {
        await api.post("/attendance/extra-hours", {
          date,
          extraHours,
          reason: extraHoursReason || "Extra hours worked"
        });
      }

      await api.post("/attendance", payload);

      setNotificationMessage(
        needsApproval
          ? "Request sent to Manager for approval."
          : "Attendance saved successfully!"
      );
      setShowNotification(true);

      setDate(todayString());
      setStatus("PRESENT FULL DAY");
      setWorkInTime("10:00");
      setWorkOutTime("18:00");
      setLunchBreak("30");
      setNote("");
      setExtraHours(0);
      setExtraHoursReason("");
      setExtraWork({
        workedDate: "",
        workedTime: "",
        hours: "",
        compOffDate: "",
        compOffTime: ""
      });

      onSaved && onSaved();
      setTimeout(() => setShowNotification(false), 5000);
    } catch (err) {
      setNotificationMessage(
        err.response?.data?.message || "Error saving attendance"
      );
      setShowNotification(true);
    } finally {
      setSaving(false);
    }
  };

  const calculateDateFromSelection = (day) => {
    if (!currentMonth || !currentYear) return todayString();
    return `${String(day).padStart(2, "0")}-${String(currentMonth).padStart(
      2,
      "0"
    )}-${currentYear}`;
  };

  const quickDates = [];
  if (currentMonth && currentYear) {
    const today = new Date().getDate();
    for (let i = 0; i < 3; i++) quickDates.push(today + i);
  }

  return (
    <div className="attendance-form-container">
      {showNotification && (
        <div className="notification-popup">
          <span>{notificationMessage}</span>
          <button onClick={() => setShowNotification(false)}>×</button>
        </div>
      )}

      <div className="form-header">
        <h2>Mark Attendance</h2>
        <p className="form-description">
          Please record your attendance for working days only. Sundays, 2nd Saturdays 
          and configured Public Holidays are treated as system holidays and cannot be edited.
        </p>
      </div>

      {quickDates.length > 0 && (
        <div className="quick-date-selector">
          {quickDates.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setDate(calculateDateFromSelection(day))}
            >
              {day}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="attendance-form">
        <div className="form-row">
          <div className="form-field">
            <label className="field-label">Date:</label>
            <input 
              type="text" 
              className="form-input"
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
              placeholder="dd-mm-yyyy"
            />
          </div>

          <div className="form-field">
            <label className="field-label">Status:</label>
            <select 
              className="form-select"
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {status.includes("PRESENT") && (
          <>
            <div className="time-section">
              <h3 className="section-title">Time Details</h3>
              <div className="time-fields">
                <div className="time-field">
                  <label className="time-label">Work In Time</label>
                  <input
                    type="time"
                    className="time-input"
                    value={workInTime}
                    onChange={(e) => setWorkInTime(e.target.value)}
                    required
                  />
                  <div className="time-hint">Required for present days</div>
                </div>
                
                <div className="time-field">
                  <label className="time-label">Work Out Time</label>
                  <input
                    type="time"
                    className="time-input"
                    value={workOutTime}
                    onChange={(e) => setWorkOutTime(e.target.value)}
                    required
                  />
                  <div className="time-hint">Required for present days</div>
                </div>
                
                <div className="time-field">
                  <label className="time-label">Lunch Break</label>
                  <select
                    className="form-select"
                    value={lunchBreak}
                    onChange={(e) => setLunchBreak(e.target.value)}
                  >
                    <option value="0">No Lunch Break</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                  <div className="time-hint">Deducted from total hours</div>
                </div>
              </div>
            </div>

            {extraHours > 0 && (
              <div className="extra-hours-notice">
                <div className="notice-content">
                  <strong>Extra hours calculated: {extraHours.toFixed(1)} hours</strong>
                  <div className="notice-details">
                    Regular hours: 8 hours | Lunch: {lunchBreak} minutes
                  </div>
                </div>
                <div className="extra-reason-field">
                  <label>Reason for extra hours (optional):</label>
                  <input
                    type="text"
                    className="form-input"
                    value={extraHoursReason}
                    onChange={(e) => setExtraHoursReason(e.target.value)}
                    placeholder="Briefly describe the extra work"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {status === "COMPOFF" && (
          <div className="compoff-section">
            <h3 className="section-title">Extra Work Details (for Comp Off)</h3>
            <div className="form-row">
              <div className="form-field">
                <label className="field-label">Worked Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={extraWork.workedDate}
                  onChange={(e) => handleExtraChange("workedDate", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Worked Time:</label>
                <input
                  type="time"
                  className="time-input"
                  value={extraWork.workedTime}
                  onChange={(e) => handleExtraChange("workedTime", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Hours Worked:</label>
                <input
                  type="number"
                  className="form-input"
                  value={extraWork.hours}
                  onChange={(e) => handleExtraChange("hours", e.target.value)}
                  min="0.5"
                  step="0.5"
                  placeholder="Hours"
                />
              </div>
            </div>
            <h3 className="section-title">Comp Off Request Details</h3>
            <div className="form-row">
              <div className="form-field">
                <label className="field-label">Comp Off Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={extraWork.compOffDate}
                  onChange={(e) => handleExtraChange("compOffDate", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Comp Off Time:</label>
                <input
                  type="time"
                  className="time-input"
                  value={extraWork.compOffTime}
                  onChange={(e) => handleExtraChange("compOffTime", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="note-section">
          <label className="field-label">Note (optional)</label>
          <textarea
            className="note-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Emergency, client visit, etc."
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={saving} className="submit-button">
            {saving ? (
              <>
                <span className="spinner"></span>
                Saving...
              </>
            ) : (
              "Save Attendance"
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .attendance-form-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .form-header {
          margin-bottom: 24px;
        }
        
        .form-header h2 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 24px;
        }
        
        .form-description {
          color: #666;
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }
        
        .attendance-form {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        
        .form-field {
          display: flex;
          flex-direction: column;
        }
        
        .field-label {
          font-weight: 500;
          margin-bottom: 6px;
          color: #444;
          font-size: 14px;
        }
        
        .form-input {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #0066cc;
          box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
        }
        
        .form-select {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }
        
        .form-select:focus {
          outline: none;
          border-color: #0066cc;
          box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
        }
        
        .time-section {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid #e9ecef;
        }
        
        .section-title {
          margin: 0 0 16px 0;
          color: #333;
          font-size: 16px;
          font-weight: 600;
        }
        
        .time-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
        }
        
        .time-field {
          display: flex;
          flex-direction: column;
        }
        
        .time-label {
          font-weight: 500;
          margin-bottom: 6px;
          color: #444;
          font-size: 14px;
        }
        
        .time-input {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: monospace;
          letter-spacing: 1px;
        }
        
        .time-input:focus {
          outline: none;
          border-color: #0066cc;
          box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
        }
        
        .time-hint {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        
        .extra-hours-notice {
          background: #fff8e1;
          border: 1px solid #ffd54f;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .notice-content {
          margin-bottom: 12px;
        }
        
        .notice-details {
          font-size: 13px;
          color: #666;
          margin-top: 4px;
        }
        
        .extra-reason-field {
          display: flex;
          flex-direction: column;
        }
        
        .extra-reason-field label {
          font-weight: 500;
          margin-bottom: 6px;
          color: #444;
          font-size: 14px;
        }
        
        .compoff-section {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid #e9ecef;
        }
        
        .note-section {
          margin-bottom: 24px;
        }
        
        .note-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
        }
        
        .note-textarea:focus {
          outline: none;
          border-color: #0066cc;
          box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
        }
        
        .form-actions {
          text-align: center;
        }
        
        .submit-button {
          background: #0066cc;
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          min-width: 200px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .submit-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .submit-button:hover:not(:disabled) {
          background: #0052a3;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .quick-date-selector {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .quick-date-selector button {
          padding: 8px 16px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .quick-date-selector button:hover {
          background: #f5f5f5;
          border-color: #ccc;
        }
        
        .notification-popup {
          background: #4caf50;
          color: white;
          padding: 12px 16px;
          border-radius: 4px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: slideIn 0.3s ease-out;
        }
        
        .notification-popup button {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}