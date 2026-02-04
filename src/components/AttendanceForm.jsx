
import React, { useState } from "react";
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
  "SICK LEAVE",
  "ABSENT"
];

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

const LUNCH_BREAK_OPTIONS = [
  { value: "0", label: "No Lunch Break" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" }
];

export default function AttendanceForm({ onSaved }) {
  // Format date as dd-mm-yyyy
  const formatDate = (date) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const todayString = formatDate(new Date());

  // State
  const [date, setDate] = useState(todayString);
  const [status, setStatus] = useState("PRESENT FULL DAY");
  const [workInTime, setWorkInTime] = useState("10:00");
  const [workOutTime, setWorkOutTime] = useState("18:00");
  const [lunchBreak, setLunchBreak] = useState("30");
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
  const [notificationType, setNotificationType] = useState("success");

  // Helper function to calculate lunch times
  const getLunchTimes = () => {
    if (!lunchBreak || lunchBreak === "0") {
      return { lunchInTime: null, lunchOutTime: null };
    }

    const start = "13:00"; // fixed lunch start at 1 PM
    const minutes = parseInt(lunchBreak, 10);

    const [h, m] = start.split(":").map(Number);
    const endMinutes = h * 60 + m + minutes;

    const endH = String(Math.floor(endMinutes / 60)).padStart(2, "0");
    const endM = String(endMinutes % 60).padStart(2, "0");

    return {
      lunchInTime: start,
      lunchOutTime: `${endH}:${endM}`
    };
  };

  // Show notification with auto-hide
  const showMessage = (message, type = "success") => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);

    setTimeout(() => {
      setShowNotification(false);
    }, type === "error" ? 6000 : 4000);
  };

  // Handle extra work field changes
  const handleExtraChange = (field, value) => {
    setExtraWork((prev) => ({ ...prev, [field]: value }));
  };

  // Reset form to default values
  const resetForm = () => {
    setDate(todayString);
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
  };

  // Validate form data
  const validateForm = () => {
    // Date validation (dd-mm-yyyy format)
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(date)) {
      showMessage("Please enter date in dd-mm-yyyy format", "error");
      return false;
    }

    // Split and validate date components
    const [day, month, year] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);

    if (
      dateObj.getDate() !== day ||
      dateObj.getMonth() + 1 !== month ||
      dateObj.getFullYear() !== year
    ) {
      showMessage("Invalid date entered", "error");
      return false;
    }

    // Time validation for present days
    if (status.includes("PRESENT")) {
      if (!workInTime || !workOutTime) {
        showMessage("Work in and out times are required for present days", "error");
        return false;
      }

      if (workOutTime <= workInTime) {
        showMessage("Work out time must be after work in time", "error");
        return false;
      }
    }

    // COMPOFF validation
    if (status === "COMPOFF") {
      if (!extraWork.workedDate || !extraWork.compOffDate) {
        showMessage("Both worked date and comp off date are required for COMPOFF", "error");
        return false;
      }

      if (!extraWork.hours || parseFloat(extraWork.hours) <= 0) {
        showMessage("Please enter valid hours worked for COMPOFF", "error");
        return false;
      }
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      // Get lunch times from helper function
      const { lunchInTime, lunchOutTime } =
        status === "PRESENT FULL DAY"
          ? getLunchTimes()
          : { lunchInTime: null, lunchOutTime: null };


      const payload = {
        requestType: "AUTO", // helps backend understand intent (CREATE / UPDATE)

        date,
        status,
        workInTime: status.includes("PRESENT") ? workInTime : null,
        workOutTime: status.includes("PRESENT") ? workOutTime : null,
        lunchInTime,
        lunchOutTime,
        note: note.trim() || null
      };

      // Add extra work details for COMPOFF
      if (status === "COMPOFF") {
        payload.extraWork = {
          workedDate: extraWork.workedDate,
          workedMinutes: Number(extraWork.hours) * 60,
          approved: false
        };
        payload.isLeaveRequest = true;
      }



      // Submit attendance
      await api.post("/attendance", payload);

      // Show success message
      showMessage(
        status === "PRESENT FULL DAY" && date === todayString
          ? "Attendance saved successfully!"
          : "Attendance saved! Request sent to Manager for approval.",
        "success"
      );


      // Reset form and notify parent
      resetForm();
      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      console.error("Error saving attendance:", err);
      showMessage(
        err.response?.data?.message || "Error saving attendance. Please try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // Generate quick date buttons for current/next few days
  const generateQuickDates = () => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 3; i++) {
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + i);
      dates.push({
        date: formatDate(nextDate),
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : `Day +${i}`
      });
    }

    return dates;
  };

  const quickDates = generateQuickDates();

  return (
    <div className="attendance-form-container">
      {/* Notification Popup */}
      {showNotification && (
        <div className={`notification-popup ${notificationType}`}>
          <span>{notificationMessage}</span>
          <button
            onClick={() => setShowNotification(false)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Form Header */}
      <div className="form-header">
        <h2>Mark Attendance</h2>
        <p className="form-description">
          Record your daily attendance. Sundays, 2nd Saturdays, and Public Holidays
          are automatically marked as non-working days.
        </p>
      </div>

      {/* Quick Date Selector */}
      {quickDates.length > 0 && (
        <div className="quick-date-selector">
          <p className="quick-date-label">Quick select:</p>
          <div className="quick-date-buttons">
            {quickDates.map((item) => (
              <button
                key={item.date}
                type="button"
                className="quick-date-btn"
                onClick={() => setDate(item.date)}
                disabled={saving}
              >
                {item.label}
                <span className="quick-date">{item.date.split('-')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="attendance-form">
        {/* Date and Status Row */}
        <div className="form-row">
          <div className="form-field">
            <label className="field-label" htmlFor="date">
              Date <span className="required">*</span>
            </label>
            <input
              id="date"
              type="text"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              placeholder="DD-MM-YYYY"
              pattern="\d{2}-\d{2}-\d{4}"
              disabled={saving}
            />
            <div className="field-hint">Format: DD-MM-YYYY</div>
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor="status">
              Status <span className="required">*</span>
            </label>
            <select
              id="status"
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              disabled={saving || status.includes("Half Day")}

            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="field-hint">
              {APPROVAL_STATUSES.includes(status) && (


                <span className="approval-notice">Requires manager approval</span>
              )}
            </div>
          </div>
        </div>

        {/* Time Details Section - Only for PRESENT statuses */}
        {(status.includes("PRESENT") || status.includes("Half Day")) && (
          <div className="time-section">
            <h3 className="section-title">Time Details</h3>
            <div className="time-fields">
              <div className="time-field">
                <label className="time-label">
                  Work In Time <span className="required">*</span>
                </label>
                <input
                  type="time"
                  className="time-input"
                  value={workInTime}
                  onChange={(e) => setWorkInTime(e.target.value)}
                  required
                  disabled={saving}
                />
                <div className="time-hint">Start of work day</div>
              </div>

              <div className="time-field">
                <label className="time-label">
                  Work Out Time <span className="required">*</span>
                </label>
                <input
                  type="time"
                  className="time-input"
                  value={workOutTime}
                  onChange={(e) => setWorkOutTime(e.target.value)}
                  required
                  disabled={saving}
                />
                <div className="time-hint">End of work day</div>
              </div>

              {status === "PRESENT FULL DAY" && (
                <div className="time-field">
                  <label className="time-label">Lunch Break</label>
                  <select
                    className="form-select"
                    value={lunchBreak}
                    onChange={(e) => setLunchBreak(e.target.value)}
                    disabled={saving}
                  >
                    {LUNCH_BREAK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="time-hint">Fixed lunch at 13:00</div>
                </div>
              )}
            </div>

            {/* Extra Hours Info - Display only from backend */}
            {extraHours > 0 && status === "PRESENT FULL DAY" && (
              <div className="extra-hours-notice">
                <div className="notice-header">
                  <span className="notice-icon">⏰</span>
                  <strong>Extra hours recorded: {extraHours.toFixed(1)} hours</strong>
                </div>
                <div className="extra-reason-field">
                  <label>
                    Reason for extra hours (optional):
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={extraHoursReason}
                    onChange={(e) => setExtraHoursReason(e.target.value)}
                    placeholder="Briefly describe why you worked extra hours"
                    disabled={saving}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPOFF Section */}
        {status === "COMPOFF" && (
          <div className="compoff-section">
            <h3 className="section-title">Extra Work Details (for Comp Off)</h3>
            <div className="form-row">
              <div className="form-field">
                <label className="field-label">
                  Worked Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={extraWork.workedDate}
                  onChange={(e) => handleExtraChange("workedDate", e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Worked Time</label>
                <input
                  type="time"
                  className="time-input"
                  value={extraWork.workedTime}
                  onChange={(e) => handleExtraChange("workedTime", e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-field">
                <label className="field-label">
                  Hours Worked <span className="required">*</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={extraWork.hours}
                  onChange={(e) => handleExtraChange("hours", e.target.value)}
                  min="0.5"
                  step="0.5"
                  placeholder="e.g., 2.5"
                  required
                  disabled={saving}
                />
              </div>
            </div>
            <h3 className="section-title">Comp Off Request Details</h3>
            <div className="form-row">
              <div className="form-field">
                <label className="field-label">
                  Comp Off Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={extraWork.compOffDate}
                  onChange={(e) => handleExtraChange("compOffDate", e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Comp Off Time</label>
                <input
                  type="time"
                  className="time-input"
                  value={extraWork.compOffTime}
                  onChange={(e) => handleExtraChange("compOffTime", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        )}

        {/* Note Section */}
        <div className="note-section">
          <label className="field-label" htmlFor="note">
            Additional Notes (optional)
          </label>
          <textarea
            id="note"
            className="note-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any additional information: emergency, client meeting, work from home, etc."
            rows="3"
            disabled={saving}
          />
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={saving}
            className={`submit-button ${saving ? 'saving' : ''}`}
          >
            {saving ? (
              <>
                <span className="spinner"></span>
                Saving...
              </>
            ) : (
              'Save Attendance'
            )}
          </button>
        </div>
      </form>

      {/* Inline Styles */}
      <style jsx>{`
        .attendance-form-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
        }
        
        .form-header {
          margin-bottom: 28px;
        }
        
        .form-header h2 {
          margin: 0 0 12px 0;
          color: #1a365d;
          font-size: 28px;
          font-weight: 600;
        }
        
        .form-description {
          color: #4a5568;
          font-size: 15px;
          line-height: 1.6;
          margin: 0;
          max-width: 700px;
        }
        
        .quick-date-selector {
          background: #f7fafc;
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
        }
        
        .quick-date-label {
          font-size: 14px;
          color: #4a5568;
          margin: 0 0 12px 0;
          font-weight: 500;
        }
        
        .quick-date-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        
        .quick-date-btn {
          flex: 1;
          min-width: 100px;
          padding: 12px 16px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #2d3748;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .quick-date-btn:hover:not(:disabled) {
          background: #edf2f7;
          border-color: #cbd5e0;
        }
        
        .quick-date-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .quick-date {
          font-size: 12px;
          color: #718096;
          margin-top: 4px;
        }
        
        .attendance-form {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }
        
        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 28px;
        }
        
        .form-field {
          display: flex;
          flex-direction: column;
        }
        
        .field-label {
          font-weight: 600;
          margin-bottom: 8px;
          color: #2d3748;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .required {
          color: #e53e3e;
        }
        
        .form-input {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          transition: all 0.2s;
          color: #2d3748;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }
        
        .form-input:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }
        
        .field-hint {
          font-size: 12px;
          color: #718096;
          margin-top: 6px;
          min-height: 18px;
        }
        
        .approval-notice {
          color: #ed8936;
          font-weight: 500;
        }
        
        .form-select {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          background: white;
          cursor: pointer;
          color: #2d3748;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 40px;
        }
        
        .form-select:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }
        
        .form-select:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }
        
        .time-section {
          background: #f8fafc;
          border-radius: 10px;
          padding: 24px;
          margin-bottom: 28px;
          border: 2px solid #e2e8f0;
        }
        
        .section-title {
          margin: 0 0 20px 0;
          color: #2d3748;
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .section-title::before {
          content: '';
          display: block;
          width: 4px;
          height: 18px;
          background: #4299e1;
          border-radius: 2px;
        }
        
        .time-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
        }
        
        .time-field {
          display: flex;
          flex-direction: column;
        }
        
        .time-label {
          font-weight: 600;
          margin-bottom: 8px;
          color: #2d3748;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .time-input {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          letter-spacing: 1px;
          color: #2d3748;
        }
        
        .time-input:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }
        
        .time-input:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }
        
        .time-hint {
          font-size: 12px;
          color: #718096;
          margin-top: 6px;
        }
        
        .extra-hours-notice {
          background: linear-gradient(135deg, #fffaf0, #feebc8);
          border: 2px solid #ed8936;
          border-radius: 10px;
          padding: 20px;
          margin-top: 20px;
        }
        
        .notice-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .notice-icon {
          font-size: 20px;
        }
        
        .notice-details {
          font-size: 13px;
          color: #744210;
          margin-bottom: 16px;
          padding-left: 32px;
        }
        
        .extra-reason-field {
          display: flex;
          flex-direction: column;
        }
        
        .extra-reason-field label {
          font-weight: 600;
          margin-bottom: 8px;
          color: #744210;
          font-size: 14px;
        }
        
        .compoff-section {
          background: #f0fff4;
          border-radius: 10px;
          padding: 24px;
          margin-bottom: 28px;
          border: 2px solid #9ae6b4;
        }
        
        .note-section {
          margin-bottom: 32px;
        }
        
        .note-textarea {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          resize: vertical;
          font-family: inherit;
          color: #2d3748;
          min-height: 100px;
          transition: all 0.2s;
        }
        
        .note-textarea:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }
        
        .note-textarea:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }
        
        .note-textarea::placeholder {
          color: #a0aec0;
        }
        
        .form-actions {
          text-align: center;
          padding-top: 24px;
          border-top: 2px solid #e2e8f0;
        }
        
        .submit-button {
          background: linear-gradient(135deg, #4299e1, #3182ce);
          color: white;
          border: none;
          padding: 16px 40px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          min-width: 240px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
        }
        
        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(66, 153, 225, 0.4);
          background: linear-gradient(135deg, #3182ce, #2b6cb0);
        }
        
        .submit-button:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .submit-button:disabled {
          background: #cbd5e0;
          box-shadow: none;
          cursor: not-allowed;
        }
        
        .submit-button.saving {
          background: linear-gradient(135deg, #718096, #4a5568);
        }
        
        .spinner {
          width: 18px;
          height: 18px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .notification-popup {
          padding: 16px 20px;
          border-radius: 10px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          animation: slideIn 0.3s ease-out;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .notification-popup.success {
          background: linear-gradient(135deg, #48bb78, #38a169);
          color: white;
        }
        
        .notification-popup.error {
          background: linear-gradient(135deg, #f56565, #e53e3e);
          color: white;
        }
        
        .notification-popup span {
          flex: 1;
          padding-right: 12px;
          line-height: 1.5;
        }
        
        .notification-popup button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        
        .notification-popup button:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
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
