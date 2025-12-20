// src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import logo from "../assets/Company Logo.png";
import { calculateProjectHours } from "../utils/hours";

// ---------- CONSTANTS ----------
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getCurrentMonth = () => {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  };
};

// Attendance statuses that represent requests to Manager
const REQUEST_STATUSES = [
  "EMERGENCY LEAVE",
  "CASUAL LEAVE",
  "COMPOFF",
  "PRESENT HALF DAY",
  "Half Day - Fun Thursday",
  "Half Day - Development",
];

// Build calendar matrix: [[{ day, dateKey, date }, ... 7], ...]
const buildMonthMatrix = (month, year) => {
  const y = Number(year);
  const m = Number(month); // 1–12
  const first = new Date(y, m - 1, 1);
  const firstWeekday = first.getDay(); // 0 (Sun) – 6 (Sat)
  const daysInMonth = new Date(y, m, 0).getDate();

  const weeks = [];
  let dayCounter = 1 - firstWeekday;

  while (dayCounter <= daysInMonth) {
    const week = [];
    for (let i = 0; i < 7; i += 1, dayCounter += 1) {
      if (dayCounter < 1 || dayCounter > daysInMonth) {
        week.push(null);
      } else {
        const date = new Date(y, m - 1, dayCounter);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;
        week.push({ day: dayCounter, dateKey, date });
      }
    }
    weeks.push(week);
  }

  return weeks;
};

// helper: convert "YYYY-MM-DD" -> "DD-MM-YYYY"
const toDdMmYyyy = (dateKey) => {
  if (!dateKey) return "";
  const [yyyy, mm, dd] = dateKey.split("-");
  return `${dd}-${mm}-${yyyy}`;
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("dashboard");

  const [{ month, year }, setMonthYear] = useState(getCurrentMonth);
  const [attendance, setAttendance] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [projects, setProjects] = useState([]);

  // All project tasks (view only)
  const [allTasks, setAllTasks] = useState([]);

  // Holidays (read-only)
  const [calendarDays, setCalendarDays] = useState([]); // from /leave/calendar
  const [holidaySettings, setHolidaySettings] = useState([]); // from /holidays

  // UI: filter for tasks CSV
  const [selectedProjectForExport, setSelectedProjectForExport] = useState("");

  // ---------- LOGOUT (log to backend) ----------
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Admin logout log error:", err?.response || err);
    } finally {
      logout();
    }
  };

  // ---------- LOADERS ----------
  const loadAttendance = useCallback(async () => {
    try {
      const res = await api.get("/attendance", { params: { month, year } });
      setAttendance(res.data || []);
    } catch (err) {
      console.error("loadAttendance error:", err);
      setAttendance([]);
    }
  }, [month, year]);

  const loadSummaries = useCallback(async () => {
    try {
      const res = await api.get("/leave/summary/all", {
        params: { month, year },
      });
      setSummaries(res.data || []);
    } catch (err) {
      console.error("loadSummaries error:", err);
      setSummaries([]);
    }
  }, [month, year]);

  // Holidays: /leave/calendar gives base (weekends + mandatory),
  // /holidays gives optional public holidays + taken/not taken.
  const loadHolidays = useCallback(async () => {
    try {
      const [calRes, settingsRes] = await Promise.all([
        api.get("/leave/calendar", { params: { month, year } }),
        api.get("/holidays", { params: { month, year } }),
      ]);

      setCalendarDays(calRes.data?.days || []);
      setHolidaySettings(settingsRes.data || []);
    } catch (err) {
      console.error("Admin load holidays error:", err?.response || err);
      setCalendarDays([]);
      setHolidaySettings([]);
    }
  }, [month, year]);

  // Projects + tasks (admin view)
  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get("/projects");
      const list = res.data || [];
      setProjects(list);

      // Prefer single admin API for all tasks
      try {
        const allRes = await api.get("/tasks/all-admin");
        const data = allRes.data || [];
        const mapped = data.map((t) => {
          const projectId =
            t.project?._id ||
            t.projectId ||
            (typeof t.project === "string" ? t.project : null);
          const project =
            t.project ||
            t.projectId ||
            list.find((p) => p._id === projectId) ||
            null;
          return {
            ...t,
            project,
          };
        });
        setAllTasks(mapped);
        return;
      } catch (errAll) {
        // fallback
        console.warn(
          "/tasks/all-admin not available, falling back to per-project fetch",
          errAll?.response || errAll
        );
      }

      // Fallback: per-project calls
      const all = [];
      for (const p of list) {
        if (!p._id) continue;
        try {
          const tr = await api.get(`/tasks/project/${p._id}`);
          const tasksForProject = tr.data || [];
          tasksForProject.forEach((t) => {
            all.push({
              ...t,
              project: t.project || t.projectId || p,
            });
          });
        } catch (err) {
          console.warn(`Failed to load tasks for project ${p._id}`, err);
        }
      }
      setAllTasks(all);
    } catch (err) {
      console.error("loadProjects error:", err);
      setProjects([]);
      setAllTasks([]);
    }
  }, []);

  useEffect(() => {
    // load projects asap
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadAttendance();
    loadSummaries();
    loadHolidays();
  }, [loadAttendance, loadSummaries, loadHolidays]);

  // ---------- CSV DOWNLOAD HELPERS ----------
  const downloadCsv = async (url, params = {}, filename) => {
    try {
      const res = await api.get(url, {
        params,
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const urlObj = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = urlObj;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(urlObj);
    } catch (err) {
      console.error("CSV download error:", err);
      alert("Failed to download CSV. Check console for details.");
    }
  };

  // 1) Attendance CSV
  const handleDownloadAttendanceCsv = async () => {
    const fileMonth = month || "ALL";
    const fileYear = year || "ALL";
    const filename = `attendance-${fileMonth}-${fileYear}.csv`;
    await downloadCsv("/export/attendance/csv", { month, year }, filename);
  };

  // 2) Tasks CSV (optionally filtered by project)
  const handleDownloadTasksCsv = async () => {
    const projectId = selectedProjectForExport || undefined;
    const filename = `tasks-${projectId || "ALL"}-${month || "ALL"}-${year || "ALL"}.csv`;
    await downloadCsv("/export/tasks/csv", { projectId }, filename);
  };

  // 3) Leaves CSV
  const handleDownloadLeavesCsv = async () => {
    const fileMonth = month || "ALL";
    const fileYear = year || "ALL";
    const filename = `leaves-${fileMonth}-${fileYear}.csv`;
    await downloadCsv("/export/leaves/csv", { month, year }, filename);
  };

  // 4) Monthly Leave Summary CSV
  const handleDownloadLeaveSummaryCsv = async () => {
    if (!month || !year) {
      alert("Please select month and year before downloading the leave summary.");
      return;
    }
    const filename = `leave-summary-${month}-${year}.csv`;
    await downloadCsv("/export/leave-summary/csv", { month, year }, filename);
  };

  // ---------- COMMON HELPERS ----------
  const handleMonthChange = (e) => {
    const [m, y] = e.target.value.split("-");
    setMonthYear({ month: m, year: y });
  };

  const monthLabel = `${monthNames[Number(month) - 1]}, ${year}`;

  // ---- Reports data (view-only) ----
  const hoursByEmployee = useMemo(() => {
    const map = {};
    attendance.forEach((a) => {
      const userId = a.user?._id || a.user;
      if (!userId) return;
      if (!map[userId]) map[userId] = [];
      map[userId].push(a);
    });
    const result = {};
    Object.keys(map).forEach((id) => {
      const { totalHours } = calculateProjectHours(map[id]);
      result[id] = totalHours;
    });
    return result;
  }, [attendance]);

  const projectTotals = projects.reduce((acc, p) => {
    let used = 0;
    (p.assignments || []).forEach((a) => {
      const id = (a.user && a.user._id) || a.user;
      if (!id) return;
      used += hoursByEmployee[id] || 0;
    });
    acc[p._id] = {
      used,
      remaining: Math.max(0, (p.totalEstimatedHours || 355) - used),
    };
    return acc;
  }, {});

  const totalEmployees = summaries.length;
  const activeEmployees = summaries.length; // summary doesn’t include isActive flag

  const totalHoursMonth = Object.values(hoursByEmployee).reduce(
    (sum, h) => sum + h,
    0
  );
  const totalLeavesTaken = summaries.reduce(
    (sum, s) => sum + (s.leavesTaken || 0),
    0
  );
  const totalHalfDays = summaries.reduce(
    (sum, s) => sum + (s.totalHalfDays || 0),
    0
  );

  const employeeHoursRows = summaries
    .map((s) => ({
      id: s.userId,
      fullName: s.fullName,
      email: s.email,
      workedHours: hoursByEmployee[s.userId] || 0,
      leavesTaken: s.leavesTaken ?? "-",
      totalHalfDays: s.totalHalfDays ?? "-",
    }))
    .sort((a, b) => b.workedHours - a.workedHours);

  // ---------- HOLIDAY CALENDAR (READ ONLY) ----------
  const holidays = useMemo(() => {
    const base = (calendarDays || []).map((d) => ({
      date: d.date, // "DD-MM-YYYY"
      type: d.type,
      label: d.label || d.name || "Holiday",
      taken: "TAKEN", // weekends/mandatory are always effective
      dateKey: d.dateKey || null,
    }));

    const optional = (holidaySettings || []).map((s) => {
      const ddmmyyyy = toDdMmYyyy(s.dateKey);
      return {
        date: ddmmyyyy,
        type: "OPTIONAL_PUBLIC",
        label: "Optional Holiday",
        taken: s.status === "TAKEN" ? "TAKEN" : "NOT_TAKEN",
        dateKey: s.dateKey,
      };
    });

    return [...base, ...optional];
  }, [calendarDays, holidaySettings]);

  const calendarWeeks = buildMonthMatrix(month, year);

  const holidayByDate = holidays.reduce((acc, h) => {
    if (h.date) acc[h.date] = h;
    return acc;
  }, {});

  const publicHolidays = holidays.filter(
    (h) => h.type === "MANDATORY_PUBLIC" || h.type === "OPTIONAL_PUBLIC"
  );

  const mandatoryPublicCount = publicHolidays.filter(
    (h) => h.type === "MANDATORY_PUBLIC"
  ).length;

  const optionalPublic = publicHolidays.filter(
    (h) => h.type === "OPTIONAL_PUBLIC"
  );

  const optionalTakenCount = optionalPublic.reduce(
    (sum, h) => (h.taken === "TAKEN" ? sum + 1 : sum),
    0
  );

  const totalPublicForMonth = mandatoryPublicCount + optionalTakenCount;
  const optionalNotTakenCount = optionalPublic.length - optionalTakenCount;

  const { sundaysInMonth, secondSaturdaysInMonth } = useMemo(() => {
    const y = Number(year);
    const m = Number(month);
    const daysInMonth = new Date(y, m, 0).getDate();
    let sundays = 0;
    let secondSats = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      const weekday = date.getDay(); // 0 Sun..6 Sat
      if (weekday === 0) {
        sundays += 1;
      } else if (weekday === 6) {
        const weekIndex = Math.floor((d - 1) / 7);
        if (weekIndex === 1) secondSats += 1;
      }
    }
    return { sundaysInMonth: sundays, secondSaturdaysInMonth: secondSats };
  }, [month, year]);

  const monthHolidayBanner = (
    <div
      style={{
        marginBottom: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background:
          "linear-gradient(90deg, rgba(0,21,41,0.98), rgba(24,144,255,0.85))",
        border: "1px solid rgba(255,255,255,0.15)",
        color: "#fff",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          opacity: 0.9,
          marginBottom: 4,
        }}
      >
        System Holidays Overview • {monthLabel}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>
          Sundays: <strong>{sundaysInMonth}</strong>
        </span>
        <span>
          2nd Saturdays: <strong>{secondSaturdaysInMonth}</strong>
        </span>
        <span>
          Mandatory Public: <strong>{mandatoryPublicCount}</strong>
        </span>
        <span>
          Optional Taken: <strong>{optionalTakenCount}</strong>
        </span>
        <span>
          Optional Not Taken: <strong>{Math.max(0, optionalNotTakenCount)}</strong>
        </span>
        <span>
          Total Effective Public Holidays: <strong>{totalPublicForMonth}</strong>
        </span>
      </div>
      <div style={{ marginTop: 4, opacity: 0.9, fontSize: 11 }}>
        Sundays, 2nd Saturdays and configured public holidays are treated as
        system holidays across the organization. Admin has view-only access to
        this configuration.
      </div>
    </div>
  );

  // ---------- LEAVE / COMPOFF REQUESTS (VIEW ONLY) ----------
  const requestRows = attendance.filter(
    (a) => a.isLeaveRequest || REQUEST_STATUSES.includes(a.status)
  );

  // ---------- EXPORT PANEL (reusable) ----------
  const ExportPanel = ({ compact = false }) => {
    return (
      <div
        className="card"
        style={{
          padding: compact ? 8 : 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, whiteSpace: "nowrap" }}>
            Month:
            <select
              value={`${month}-${year}`}
              onChange={handleMonthChange}
              style={{ marginLeft: 8 }}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const m = String(i + 1).padStart(2, "0");
                const value = `${m}-${year}`;
                return (
                  <option key={value} value={value}>
                    {monthNames[i]} {year}
                  </option>
                );
              })}
            </select>
          </label>

          <button onClick={handleDownloadAttendanceCsv} className="outline-btn">
            Attendance CSV
          </button>

          <select
            value={selectedProjectForExport}
            onChange={(e) => setSelectedProjectForExport(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._1d}>
                {p.name} {p.code ? `(${p.code})` : ""}
              </option>
            ))}
          </select>

          <button onClick={handleDownloadTasksCsv} className="outline-btn">
            Tasks CSV
          </button>

          <button onClick={handleDownloadLeavesCsv} className="outline-btn">
            Leaves CSV
          </button>

          <button onClick={handleDownloadLeaveSummaryCsv} className="outline-btn">
            Leave Summary CSV
          </button>
        </div>
      </div>
    );
  };

  // ---------- RENDER ----------
  return (
    <div className="page">
      <div className="shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src={logo} alt="NowIT Services" />
            </div>
            <div className="sidebar-role">Admin</div>
          </div>
          <nav className="sidebar-nav">
            <button
              className={activeTab === "dashboard" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("dashboard")}
            >
              Dashboard
            </button>

            <button
              className={activeTab === "attendance" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("attendance")}
            >
              Timesheet Management
            </button>
          </nav>
        </aside>

        <div className="main-area">
          <header className="topbar">
            <div>
              <strong>{user.fullName}</strong> (Admin) — {user.email}
            </div>
            <div className="topbar-actions">
              {/* topbar still contains Logout for quick access */}
              <button onClick={handleLogout} className="outline-btn">
                Logout
              </button>
            </div>
          </header>

          {/* ========== TIMESHEET MANAGEMENT TAB ========== */}
          {activeTab === "attendance" && (
            <main className="layout">
              {/* LEFT: Leave summary + change password */}
              <section className="left-column">
                <div className="card">
                  <div className="card-header-row">
                    <h2>Monthly Leave Summary (View Only)</h2>
                    <select
                      value={`${month}-${year}`}
                      onChange={handleMonthChange}
                      className="month-selector"
                    >
                      {Array.from({ length: 12 }).map((_, i) => {
                        const m = String(i + 1).padStart(2, "0");
                        const value = `${m}-${year}`;
                        return (
                          <option key={value} value={value}>
                            {monthNames[i]}, {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <p style={{ fontSize: 12, marginBottom: 6 }}>
                    Calculated per employee from attendance for {monthLabel}.
                  </p>

                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Entitlement</th>
                          <th>Holidays</th>
                          <th>Carry Fwd</th>
                          <th>Leaves Taken</th>
                          <th>Balance</th>
                          <th>Half Days</th>
                          <th>Balance After Half</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaries.map((s) => (
                          <tr key={s.userId}>
                            <td>
                              {s.fullName}
                              <br />
                              <span style={{ fontSize: 11, opacity: 0.8 }}>
                                {s.email}
                              </span>
                            </td>
                            <td>{s.totalLeaveEntitlement}</td>
                            <td>{s.publicHolidays + s.weekendHolidays}</td>
                            <td>{s.carryForward2025}</td>
                            <td>{s.leavesTaken}</td>
                            <td>{s.balanceLeaves}</td>
                            <td>{s.totalHalfDays}</td>
                            <td>{s.balanceAfterHalfDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {summaries.length === 0 && (
                      <p className="empty">No data for {monthLabel}</p>
                    )}
                  </div>
                </div>

                <ChangePasswordCard />
              </section>

              {/* RIGHT: Attendance + Requests + Holiday calendar */}
              <section className="right-column">
                {/* EXPORT PANEL moved here (Logout removed from panel) */}
                <ExportPanel />

                {/* Attendance (view only) */}
                <div className="card">
                  <h2>All Attendance (View Only)</h2>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Employee</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>In</th>
                          <th>Out</th>
                          <th>Manager Decision</th>
                          <th>Note / Extra Work</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((a) => (
                          <tr key={a._id}>
                            <td>{a.date}</td>
                            <td>{a.user?.fullName}</td>
                            <td>{a.user?.email}</td>
                            <td>{a.status}</td>
                            <td>{a.workInTime}</td>
                            <td>{a.workOutTime}</td>
                            <td>{a.managerDecision?.status || "-"}</td>
                            <td>
                              {a.status === "COMPOFF" && a.extraWork ? (
                                <>
                                  Extra: {a.extraWork.hours} hrs on {a.extraWork.workedDate}{" "}
                                  {a.extraWork.workedTime} → Comp-off {a.extraWork.compOffDate}{" "}
                                  {a.extraWork.compOffTime}
                                </>
                              ) : (
                                a.note || "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {attendance.length === 0 && (
                      <p className="empty">No attendance records</p>
                    )}
                  </div>
                </div>

                {/* Leave & Comp-off Requests */}
                <div className="card">
                  <h2>All Leave & Comp-off Requests (View Only)</h2>
                  <p style={{ fontSize: 12, marginBottom: 6 }}>
                    Includes Casual / Emergency Leave, Comp-off and other
                    request-based statuses raised by employees. Admin can only
                    view the current Manager decision.
                  </p>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Employee</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Leave Request?</th>
                          <th>Manager Decision</th>
                          <th>Manager Comment</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requestRows.map((a) => (
                          <tr key={a._id}>
                            <td>{a.date}</td>
                            <td>{a.user?.fullName}</td>
                            <td>{a.user?.email}</td>
                            <td>{a.status}</td>
                            <td>{a.isLeaveRequest ? "Yes" : "No"}</td>
                            <td>{a.managerDecision?.status || "PENDING"}</td>
                            <td>{a.managerDecision?.comment || "-"}</td>
                            <td>
                              {a.status === "COMPOFF" && a.extraWork ? (
                                <>
                                  Extra: {a.extraWork.hours} hrs on {a.extraWork.workedDate}{" "}
                                  {a.extraWork.workedTime} → Comp-off {a.extraWork.compOffDate}{" "}
                                  {a.extraWork.compOffTime}
                                </>
                              ) : (
                                a.note || "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {requestRows.length === 0 && (
                      <p className="empty">No leave / comp-off requests for {monthLabel}.</p>
                    )}
                  </div>
                </div>

                {/* Holiday calendar */}
                <div className="card">
                  <h2>Holiday Calendar – {monthLabel}</h2>

                  {monthHolidayBanner}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Calendar grid */}
                    <div style={{ flex: "1 1 320px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 8,
                          fontSize: 12,
                        }}
                      >
                        <span>
                          <span
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              background: "#434343",
                              marginRight: 4,
                            }}
                          />
                          Sunday / 2nd Saturday
                        </span>
                        <span>
                          <span
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              background: "#ff7875",
                              marginRight: 4,
                            }}
                          />
                          Mandatory Holiday
                        </span>
                        <span>
                          <span
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              background: "#faad14",
                              marginRight: 4,
                            }}
                          />
                          Optional Holiday
                        </span>
                      </div>

                      <table className="holiday-calendar">
                        <thead>
                          <tr>
                            <th>Sun</th>
                            <th>Mon</th>
                            <th>Tue</th>
                            <th>Wed</th>
                            <th>Thu</th>
                            <th>Fri</th>
                            <th>Sat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calendarWeeks.map((week, wi) => (
                            <tr key={`w-${wi}`}>
                              {week.map((cell, di) => {
                                if (!cell) {
                                  return (
                                    <td
                                      key={`d-${wi}-${di}`}
                                      className="holiday-cell empty"
                                    />
                                  );
                                }

                                const { date } = cell;

                                const yyyy = date.getFullYear();
                                const mm = String(date.getMonth() + 1).padStart(2, "0");
                                const dd = String(date.getDate()).padStart(2, "0");

                                const dateStr = `${dd}-${mm}-${yyyy}`;
                                const h = holidayByDate[dateStr];

                                const weekday = date.getDay(); // 0 Sun .. 6 Sat
                                const weekIndex = Math.floor((date.getDate() - 1) / 7);
                                const isSunday = weekday === 0;
                                const isSecondSaturday = weekday === 6 && weekIndex === 1;

                                const isMandatory = h && h.type === "MANDATORY_PUBLIC";
                                const isOptional = h && h.type === "OPTIONAL_PUBLIC";

                                let bg = "transparent";
                                const border = "1px solid rgba(255,255,255,0.15)";
                                const color = "#fff";

                                if (isMandatory) {
                                  bg = "#ff7875";
                                } else if (isOptional) {
                                  bg = "#faad14";
                                } else if (isSunday || isSecondSaturday) {
                                  bg = "#434343";
                                }

                                const label =
                                  (h && h.label) ||
                                  (isSunday ? "Sunday" : isSecondSaturday ? "2nd Saturday" : "");

                                return (
                                  <td
                                    key={`d-${wi}-${di}`}
                                    className="holiday-cell"
                                    style={{
                                      background: bg,
                                      border,
                                      color,
                                      verticalAlign: "top",
                                      padding: 4,
                                      minWidth: 40,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginBottom: 2,
                                      }}
                                    >
                                      {cell.day}
                                    </div>
                                    {label && (
                                      <div
                                        style={{
                                          fontSize: 10,
                                          lineHeight: 1.2,
                                          whiteSpace: "normal",
                                        }}
                                      >
                                        {label}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Public holiday list */}
                    <div style={{ flex: "1 1 260px" }}>
                      <h3 style={{ fontSize: 14, marginBottom: 6 }}>
                        Public Holidays – {monthLabel}
                      </h3>
                      <div
                        className="table-wrapper small-table"
                        style={{ maxHeight: 260, overflowY: "auto" }}
                      >
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Occasion</th>
                              <th>Type</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {publicHolidays.map((h, index) => {
                              const isMandatory = h.type === "MANDATORY_PUBLIC";
                              const isOptional = h.type === "OPTIONAL_PUBLIC";

                              const typeLabel = isMandatory ? "Mandatory" : isOptional ? "Optional" : "-";

                              const taken = h.taken === "TAKEN" ? "TAKEN" : "NOT_TAKEN";

                              let statusLabel = "-";
                              if (isMandatory) {
                                statusLabel = "Mandatory";
                              } else if (isOptional) {
                                statusLabel = taken === "TAKEN" ? "Taken (Optional)" : "Not Taken";
                              }

                              return (
                                <tr key={h.dateKey || h.date || index}>
                                  <td>{h.date}</td>
                                  <td>{h.label}</td>
                                  <td>{typeLabel}</td>
                                  <td>{statusLabel}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {publicHolidays.length === 0 && (
                          <p className="empty">No configured public holidays for this month.</p>
                        )}
                      </div>

                      <p className="note" style={{ marginTop: 8 }}>
                        Holiday configuration and optional “Taken / Not Taken”
                        flags are maintained by Manager. Admin has read-only access here.
                      </p>
                      <p className="note">
                        Total public holidays for {monthLabel}:{" "}
                        <strong>{totalPublicForMonth}</strong> (Mandatory:{" "}
                        {mandatoryPublicCount}, Optional Taken:{" "}
                        {optionalTakenCount})
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* ========== DASHBOARD TAB (Reports & Tasks view) ========== */}
          {activeTab === "dashboard" && (
            <main className="layout single-column">
              <section className="full-width">
                {/* EXPORT PANEL placed at top of Dashboard as separate card (Logout removed) */}
                <ExportPanel compact />

                {/* Org dashboard (view-only) */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>Organization Dashboard (View Only) – {monthLabel}</h2>
                    <select
                      value={`${month}-${year}`}
                      onChange={handleMonthChange}
                      className="month-selector"
                    >
                      {Array.from({ length: 12 }).map((_, i) => {
                        const m = String(i + 1).padStart(2, "0");
                        const value = `${m}-${year}`;
                        return (
                          <option key={value} value={value}>
                            {monthNames[i]}, {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: 12,
                      fontSize: 13,
                    }}
                  >
                    <div className="mini-kpi">
                      <strong>Total Employees</strong>
                      <div>{totalEmployees}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Active Employees</strong>
                      <div>{activeEmployees}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Projects</strong>
                      <div>{projects.length}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Total Hours (Month)</strong>
                      <div>{totalHoursMonth}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Leaves Taken</strong>
                      <div>{totalLeavesTaken}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Half Days (Month)</strong>
                      <div>{totalHalfDays}</div>
                    </div>
                  </div>
                </div>

                {/* Employee effort */}
                <div className="card">
                  <h2>Employee Effort</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Email</th>
                          <th>Worked Hours</th>
                          <th>Leaves Taken</th>
                          <th>Half Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeHoursRows.map((e) => (
                          <tr key={e.id}>
                            <td>{e.fullName}</td>
                            <td>{e.email}</td>
                            <td>{e.workedHours}</td>
                            <td>{e.leavesTaken}</td>
                            <td>{e.totalHalfDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {employeeHoursRows.length === 0 && (
                      <p className="empty">No employees</p>
                    )}
                  </div>
                </div>

                {/* Project summary */}
                <div className="card">
                  <h2>Project Summary</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Code</th>
                          <th>Employees</th>
                          <th>Estimate (hrs)</th>
                          <th>Worked (hrs)</th>
                          <th>Balance (hrs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => {
                          const totals = projectTotals[p._id] || {
                            used: 0,
                            remaining: p.totalEstimatedHours || 355,
                          };
                          return (
                            <tr key={p._id}>
                              <td>{p.name}</td>
                              <td>{p.code || "-"}</td>
                              <td>{p.assignments?.length || 0}</td>
                              <td>{p.totalEstimatedHours || 355}</td>
                              <td>{totals.used}</td>
                              <td>{totals.remaining}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {projects.length === 0 && (
                      <p className="empty">No projects yet</p>
                    )}
                  </div>
                  <p className="note">
                    Admin reports are read-only snapshots of what Manager
                    maintains. Admin cannot modify any information.
                  </p>
                </div>

                {/* All project tasks (view-only) */}
                <div className="card">
                  <h2>All Project Tasks (View Only)</h2>
                  <p style={{ fontSize: 12, marginBottom: 6 }}>
                    Tasks created by Manager or Employees. Admin can review but
                    cannot edit.
                  </p>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Project</th>
                          <th>Requirement</th>
                          <th>Type</th>
                          <th>Assigned To</th>
                          <th>Status</th>
                          <th>Scope</th>
                          <th>Notes</th>
                          <th>Discussed</th>
                          <th>Start</th>
                          <th>Close</th>
                          <th>Working Days</th>
                          <th>Client Priority</th>
                          <th>Given By</th>
                          <th>Created By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTasks.map((t, index) => {
                          const project = t.project || t.projectId || {};
                          const assigned = t.assignedUser || t.assignedUserId || {};

                          const projectName = project.name || project.projectName || "-";
                          const assignedName = assigned.fullName || assigned.email || "-";

                          return (
                            <tr key={t._id || index}>
                              <td>{index + 1}</td>
                              <td>{projectName}</td>
                              <td style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                                {t.recentRequirement}
                              </td>
                              <td>{t.requirementType || "NEW"}</td>
                              <td>{assignedName}</td>
                              <td>{t.status}</td>
                              <td>{t.scope || "-"}</td>
                              <td style={{ maxWidth: 220, whiteSpace: "pre-wrap" }}>
                                {t.notes || "-"}
                              </td>
                              <td>{t.discussedDate || "-"}</td>
                              <td>{t.originalClosureDate || "-"}</td>
                              <td>{t.estimatedDate || "-"}</td>
                              <td>{t.noOfDays || 0}</td>
                              <td>{t.clientPriority || "-"}</td>
                              <td>{t.prioritySource || "-"}</td>
                              <td>{t.createdBy || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {allTasks.length === 0 && (
                      <>
                        <p className="empty">
                          No tasks found. Manager and Employees create tasks
                          from their dashboards; Admin can only view them here.
                        </p>
                        <p className="note">
                          This section shows combined tasks from Manager
                          (allocated tasks) and Employees (self-created tasks).
                          All are read-only for Admin.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </section>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
