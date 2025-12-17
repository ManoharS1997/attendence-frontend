// src/components/AttendanceForm.jsx
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
  "COMPOFF"
];

// statuses that always go through Manager approval
const APPROVAL_STATUSES = [
  "PRESENT HALF DAY",
  "Half Day - Fun Thursday",
  "Half Day - Development",
  "EMERGENCY LEAVE",
  "CASUAL LEAVE",
  "COMPOFF",
  "ABSENT"
];

export default function AttendanceForm({ onSaved }) {
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
  const [note, setNote] = useState("");

  // Comp-off: extra work & compensation details
  const [extraWork, setExtraWork] = useState({
    workedDate: "",
    workedTime: "",
    hours: "",
    compOffDate: "",
    compOffTime: ""
  });

  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      const payload = {
        date,
        status,
        workInTime,
        workOutTime,
        note
      };

      if (status === "COMPOFF") {
        payload.isLeaveRequest = true;
        payload.extraWork = extraWork;
      }

      await api.post("/attendance", payload);

      if (APPROVAL_STATUSES.includes(status)) {
        alert(
          "Attendance / leave request submitted to Manager for approval. It will be visible after Manager approval."
        );
      } else {
        alert("Attendance saved");
      }

      onSaved && onSaved();
    } catch (err) {
      alert(err.response?.data?.message || "Error saving attendance");
    } finally {
      setSaving(false);
    }
  };

  const handleExtraChange = (field, value) => {
    setExtraWork((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="card mark-card">
      <h2>Mark Attendance</h2>
      <form onSubmit={submit} className="form-grid">
        <label>
          <span>Date</span>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="DD-MM-YYYY"
          />
        </label>

        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="full-row badge-row">
          <span className="status-badge">{status}</span>
        </div>

        {status !== "COMPOFF" && (
          <>
            <label>
              <span>Work In Time</span>
              <input
                value={workInTime}
                onChange={(e) => setWorkInTime(e.target.value)}
              />
            </label>

            <label>
              <span>Work Out Time</span>
              <input
                value={workOutTime}
                onChange={(e) => setWorkOutTime(e.target.value)}
              />
            </label>
          </>
        )}

        <label className="full-row">
          <span>Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Emergency, client visit, etc."
          />
        </label>

        {status === "COMPOFF" && (
          <div className="full-row compoff-box">
            <h4>Comp-off Details (Extra Work)</h4>
            <div className="compoff-grid">
              <label>
                Extra Work Date
                <input
                  value={extraWork.workedDate}
                  onChange={(e) =>
                    handleExtraChange("workedDate", e.target.value)
                  }
                  placeholder="DD-MM-YYYY"
                />
              </label>
              <label>
                Extra Work Time
                <input
                  value={extraWork.workedTime}
                  onChange={(e) =>
                    handleExtraChange("workedTime", e.target.value)
                  }
                  placeholder="e.g. 18:00–20:00"
                />
              </label>
              <label>
                Extra Hours
                <input
                  value={extraWork.hours}
                  onChange={(e) =>
                    handleExtraChange("hours", e.target.value)
                  }
                  placeholder="e.g. 2"
                />
              </label>
              <label>
                Comp-off Date
                <input
                  value={extraWork.compOffDate}
                  onChange={(e) =>
                    handleExtraChange("compOffDate", e.target.value)
                  }
                  placeholder="DD-MM-YYYY"
                />
              </label>
              <label>
                Comp-off Time
                <input
                  value={extraWork.compOffTime}
                  onChange={(e) =>
                    handleExtraChange("compOffTime", e.target.value)
                  }
                  placeholder="e.g. 10:00–12:00"
                />
              </label>
            </div>
          </div>
        )}

        <div className="full-row">
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </form>
    </div>
  );
}
