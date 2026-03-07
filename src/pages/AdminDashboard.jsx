// src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import logo from "../assets/Company Logo.png";
import { calculateProjectHours } from "../utils/hours";
import socket from "../utils/socket"; // ✅ Added socket import

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "auto";
  }, [sidebarOpen]);

  const [activeTab, setActiveTab] = useState("dashboard");

  const [{ month, year }, setMonthYear] = useState(getCurrentMonth);
  const [attendance, setAttendance] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  // ===== ADMIN PAYSLIP SEARCH & FILTER STATE =====
  const [searchText, setSearchText] = useState("");

  // ===== LOAD ALL PAYSLIPS FOR ADMIN (NO EMPLOYEE FILTER) =====
  useEffect(() => {
    if (activeTab === "payslips") {
      api
        .get("/payslips")
        .then((res) => {
          setPayslips(res.data || []);
        })
        .catch((err) => {
          console.error("Failed to load payslips", err);
          setPayslips([]);
        });
    }
  }, [activeTab]);

  // ===== BUILD EMPLOYEE DROPDOWN FROM PAYSLIPS =====
  const employeeOptions = useMemo(() => {
    const map = new Map();
    payslips.forEach((p) => {
      if (p.employee?._id) {
        map.set(p.employee._id, p.employee);
      }
    });
    return Array.from(map.values());
  }, [payslips]);

  // ===== FILTER PAYSLIPS (SEARCH + EMPLOYEE) =====
  const filteredPayslips = useMemo(() => {
    return payslips.filter((p) => {
      const matchesEmployee =
        !selectedEmployeeId || p.employee?._id === selectedEmployeeId;

      const text = searchText.toLowerCase();
      const matchesSearch =
        !text ||
        p.employee?.fullName?.toLowerCase().includes(text) ||
        p.employee?.email?.toLowerCase().includes(text) ||
        p.employeeId?.toLowerCase().includes(text);

      return matchesEmployee && matchesSearch;
    });
  }, [payslips, selectedEmployeeId, searchText]);

  // All project tasks (view only)
  const [allTasks, setAllTasks] = useState([]);
  const [taskSearch, setTaskSearch] = useState("");

  // Load all tasks for admin with proper fields
  const loadAllAdminTasks = useCallback(async () => {
    try {
      const res = await api.get("/tasks/all-admin");
      const tasks = res.data || [];
      
      // Format tasks with all required fields
      const formattedTasks = tasks.map((task, index) => {
  const projectObj =
    typeof task.projectId === "object"
      ? task.projectId
      : task.project || {};

  return {
    sno: index + 1,
    _id: task._id,

    project: projectObj,
    projectName: projectObj?.name || task.projectName || "-",

    requirement: task.requirement || task.title || "",
    requirementType: task.requirementType || "NEW",

    assignedTo: task.assignedTo || task.assignedUserId || {},

    status: task.status || "OPEN",
    scope: task.scope || "AGREED",

    notes: task.notes || "",

    discussedDate: task.discussedDate || task.discussed || "",
    startDate: task.startDate || task.estimatedDate || "",
    closeDate: task.closeDate || task.originalClosureDate || "",
    workingDays: (() => {
  const start = task.startDate || task.estimatedDate;
  const end = task.closeDate || task.originalClosureDate;

  if (start && end) {
    const s = new Date(start);
    const e = new Date(end);

    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays > 0 ? diffDays : 1;
  }

  return task.workingDays ??
         task.noOfDays ??
         task.estimatedDays ??
         task.estHours ??
         1;
})(),

   

    clientPriority: task.clientPriority || "P3",
    givenBy: task.givenBy || task.prioritySource || "CLIENT",

    createdBy:
  typeof task.createdByUserId === "object"
    ? task.createdByUserId
    : task.createdBy || {},
    createdByRole: task.createdByRole || "employee",

    estimateHours: task.estimateHours || task.estHours || 0,

    month: task.month,
    year: task.year,
    createdAt: task.createdAt
  };
});
      
      setAllTasks(formattedTasks);
    } catch (err) {
      console.error("Failed to load admin tasks:", err);
      setAllTasks([]);
    }
  }, []);

  // Filter tasks based on search
  const filteredAdminTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (!taskSearch.trim()) return true;
      const q = taskSearch.toLowerCase();
      
      const projectName = t.project?.name || "";
      const requirement = t.requirement || "";
      const assignedName = t.assignedTo?.fullName || t.assignedTo?.email || "";
      const createdByName = t.createdBy?.fullName || t.createdBy?.email || "";
      
      return (
        projectName.toLowerCase().includes(q) ||
        requirement.toLowerCase().includes(q) ||
        assignedName.toLowerCase().includes(q) ||
        createdByName.toLowerCase().includes(q) ||
        (t.status || "").toLowerCase().includes(q) ||
        (t.scope || "").toLowerCase().includes(q) ||
        (t.clientPriority || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q)
      );
    });
  }, [allTasks, taskSearch]);

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
    } catch (err) {
      console.error("loadProjects error:", err);
      setProjects([]);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.get("/employees");
      console.log("EMPLOYEES API RESPONSE:", res.data);

      setEmployees(res.data?.employees || res.data?.data || res.data || []);
    } catch (err) {
      console.error("Failed to load employees", err);
      setEmployees([]);
    }
  }, []);

  const loadEmployeePayslips = useCallback(async () => {
    if (!selectedEmployeeId) {
      setPayslips([]);
      return;
    }

    try {
      const res = await api.get("/payslips", {
        params: { employeeId: selectedEmployeeId }
      });
      setPayslips(res.data || []);
    } catch (err) {
      console.error("Failed to load employee payslips", err);
      setPayslips([]);
    }
  }, [selectedEmployeeId]);

  // ✅ SOCKET INTEGRATION: Listen for real-time updates
  useEffect(() => {
  // Listen for dashboard updates from server
  socket.on("dashboard:update", () => {
    console.log("📡 Dashboard update received");

    loadAllAdminTasks();   // reload tasks only
  });

  // Cleanup listener on component unmount
  return () => {
    socket.off("dashboard:update");
  };
}, [loadAllAdminTasks]);

  // Load all data on component mount
  useEffect(() => {
    loadProjects();
    loadEmployees();
    loadAllAdminTasks();
  }, [loadProjects, loadEmployees, loadAllAdminTasks]);

  useEffect(() => {
    loadAttendance();
    loadSummaries();
    loadHolidays();
  }, [loadAttendance, loadSummaries, loadHolidays]);

  // 🔁 Reload payslips when switching to Payslips tab
  useEffect(() => {
    if (activeTab === "payslips" && selectedEmployeeId) {
      loadEmployeePayslips();
    }
  }, [activeTab, selectedEmployeeId, loadEmployeePayslips]);

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
  acc[p._id] = {
    used: p.consumedHours || 0,
    remaining: p.balanceHours ?? (p.totalEstimatedHours - (p.consumedHours || 0)),
  };
  return acc;
}, {});

  const totalEmployees = summaries.length;
  const activeEmployees = summaries.length; // summary doesn't include isActive flag

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
        padding: "16px",
        borderRadius: 12,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
        fontSize: 13,
        boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1,
          opacity: 0.95,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{
          background: "rgba(255,255,255,0.2)",
          padding: "4px 8px",
          borderRadius: 6
        }}>
          📅
        </span>
        System Holidays Overview • {monthLabel}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div className="holiday-stat">
          <div className="holiday-stat-label">Sundays</div>
          <div className="holiday-stat-value">{sundaysInMonth}</div>
        </div>
        <div className="holiday-stat">
          <div className="holiday-stat-label">2nd Saturdays</div>
          <div className="holiday-stat-value">{secondSaturdaysInMonth}</div>
        </div>
        <div className="holiday-stat">
          <div className="holiday-stat-label">Mandatory Public</div>
          <div className="holiday-stat-value">{mandatoryPublicCount}</div>
        </div>
        <div className="holiday-stat">
          <div className="holiday-stat-label">Optional Taken</div>
          <div className="holiday-stat-value" style={{ color: "#a9ffa9" }}>
            {optionalTakenCount}
          </div>
        </div>
        <div className="holiday-stat">
          <div className="holiday-stat-label">Optional Not Taken</div>
          <div className="holiday-stat-value" style={{ color: "#ffa9a9" }}>
            {Math.max(0, optionalNotTakenCount)}
          </div>
        </div>
        <div className="holiday-stat">
          <div className="holiday-stat-label">Total Effective Holidays</div>
          <div className="holiday-stat-value" style={{ color: "#ffd700", fontSize: 16 }}>
            {totalPublicForMonth}
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 12,
        opacity: 0.9,
        fontSize: 12,
        borderTop: "1px solid rgba(255,255,255,0.1)",
        paddingTop: 8
      }}>
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

  // ---------- BEAUTIFIED FILTERS COMPONENT ----------
  const ExportPanel = ({ compact = false }) => {
    return (
      <div
        className="card"
        style={{
          padding: compact ? 16 : 20,
          marginBottom: 16,
          background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
          border: "1px solid #d1d9e6",
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#2c3e50",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <span style={{
            background: "#4a6cf7",
            color: "white",
            width: 24,
            height: 24,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12
          }}>
            ⬇
          </span>
          Export Data
        </div>
        <div style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap"
        }}>
          <div className="filter-group">
            <label style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#5a6c7d",
              marginBottom: 4,
              display: "block"
            }}>
              Month
            </label>
            <select
              value={`${month}-${year}`}
              onChange={handleMonthChange}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "2px solid #e1e8f0",
                background: "white",
                fontSize: 13,
                minWidth: 160,
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }}
              onMouseOver={(e) => e.target.style.borderColor = "#4a6cf7"}
              onMouseOut={(e) => e.target.style.borderColor = "#e1e8f0"}
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
          </div>

          <div className="filter-group">
            <label style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#5a6c7d",
              marginBottom: 4,
              display: "block"
            }}>
              Project
            </label>
            <select
              value={selectedProjectForExport}
              onChange={(e) => setSelectedProjectForExport(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "2px solid #e1e8f0",
                background: "white",
                fontSize: 13,
                minWidth: 200,
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }}
              onMouseOver={(e) => e.target.style.borderColor = "#4a6cf7"}
              onMouseOut={(e) => e.target.style.borderColor = "#e1e8f0"}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.code ? `(${p.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 24 }}>
            <button
              onClick={handleDownloadAttendanceCsv}
              className="export-btn"
              style={{ background: "#4a6cf7" }}
            >
              <span style={{ marginRight: 6 }}>📊</span>
              Attendance CSV
            </button>

            <button
              onClick={handleDownloadTasksCsv}
              className="export-btn"
              style={{ background: "#10b981" }}
            >
              <span style={{ marginRight: 6 }}>✅</span>
              Tasks CSV
            </button>

            <button
              onClick={handleDownloadLeavesCsv}
              className="export-btn"
              style={{ background: "#f59e0b" }}
            >
              <span style={{ marginRight: 6 }}>🍃</span>
              Leaves CSV
            </button>

            <button
              onClick={handleDownloadLeaveSummaryCsv}
              className="export-btn"
              style={{ background: "#8b5cf6" }}
            >
              <span style={{ marginRight: 6 }}>📈</span>
              Leave Summary CSV
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---------- RENDER ----------
  return (
    <div className="page">
      <style>
        {`
          .holiday-stat {
            background: rgba(255,255,255,0.15);
            padding: 10px;
            border-radius: 8px;
            text-align: center;
            backdrop-filter: blur(10px);
          }
          
          .holiday-stat-label {
            font-size: 11px;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          
          .holiday-stat-value {
            font-size: 18px;
            font-weight: 700;
          }
          
          .export-btn {
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          .export-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
          }
          
          .export-btn:active {
            transform: translateY(0);
          }
          
          .filter-group {
            display: flex;
            flex-direction: column;
          }
          
          .holiday-calendar {
            width: 100%;
            border-collapse: separate;
            border-spacing: 4px;
          }
          
          .holiday-calendar th {
            background: #f8fafc;
            padding: 10px;
            text-align: center;
            font-weight: 600;
            color: #475569;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
          }
          
          .holiday-calendar td {
            padding: 12px 4px;
            text-align: center;
            border-radius: 8px;
            min-width: 42px;
            height: 42px;
            position: relative;
            transition: all 0.2s ease;
            font-weight: 500;
          }
          
          .holiday-calendar td:hover {
            transform: scale(1.05);
            z-index: 1;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          
          .working-day {
            background: white !important;
            color: #1e293b !important;
            border: 2px solid #e2e8f0 !important;
          }
          
          .holiday-cell {
            position: relative;
            overflow: hidden;
          }
          
          .holiday-cell::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
            pointer-events: none;
          }
        `}
      </style>

      <div className="shell">
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>

          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src={logo} alt="NowIT Services" />
            </div>
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

            <button
              className={activeTab === "payslips" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("payslips")}
            >
              Payslips
            </button>
          </nav>
        </aside>

        <div className="main-area" style={{ overflowX: "hidden" }}>
          <header className="topbar">
            {/* ☰ MOBILE HAMBURGER BUTTON */}
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>

            <div>
              <strong>{user.fullName}</strong> — {user.email}
            </div>

            <div className="topbar-actions">
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
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "2px solid #e1e8f0",
                        background: "white",
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                      }}
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

                  <div className="table-wrapper">
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
                          <th className="hide-mobile">Email</th>
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
                            <td className="hide-mobile">{a.user?.email}</td>

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

                {/* Holiday calendar - BEAUTIFIED */}
                <div className="card">
                  <h2>Holiday Calendar – {monthLabel}</h2>

                  {monthHolidayBanner}

                  <div
                    style={{
                      display: "flex",
                      gap: 20,
                      flexWrap: "wrap",
                      width: "100%",
                    }}
                  >
                    {/* Calendar grid */}
                    <div style={{ flex: "1 1 360px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 16,
                          fontSize: 12,
                          padding: 12,
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0"
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              background: "#4a6cf7",
                              border: "2px solid white",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                            }}
                          />
                          Sunday / 2nd Saturday
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              background: "#ef4444",
                              border: "2px solid white",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                            }}
                          />
                          Mandatory Holiday
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              background: "#f59e0b",
                              border: "2px solid white",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                            }}
                          />
                          Optional Holiday
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              background: "white",
                              border: "2px solid #e2e8f0",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                            }}
                          />
                          Working Day
                        </span>
                      </div>
                      <div className="holiday-calendar-wrapper"></div>
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
                                      style={{ background: "#f8fafc", border: "2px solid #f1f5f9" }}
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
                                const isWorkingDay = !isSunday && !isSecondSaturday && !isMandatory && !isOptional;

                                let bg = "white";
                                let color = "#1e293b";
                                let border = "2px solid #e2e8f0";

                                if (isMandatory) {
                                  bg = "#ef4444";
                                  color = "white";
                                  border = "2px solid #dc2626";
                                } else if (isOptional) {
                                  bg = "#f59e0b";
                                  color = "white";
                                  border = "2px solid #d97706";
                                } else if (isSunday || isSecondSaturday) {
                                  bg = "#4a6cf7";
                                  color = "white";
                                  border = "2px solid #3b5bdb";
                                }

                                const label =
                                  (h && h.label) ||
                                  (isSunday ? "Sunday" : isSecondSaturday ? "2nd Saturday" : "");

                                return (
                                  <td
                                    key={`d-${wi}-${di}`}
                                    className={`holiday-cell ${isWorkingDay ? 'working-day' : ''}`}
                                    style={{
                                      background: bg,
                                      border,
                                      color,
                                      verticalAlign: "top",
                                      padding: "8px 4px",
                                      minWidth: 44,
                                      height: 44,
                                      position: "relative",
                                      borderRadius: "10px",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease"
                                    }}
                                    onMouseEnter={(e) => {
                                      if (isWorkingDay) {
                                        e.currentTarget.style.background = "#f1f5f9";
                                        e.currentTarget.style.transform = "scale(1.05)";
                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                                        e.currentTarget.style.zIndex = "1";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (isWorkingDay) {
                                        e.currentTarget.style.background = "white";
                                        e.currentTarget.style.transform = "scale(1)";
                                        e.currentTarget.style.boxShadow = "none";
                                        e.currentTarget.style.zIndex = "0";
                                      }
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 14,
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
                                          opacity: 0.95,
                                          fontWeight: 500
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
                    <div style={{ flex: "1 1 280px" }}>
                      <div style={{
                        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                        padding: "16px",
                        borderRadius: "12px",
                        border: "1px solid #d1d9e6",
                        marginBottom: "12px"
                      }}>
                        <h3 style={{ fontSize: 15, marginBottom: 8, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            background: "#4a6cf7",
                            color: "white",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12
                          }}>
                            📅
                          </span>
                          Public Holidays – {monthLabel}
                        </h3>
                        <div
                          className="table-wrapper small-table"
                          style={{ maxHeight: 280, overflowY: "auto" }}
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
                                    <td>
                                      <span style={{
                                        display: "inline-block",
                                        width: 24,
                                        height: 24,
                                        borderRadius: "4px",
                                        background: isMandatory ? "#ef4444" : "#f59e0b",
                                        color: "white",
                                        textAlign: "center",
                                        lineHeight: "24px",
                                        marginRight: "8px",
                                        fontSize: "11px"
                                      }}>
                                        {h.date.split('-')[0]}
                                      </span>
                                    </td>
                                    <td>{h.label}</td>
                                    <td>
                                      <span style={{
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                        background: isMandatory ? "#fee2e2" : "#fef3c7",
                                        color: isMandatory ? "#991b1b" : "#92400e"
                                      }}>
                                        {typeLabel}
                                      </span>
                                    </td>
                                    <td>
                                      <span style={{
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                        background: taken === "TAKEN" ? "#d1fae5" : "#f1f5f9",
                                        color: taken === "TAKEN" ? "#065f46" : "#64748b"
                                      }}>
                                        {statusLabel}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {publicHolidays.length === 0 && (
                            <p className="empty">No configured public holidays for this month.</p>
                          )}
                        </div>

                        <div style={{
                          marginTop: 12,
                          padding: "12px",
                          background: "rgba(74, 108, 247, 0.1)",
                          borderRadius: "8px",
                          border: "1px solid rgba(74, 108, 247, 0.2)"
                        }}>
                          <p className="note" style={{ margin: 0, fontSize: 11, color: "#4a6cf7" }}>
                            Holiday configuration and optional "Taken / Not Taken"
                            flags are maintained by Manager. Admin has read-only access here.
                          </p>
                        </div>
                        <p className="note" style={{ marginTop: 8, fontSize: 12 }}>
                          Total public holidays for {monthLabel}:{" "}
                          <strong style={{ color: "#4a6cf7", fontSize: 14 }}>{totalPublicForMonth}</strong>
                          {" "}(Mandatory:{" "}
                          {mandatoryPublicCount}, Optional Taken:{" "}
                          {optionalTakenCount})
                        </p>
                      </div>
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
                {/* EXPORT PANEL placed at top of Dashboard as separate card */}
                <ExportPanel compact />

                {/* Org dashboard (view-only) */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>Organization Dashboard (View Only) – {monthLabel}</h2>
                    <select
                      value={`${month}-${year}`}
                      onChange={handleMonthChange}
                      className="month-selector"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "2px solid #e1e8f0",
                        background: "white",
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                      }}
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
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 16,
                      fontSize: 13,
                    }}
                  >
                    <div className="mini-kpi" style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)"
                    }}>
                      <strong style={{ fontSize: "12px", opacity: 0.9 }}>Total Employees</strong>
                      <div style={{ fontSize: "24px", fontWeight: "700" }}>{totalEmployees}</div>
                    </div>
                    <div className="mini-kpi" style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
                    }}>
                      <strong style={{ fontSize: "12px", opacity: 0.9 }}>Active Employees</strong>
                      <div style={{ fontSize: "24px", fontWeight: "700" }}>{activeEmployees}</div>
                    </div>
                    <div className="mini-kpi" style={{
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      color: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)"
                    }}>
                      <strong style={{ fontSize: "12px", opacity: 0.9 }}>Projects</strong>
                      <div style={{ fontSize: "24px", fontWeight: "700" }}>{projects.length}</div>
                    </div>
                    <div className="mini-kpi" style={{
                      background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                      color: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)"
                    }}>
                      <strong style={{ fontSize: "12px", opacity: 0.9 }}>Total Hours (Month)</strong>
                      <div style={{ fontSize: "24px", fontWeight: "700" }}>{totalHoursMonth}</div>
                    </div>
                    <div className="mini-kpi" style={{
                      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                      color: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
                    }}>
                      <strong style={{ fontSize: "12px", opacity: 0.9 }}>Leaves Taken</strong>
                      <div style={{ fontSize: "24px", fontWeight: "700" }}>{totalLeavesTaken}</div>
                    </div>
                    <div className="mini-kpi" style={{
                      background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                      color: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(6, 182, 212, 0.3)"
                    }}>
                      <strong style={{ fontSize: "12px", opacity: 0.9 }}>Half Days (Month)</strong>
                      <div style={{ fontSize: "24px", fontWeight: "700" }}>{totalHalfDays}</div>
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
                            <td>
                              <span style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                background: "#d1fae5",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: "#065f46"
                              }}>
                                {e.workedHours} hrs
                              </span>
                            </td>
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
                              <td>
                                <span style={{
                                  display: "inline-block",
                                  padding: "4px 8px",
                                  background: "#dbeafe",
                                  borderRadius: "12px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  color: "#1e40af"
                                }}>
                                  {totals.used} hrs
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  display: "inline-block",
                                  padding: "4px 8px",
                                  background: totals.remaining > 100 ? "#d1fae5" :
                                    totals.remaining > 50 ? "#fef3c7" : "#fee2e2",
                                  borderRadius: "12px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  color: totals.remaining > 100 ? "#065f46" :
                                    totals.remaining > 50 ? "#92400e" : "#991b1b"
                                }}>
                                  {totals.remaining} hrs
                                </span>
                              </td>
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
                  <h2>
  All Project Tasks (View Only) 
  <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>
    ({filteredAdminTasks.length} out of {allTasks.length})
  </span>
</h2>
                  <div
  style={{
    display: "flex",
    gap: 12,
    marginBottom: 12,
    padding: "10px 12px",
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e5e7eb"
  }}
>
  <input
    type="text"
    placeholder="Search by project, requirement, employee, status..."
    value={taskSearch}
    onChange={(e) => setTaskSearch(e.target.value)}
    style={{
      flex: 1,
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid #d1d5db",
      fontSize: 14
    }}
  />

  <button
    type="button"
    onClick={() => setTaskSearch("")}
    style={{
      padding: "8px 16px",
      borderRadius: 8,
      border: "none",
      background: "#e5e7eb",
      cursor: "pointer",
      fontWeight: 600
    }}
  >
    Reset
  </button>

  {/* ✅ TASK DOWNLOAD BUTTON */}
  <button
    onClick={handleDownloadTasksCsv}
    style={{
      padding: "8px 16px",
      borderRadius: 8,
      border: "none",
      background: "#10b981",
      color: "white",
      cursor: "pointer",
      fontWeight: 600
    }}
  >
    ⬇ Export
  </button>
</div>

                  <p style={{ fontSize: 12, marginBottom: 6 }}>
                    Tasks created by Manager or Employees. Admin can review but
                    cannot edit.
                  </p>
                  <div className="table-wrapper">
                    <table>
                  <thead>
<tr>
  <th>S.No</th>
  <th>Project</th>
  <th>Requirement</th>
  <th>Type</th>
  <th>Status</th>
  <th>Scope</th>
  <th>Notes</th>
  <th>Discussed</th>
  <th>Start Date</th>
  <th>Close Date</th>
  <th>Working Days</th>
  <th>Client Priority</th>
  <th>Given By</th>
</tr>
</thead>
                      <tbody>
                        {filteredAdminTasks.map((task) => (
                          <tr key={task._id}>
                            <td>{task.sno}</td>
                            <td>{task.projectName || "-"}</td>
                            <td style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                              {task.requirement}
                            </td>
                            <td>{task.requirementType}</td>
                            <td>
                              <span style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                background: task.status === "COMPLETED" ? "#d1fae5" :
                                  task.status === "IN_PROGRESS" ? "#dbeafe" : "#f1f5f9",
                                color: task.status === "COMPLETED" ? "#065f46" :
                                  task.status === "IN_PROGRESS" ? "#1e40af" : "#64748b"
                              }}>
                                {task.status}
                              </span>
                            </td>
                            <td>{task.scope}</td>
                            <td style={{ maxWidth: 220, whiteSpace: "pre-wrap" }}>
                              {task.notes || "-"}
                            </td>
                            <td>{task.discussedDate || "-"}</td>
                            <td>{task.startDate || "-"}</td>
                            <td>{task.closeDate || "-"}</td>
                            <td>{task.workingDays ?? "-"}</td>
                            <td>{task.clientPriority}</td>
                            <td>{task.givenBy}</td>
                            
                          </tr>
                        ))}
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

          {/* ========== PAYSLIPS TAB (ADMIN) ========== */}
          {activeTab === "payslips" && (
            <main className="layout single-column">
              <section className="full-width">
                <div className="card">
                  <h2>Employee Payslips</h2>

                  <div style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-end",
                    marginBottom: 20,
                    padding: 16,
                    background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                    borderRadius: 12,
                    border: "1px solid #d1d9e6"
                  }}>
                    <div className="filter-group" style={{ flex: 1 }}>
                      <label style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#5a6c7d",
                        marginBottom: 6,
                        display: "block"
                      }}>
                        Select Employee
                      </label>
                      <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "2px solid #e1e8f0",
                          background: "white",
                          fontSize: 13,
                          width: "100%",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                        }}
                      >
                        <option value="">-- Select Employee --</option>
                        {employees.length === 0 && (
                          <option disabled>Loading employees...</option>
                        )}
                        {employeeOptions.map((e) => (
                          <option key={e._id} value={e._id}>
                            {e.fullName} ({e.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="filter-group" style={{ flex: 1 }}>
                      <label style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#5a6c7d",
                        marginBottom: 6,
                        display: "block"
                      }}>
                        Search
                      </label>
                      <input
                        type="text"
                        placeholder="Search by name, email, employee ID"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "2px solid #e1e8f0",
                          background: "white",
                          fontSize: 13,
                          width: "100%",
                          transition: "all 0.2s",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                        }}
                      />
                    </div>
                  </div>

                  <div className="table-wrapper" style={{ marginTop: 16 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Employee ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Net Pay</th>
                          <th>Download</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayslips.map((p) => (
                          <tr key={p._id}>
                            <td>
                              <span style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                background: "#f1f5f9",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600"
                              }}>
                                {monthNames[p.month - 1]} {p.year}
                              </span>
                            </td>
                            <td>{p.employee?.employeeId || "-"}</td>
                            <td>{p.employee?.fullName || "-"}</td>
                            <td>{p.employee?.email || "-"}</td>
                            <td>
                              <span style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                background: p.status === "Generated" ? "#d1fae5" : "#f1f5f9",
                                color: p.status === "Generated" ? "#065f46" : "#64748b"
                              }}>
                                {p.status || "Generated"}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: "700",
                                color: "#10b981",
                                fontSize: "14px"
                              }}>
                                ₹{p.salary?.netPay || 0}
                              </span>
                            </td>
                            <td>
                              <button
                                className="export-btn"
                                onClick={() =>
                                  api.get(`/payslips/${p._id}/download`, { responseType: "blob" })
                                    .then(res => {
                                      const blob = new Blob([res.data], { type: "application/pdf" });
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `${p.employee?.fullName || "Employee"}_${monthNames[p.month - 1]}_${p.year}.pdf`;

                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                    })
                                }
                                style={{
                                  background: "#4a6cf7",
                                  padding: "8px 12px",
                                  fontSize: "12px"
                                }}
                              >
                                ⬇ Download
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedEmployeeId && payslips.length === 0 && (
                      <p className="empty">No payslips available for this employee.</p>
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