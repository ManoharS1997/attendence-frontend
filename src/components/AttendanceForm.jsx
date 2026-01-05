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
  const [note, setNote] = useState("");
  const [extraHours, setExtraHours] = useState(0);
  const [showExtraHoursForm, setShowExtraHoursForm] = useState(false);
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

      const inMinutes = inHour * 60 + inMin;
      const outMinutes = outHour * 60 + outMin;

      const totalMinutes = outMinutes - inMinutes;
      const regularMinutes = 8 * 60;

      if (totalMinutes > regularMinutes) {
        const extra = (totalMinutes - regularMinutes) / 60;
        setExtraHours(parseFloat(extra.toFixed(1)));
        setShowExtraHoursForm(true);
      } else {
        setExtraHours(0);
        setShowExtraHoursForm(false);
      }
    } else {
      setExtraHours(0);
      setShowExtraHoursForm(false);
    }
  }, [workInTime, workOutTime, status]);

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
      setNote("");
      setExtraHours(0);
      setExtraHoursReason("");
      setShowExtraHoursForm(false);
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

  const handleExtraChange = (field, value) => {
    setExtraWork((prev) => ({ ...prev, [field]: value }));
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
    <div className="card mark-card">
      {showNotification && (
        <div className="notification-popup">
          <span>{notificationMessage}</span>
          <button onClick={() => setShowNotification(false)}>×</button>
        </div>
      )}

      <h2>Mark Attendance</h2>

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

      <form onSubmit={submit}>
        <input value={date} onChange={(e) => setDate(e.target.value)} required />

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        {status.includes("PRESENT") && (
          <>
            <input
              type="time"
              value={workInTime}
              onChange={(e) => setWorkInTime(e.target.value)}
            />
            <input
              type="time"
              value={workOutTime}
              onChange={(e) => setWorkOutTime(e.target.value)}
            />
          </>
        )}

        {extraHours > 0 && (
          <p>Extra hours calculated when work {" > "} 8 hours</p>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
        />

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </form>
    </div>
  );
}
