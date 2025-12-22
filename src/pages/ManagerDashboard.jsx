// src/pages/ManagerDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import ManagerPayslip from "./ManagerPayslip";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import ProjectEstimateCard from "../components/ProjectEstimateCard";
import { calculateProjectHours } from "../utils/hours";
import { buildHolidayCalendar } from "../utils/holidays";
import logo from "../assets/Company Logo.png";

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
  "December"
];

// Status includes ON_HOLD_FROM_COMPANY / ON_HOLD_FROM_CLIENT
const TASK_STATUS = [
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "ON_HOLD_FROM_COMPANY",
  "ON_HOLD_FROM_CLIENT",
  "COMPLETED",
  "CANCELLED"
];

// Priority P1–P4 label + colour (for tasks)
const priorityColors = {
  P1: { color: "#ff4d4f", label: "P1 - Critical" },
  P2: { color: "#fa8c16", label: "P2 - Highest" },
  P3: { color: "#1890ff", label: "P3 - Medium" },
  P4: { color: "#52c41a", label: "P4 - Low" }
};

const prioritySourceLabels = {
  CLIENT: "Client",
  SERVICE_PROVIDER: "Service Provider",
  THIRD_PARTY: "Third Party"
};

// Project role dropdown options
const PROJECT_ROLE_OPTIONS = [
  "Developer",
  "Designer",
  "Tester",
  "QA",
  "Business Analyst",
  "Project Manager",
  "Tech Lead",
  "DevOps",
  "Support"
];

const getCurrentMonth = () => {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear())
  };
};

const formatToday = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

/**
 * WORKING DAYS BETWEEN TWO dd-mm-yyyy DATES
 * Excludes:
 *  - Sundays
 *  - 2nd Saturdays
 *  - Mandatory public holidays
 *  - Optional public holidays that are marked as TAKEN (or defaultTaken)
 */
const diffDays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;

  const [sd, sm, sy] = startStr.split("-").map(Number);
  const [ed, em, ey] = endStr.split("-").map(Number);
  if ([sd, sm, sy, ed, em, ey].some((n) => Number.isNaN(n))) return 0;

  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  const calendarCache = {};

  const isSystemHolidayDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const monthKey = `${yyyy}-${mm}`;
    const dateKey = `${yyyy}-${mm}-${dd}`;

    if (!calendarCache[monthKey]) {
      const list = buildHolidayCalendar(mm, String(yyyy)) || [];
      const map = {};
      list.forEach((h) => {
        if (h.dateKey) map[h.dateKey] = h;
      });
      calendarCache[monthKey] = { list, map };
    }

    const { map } = calendarCache[monthKey];
    const h = map[dateKey];

    const weekday = date.getDay(); // 0 Sun..6 Sat
    const weekIndex = Math.floor((date.getDate() - 1) / 7);
    const isSunday = weekday === 0;
    const isSecondSaturday = weekday === 6 && weekIndex === 1;

    const isMandatory =
      h &&
      (h.type === "MANDATORY_PUBLIC" || h.isMandatory || h.kind === "MANDATORY");

    const isOptional =
      h &&
      (h.type === "OPTIONAL_PUBLIC" || h.isOptional || h.kind === "OPTIONAL");

    const taken =
      h &&
        (h.taken === "TAKEN" ||
          h.takenStatus === "TAKEN" ||
          h.defaultTaken)
        ? "TAKEN"
        : "NOT_TAKEN";

    const isOptionalEffectiveHoliday = isOptional && taken === "TAKEN";

    return (
      isSunday ||
      isSecondSaturday ||
      isMandatory ||
      isOptionalEffectiveHoliday
    );
  };

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    if (!isSystemHolidayDate(cursor)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
};

// convert between dd-mm-yyyy (stored) and yyyy-mm-dd (for <input type="date">)
const toInputDate = (ddmmyyyy) => {
  if (!ddmmyyyy) return "";
  const [dd, mm, yyyy] = ddmmyyyy.split("-");
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm}-${dd}`;
};

const fromInputDate = (yyyymmdd) => {
  if (!yyyymmdd) return "";
  const [yyyy, mm, dd] = yyyymmdd.split("-");
  if (!dd || !mm || !yyyy) return "";
  return `${dd}-${mm}-${yyyy}`;
};

// Build a month calendar matrix: [[{ day, dateKey, date }, ... 7], ...]
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

// -------- Today Holiday Info (Sunday / 2nd Saturday / Public Holiday) --------
const getTodayHolidayInfo = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mmNum = today.getMonth() + 1;
  const ddNum = today.getDate();
  const mm = String(mmNum).padStart(2, "0");
  const dd = String(ddNum).padStart(2, "0");
  const dateKey = `${yyyy}-${mm}-${dd}`;
  const dateLabel = `${dd}-${mm}-${yyyy}`;

  const dayOfWeek = today.getDay(); // 0 Sunday .. 6 Saturday
  const weekIndex = Math.floor((ddNum - 1) / 7);
  const isSunday = dayOfWeek === 0;
  const isSecondSaturday = dayOfWeek === 6 && weekIndex === 1;

  // Holidays for today's month/year
  const holidaysForMonth = buildHolidayCalendar(mm, String(yyyy)) || [];
  const h = holidaysForMonth.find((x) => x.dateKey === dateKey);

  let type = null;
  let title = "";
  let message = "";
  let tone = "info"; // used only for banner colour

  if (
    h &&
    (h.type === "MANDATORY_PUBLIC" ||
      h.isMandatory ||
      h.kind === "MANDATORY")
  ) {
    type = "MANDATORY_PUBLIC";
    title = `Public Holiday – ${h.name}`;
    message = `Today (${dateLabel}) is a mandatory public holiday (${h.name}). Attendance marking is disabled for all employees.`;
    tone = "danger";
  } else if (
    h &&
    (h.type === "OPTIONAL_PUBLIC" ||
      h.isOptional ||
      h.kind === "OPTIONAL")
  ) {
    type = "OPTIONAL_PUBLIC";
    title = `Optional Public Holiday – ${h.name}`;
    message = `Today (${dateLabel}) is an optional public holiday (${h.name}). Please follow the agreed plan. Attendance marking is generally not required unless agreed with the client.`;
    tone = "warning";
  } else if (isSunday) {
    type = "SUNDAY";
    title = "Sunday – Weekly Off";
    message = `Today (${dateLabel}) is Sunday. This is a weekly off. Attendance marking is disabled.`;
    tone = "info";
  } else if (isSecondSaturday) {
    type = "SECOND_SATURDAY";
    title = "Second Saturday – Weekly Off";
    message = `Today (${dateLabel}) is the second Saturday of the month. This is a weekly off. Attendance marking is disabled.`;
    tone = "info";
  } else {
    return null;
  }

  return { type, title, message, dateKey, tone, dateLabel };
};

export default function ManagerDashboard() {
  const { user, logout } = useAuth();

  // ------- ALERT CENTER (bell icon) -------
  const [alerts, setAlerts] = useState([]);

  const addAlert = (message) => {
    if (!message) return;
    setAlerts((prev) => [message, ...prev].slice(0, 30));
    try {
      window.alert(message);
    } catch (err) {

      console.error("Manager alert popup error:", err);
    }
  };

  // Tabs: dashboard | projects | timesheet | logs
  const [activeTab, setActiveTab] = useState("dashboard");






  const [employees, setEmployees] = useState([]);
  // ===== SELECTED EMPLOYEE (DERIVED) =====


  const [attendance, setAttendance] = useState([]);
  const [{ month, year }, setMonthYear] = useState(getCurrentMonth);
  const [summaries, setSummaries] = useState([]);

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  // ===== SELECTED EMPLOYEE (SAFE DERIVED VALUE) =====


  const [projectTasks, setProjectTasks] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({
    projectId: "",
    assignedUserId: "",
    recentRequirement: "",
    requirementType: "NEW", // NEW | OLD | BUG
    status: "OPEN",
    scope: "AGREED", // AGREED | NOT_AGREED
    notes: "",
    discussedDate: formatToday(),
    originalClosureDate: "",
    estimatedDate: "",
    noOfDays: 0,
    clientPriority: "P3",
    prioritySource: "CLIENT", // CLIENT | SERVICE_PROVIDER | THIRD_PARTY
    hoursAllocated: 0,
    createdBy: ""
  });

  // Create employee form (public/weekend holidays are auto, not editable)
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    laptopId: "",
    password: "Emp@123",
    totalLeaveEntitlement: 16,
    carryForward2025: 0
  });

  // Project create form – manager can edit total hours & duration in months
  const [projectForm, setProjectForm] = useState({
    name: "Timesheet + Project + Budget Management System",
    code: "MVP-1M",
    description:
      "MVP timesheet + project + budget management system (1 month, 355 hours).",
    totalEstimatedHours: 355,
    projectMonths: 1
  });

  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] = useState("Developer");

  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // Optional holiday "Taken / Not Taken" state, keyed by dateKey (YYYY-MM-DD)
  const [holidayTakenMap, setHolidayTakenMap] = useState({});

  // ---------- LOGS (Manager View) ----------
  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsView, setLogsView] = useState("ALL"); // ALL | LOGIN | OPERATION
  const [logUserFilter, setLogUserFilter] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");

  // NEW: pending attendance / leave / comp-off requests (from /attendance/requests)
  const [pendingRequests, setPendingRequests] = useState([]);

  // Today holiday information (for professional banner)
  const todayHolidayInfo = getTodayHolidayInfo();

  // -------- LOGOUT HANDLER (write logout log in backend) ----------
  const handleLogout = async () => {
    try {
      // backend /api/auth/logout should create LOGOUT log
      await api.post("/auth/logout");
    } catch (err) {

      console.error("Logout log error:", err?.response || err);
    } finally {
      logout();
    }
  };





  // -------- LOADERS ----------

  const loadEmployees = useCallback(async () => {
    const res = await api.get("/employees");
    setEmployees(res.data);
  }, []);

  const loadAttendance = useCallback(
    async () => {
      const res = await api.get("/attendance", { params: { month, year } });
      setAttendance(res.data);
    },
    [month, year]
  );

const loadSummaries = useCallback(
  async () => {
    try {
      console.log("Loading summaries for:", month, year);
      const res = await api.get("/leave/summary/all", {
        params: { month, year }
      });
      console.log("Summaries loaded:", res.data?.length || 0, "records");
      setSummaries(res.data || []);
    } catch (err) {
      console.error("Error loading summaries:", err.response?.data || err.message);
      setSummaries([]);
      addAlert(`Error loading leave summaries: ${err.response?.data?.message || err.message}`);
    }
  },
  [month, year]
);

  const loadProjects = useCallback(async () => {
    const res = await api.get("/projects");
    const list = res.data || [];
    setProjects(list);
    setSelectedProjectId((prev) => (prev ? prev : list[0]?._id || null));
  }, []);

  const loadProjectTasks = useCallback(
    async (pid) => {
      const projectIdToLoad = pid || selectedProjectId;
      if (!projectIdToLoad) {
        setProjectTasks([]);
        return;
      }
      try {
        const res = await api.get(`/tasks/project/${projectIdToLoad}`);
        setProjectTasks(res.data || []);
      } catch (err) {

        console.error("Error loading project tasks", err);
        setProjectTasks([]);
      }
    },
    [selectedProjectId]
  );

  // NEW: load pending attendance / leave requests from backend
  const loadPendingRequests = useCallback(async () => {
    try {
      const res = await api.get("/attendance/requests");
      setPendingRequests(res.data || []);
    } catch (err) {

      console.error("Error loading attendance requests", err?.response || err);
      setPendingRequests([]);
    }
  }, []);

  // Load all audit logs for selected month/year
  const loadLogs = useCallback(
    async () => {
      try {
        setLogsLoading(true);
        setLogsError("");
        const res = await api.get("/logs", {
          params: { month, year }
        });
        setLogs(res.data || []);
      } catch (err) {

        console.error("Error loading logs", err?.response || err);
        setLogs([]);
        setLogsError(
          err?.response?.data?.message ||
          "Error loading logs for this month (configure /logs API in backend)"
        );
      } finally {
        setLogsLoading(false);
      }
    },
    [month, year]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      loadEmployees();
      loadProjects();
    }, 0);
    return () => clearTimeout(id);
  }, [loadEmployees, loadProjects]);

useEffect(() => {
  const id = setTimeout(() => {
    loadAttendance();
    loadSummaries();
    loadPendingRequests();
  }, 0);
  return () => clearTimeout(id);
}, [loadAttendance, loadSummaries, loadPendingRequests]);

// ADD THIS NEW useEffect HERE:
useEffect(() => {
  // Whenever employees or attendance changes, reload summaries
  if (employees.length > 0 || attendance.length > 0) {
    loadSummaries();
  }
}, [employees, attendance, loadSummaries]);

// Add this to refresh summaries when month/year changes
useEffect(() => {
  loadSummaries();
}, [month, year, loadSummaries]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadProjectTasks(selectedProjectId);
    }, 0);
    return () => clearTimeout(id);
  }, [selectedProjectId, loadProjectTasks]);

  // Rebuild default Taken/NotTaken map whenever month/year changes
  useEffect(() => {
    const monthHolidays = buildHolidayCalendar(month, year);
    const fresh = {};
    monthHolidays.forEach((h) => {
      const isOptional =
        h.type === "OPTIONAL_PUBLIC" ||
        h.isOptional ||
        h.kind === "OPTIONAL";
      if (isOptional) {
        const key = h.dateKey;
        fresh[key] =
          h.taken === "TAKEN" || h.defaultTaken ? "TAKEN" : "NOT_TAKEN";
      }
    });

    const id = setTimeout(() => {
      setHolidayTakenMap(fresh);
    }, 0);

    return () => clearTimeout(id);
  }, [month, year]);

  // Load logs only when Logs tab is active (and month/year changes)
  useEffect(() => {
    if (activeTab !== "logs") return undefined;
    const id = setTimeout(() => {
      loadLogs();
    }, 0);
    return () => clearTimeout(id);
  }, [activeTab, loadLogs]);

  // -------- EMPLOYEE CRUD / LEAVES ----------

  // In ManagerDashboard.jsx, update the handleCreateEmployee function:

// In handleCreateEmployee function in ManagerDashboard.jsx
const handleCreateEmployee = async (e) => {
  e.preventDefault();
  try {
    // Auto-calc monthly weekend + public holidays
    const monthHolidays = buildHolidayCalendar(month, year) || [];
    const weekendHolidayCount = monthHolidays.filter(
      (h) => h.type === "WEEKEND"
    ).length;

    const publicHolidaysMonth = monthHolidays.filter(
      (h) =>
        h.type === "MANDATORY_PUBLIC" ||
        h.type === "OPTIONAL_PUBLIC" ||
        h.isMandatory ||
        h.isOptional ||
        h.kind === "MANDATORY" ||
        h.kind === "OPTIONAL"
    ).length;

    // Prepare data without employeeId - backend will generate it
    const employeeData = {
      fullName: form.fullName,
      email: form.email,
      laptopId: form.laptopId,
      password: form.password,
      totalLeaveEntitlement: form.totalLeaveEntitlement,
      carryForward2025: form.carryForward2025,
      publicHolidays: publicHolidaysMonth,
      weekendHolidays: weekendHolidayCount
    };

    const response = await api.post("/employees", employeeData);
    
    // Get the generated employee ID from response
    const generatedEmployeeId = response.data.employeeId;

    addAlert(
      `✅ Employee created successfully!
      
      Employee Details:
      • Name: ${form.fullName}
      • Email: ${form.email}
      • Employee ID: ${generatedEmployeeId}
      • Default Password: ${form.password}
      
      Please share the Employee ID and password with the employee.
      Public & weekend holidays are auto-configured.`
    );

    // Reset form
    setForm({
      fullName: "",
      email: "",
      laptopId: "",
      password: "Emp@123",
      totalLeaveEntitlement: 16,
      carryForward2025: 0
    });

    // Reload data
    await loadEmployees();
    await loadSummaries();
    
  } catch (err) {
    console.error("Create employee error:", err);
    addAlert(err.response?.data?.message || "Error creating employee");
  }
};
  const deactivate = async (id) => {
    if (!window.confirm("Deactivate this employee?")) return;
    await api.patch(`/employees/${id}/deactivate`);
    loadEmployees();
    loadSummaries();
  };

  // Manager can now only edit entitlement & carry forward – public/weekend
  // holidays are system-calculated and not editable.
 // Update the editLeaveConfig function in ManagerDashboard.jsx:

const editLeaveConfig = async (emp) => {
  const totalLeaveEntitlement = Number(
    prompt("Total Leave Entitlement", emp.totalLeaveEntitlement ?? 16)
  );
  if (Number.isNaN(totalLeaveEntitlement)) return;

  const carryForward2025 = Number(
    prompt("2025 Carry Forward Leaves", emp.carryForward2025 ?? 0)
  );
  if (Number.isNaN(carryForward2025)) return;

  try {
    await api.patch(`/employees/${emp._id}/leave-config`, {
      totalLeaveEntitlement,
      carryForward2025
    });
    
    addAlert(
      `Leave configuration updated for ${emp.fullName} (${emp.employeeId}).`
    );
    
    // Force reload all data
    await loadEmployees();
    
    // Clear and reload summaries
    setSummaries([]);
    await loadSummaries();
    
    // Clear and reload attendance
    setAttendance([]);
    await loadAttendance();
    
    // Force UI update
    setSummaries(prev => [...prev.map(s => ({...s}))]);
    
  } catch (err) {
    console.error("Edit leave config error:", err);
    addAlert(err.response?.data?.message || "Error updating leave config");
  }
};
  // UPDATED: Manager approves / rejects an AttendanceRequest
  const decideLeave = async (id, decision) => {
    try {
      await api.patch(`/attendance/requests/${id}/decision`, { decision });
      loadAttendance();
      loadSummaries();
      loadPendingRequests();
      addAlert(
        decision === "APPROVED"
          ? "Leave / attendance request approved."
          : "Leave / attendance request rejected."
      );
    } catch (err) {

      console.error("Error deciding leave request", err?.response || err);
      addAlert(
        err?.response?.data?.message ||
        "Error applying decision on leave / attendance request"
      );
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm("Delete this attendance record?")) return;
    await api.delete(`/attendance/${id}`);
    loadAttendance();
    loadSummaries();
  };

  const handleResetEmployeePassword = async (e) => {
    e.preventDefault();
    try {
      await api.patch("/auth/reset-by-admin", {
        email: resetEmail.trim(),
        role: "employee",
        newPassword: resetNewPassword
      });
      addAlert(
        `Password reset for ${resetEmail}. Share new password with the employee.`
      );
      setResetEmail("");
      setResetNewPassword("");
    } catch (err) {

      console.error("Manager reset password error:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error resetting password";
      addAlert(msg);
    }
  };

  // -------- MONTH FILTER ----------

  const handleMonthChange = (e) => {
    const [m, y] = e.target.value.split("-");
    setMonthYear({ month: m, year: y });
  };

  const monthLabel = `${monthNames[Number(month) - 1]}, ${year}`;

  // Holidays for the currently selected month
  const holidays = buildHolidayCalendar(month, year) || [];
  const calendarWeeks = buildMonthMatrix(month, year);

  const holidayByDateKey = holidays.reduce((acc, h) => {
    if (h.dateKey) acc[h.dateKey] = h;
    return acc;
  }, {});

  const publicHolidays = holidays.filter(
    (h) =>
      h.type === "MANDATORY_PUBLIC" ||
      h.type === "OPTIONAL_PUBLIC" ||
      h.isMandatory ||
      h.isOptional ||
      h.kind === "MANDATORY" ||
      h.kind === "OPTIONAL"
  );

  const mandatoryPublicCount = publicHolidays.filter(
    (h) =>
      h.type === "MANDATORY_PUBLIC" ||
      h.isMandatory ||
      h.kind === "MANDATORY"
  ).length;

  const optionalPublic = publicHolidays.filter(
    (h) =>
      h.type === "OPTIONAL_PUBLIC" ||
      h.isOptional ||
      h.kind === "OPTIONAL"
  );

  const optionalTakenCount = optionalPublic.reduce((sum, h) => {
    const taken = holidayTakenMap[h.dateKey] || "NOT_TAKEN";
    return sum + (taken === "TAKEN" ? 1 : 0);
  }, 0);

  const totalPublicForMonth = mandatoryPublicCount + optionalTakenCount;
  const weekendHolidayCountForMonth = holidays.filter(
    (h) => h.type === "WEEKEND"
  ).length;

  const handleHolidayTakenChange = async (dateKey, value) => {
    setHolidayTakenMap((prev) => ({ ...prev, [dateKey]: value }));
    try {
      await api.post("/holidays/taken", {
        dateKey,
        value,
        year,
        month
      });
    } catch (err) {

      console.error("Failed to save holiday taken/not-taken", err);
    }
  };

  // -------- PROJECT LOGIC ----------

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: projectForm.name,
        code: projectForm.code,
        description: projectForm.description,
        totalEstimatedHours: Number(projectForm.totalEstimatedHours) || 0,
        projectMonths: Number(projectForm.projectMonths) || 0 // backend can ignore if not in schema
      };

      const res = await api.post("/projects", payload);
      addAlert("Project created");
      setSelectedProjectId(res.data._id);
      setTaskForm((prev) => ({
        ...prev,
        projectId: res.data._id
      }));
      loadProjects();
    } catch (err) {
      addAlert(err.response?.data?.message || "Error creating project");
    }
  };

  const handleAssignProject = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !assignUserId) {
      addAlert("Select project and employee");
      return;
    }
    try {
      await api.post(`/projects/${selectedProjectId}/assign`, {
        userId: assignUserId,
        role: assignRole
      });
      addAlert("Employee assigned to project");
      setAssignUserId("");
      setAssignRole("Developer");
      loadProjects();
    } catch (err) {
      addAlert(err.response?.data?.message || "Error assigning employee");
    }
  };

  const handleUnassign = async (projectId, userId) => {
    if (!window.confirm("Remove this employee from project?")) return;
    await api.delete(`/projects/${projectId}/assign/${userId}`);
    loadProjects();
    loadProjectTasks(projectId);
  };

  // -------- PROJECT TASKS (DISCUSSION REQUIREMENTS) ----------

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      addAlert("Select a project first");
      return;
    }

    const calculatedDays = diffDays(
      taskForm.originalClosureDate,
      taskForm.estimatedDate
    );

    const finalDays = taskForm.noOfDays || calculatedDays || 0;
    const hoursAllocated =
      taskForm.hoursAllocated || (finalDays > 0 ? finalDays * 8 : 0); // simple rule

    try {
      const payload = {
        ...taskForm,
        projectId: selectedProjectId,
        noOfDays: finalDays,
        hoursAllocated
      };

      // "Assign To = None" allowed – just don't send assignedUserId
      if (!payload.assignedUserId) {
        delete payload.assignedUserId;
      }

      // Allow empty requirement – put a default text
      if (!payload.recentRequirement || !payload.recentRequirement.trim()) {
        payload.recentRequirement = "Requirement not specified";
      }

      // createdBy always comes from login user (or existing when editing)
      payload.createdBy = taskForm.createdBy || user.fullName;

      if (!editingTaskId) {
        await api.post("/tasks", payload);
        addAlert("Task created / noted");
      } else {
        await api.patch(`/tasks/${editingTaskId}`, payload);
        addAlert("Task updated");
      }

      setEditingTaskId(null);
      setTaskForm((prev) => ({
        ...prev,
        projectId: selectedProjectId,
        assignedUserId: "",
        recentRequirement: "",
        requirementType: "NEW",
        status: "OPEN",
        scope: "AGREED",
        notes: "",
        discussedDate: formatToday(),
        originalClosureDate: "",
        estimatedDate: "",
        noOfDays: 0,
        clientPriority: "P3",
        prioritySource: "CLIENT",
        hoursAllocated: 0,
        createdBy: ""
      }));
      loadProjectTasks(selectedProjectId);
    } catch (err) {

      console.error("Error saving task", err);
      addAlert(err.response?.data?.message || "Error saving task");
    }
  };

  const startEditTask = (t) => {
    setEditingTaskId(t._id);
    setTaskForm({
      projectId: selectedProjectId,
      assignedUserId:
        t.assignedUserId || (t.assignedUser && t.assignedUser._id) || "",
      recentRequirement: t.recentRequirement || "",
      requirementType: t.requirementType || "NEW",
      status: t.status || "OPEN",
      scope: t.scope || "AGREED",
      notes: t.notes || "",
      discussedDate: t.discussedDate || formatToday(),
      originalClosureDate: t.originalClosureDate || "",
      estimatedDate: t.estimatedDate || "",
      noOfDays: t.noOfDays || 0,
      clientPriority: t.clientPriority || "P3",
      prioritySource: t.prioritySource || "CLIENT",
      hoursAllocated: t.hoursAllocated || 0,
      createdBy: t.createdBy || user.fullName
    });
  };

  const updateTaskField = async (id, updates) => {
    try {
      const payload = { ...updates };
      await api.patch(`/tasks/${id}`, payload);
      loadProjectTasks();
    } catch (err) {

      console.error("Error updating task", err);
      addAlert(err.response?.data?.message || "Error updating task");
    }
  };

  const updateTaskStatus = async (id, status) => {
    await updateTaskField(id, { status });
  };

  // Map attendance -> hours per employee for current month
  const hoursByEmployee = (() => {
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
  })();

  // projectTotals: sum of all assigned employees hours per project
  const projectTotals = projects.reduce((acc, p) => {
    let used = 0;
    (p.assignments || []).forEach((a) => {
      const id = (a.user && a.user._id) || a.user;
      if (!id) return;
      used += hoursByEmployee[id] || 0;
    });
    acc[p._id] = {
      used,
      remaining: Math.max(0, (p.totalEstimatedHours || 355) - used)
    };
    return acc;
  }, {});

  const selectedProject =
    projects.find((p) => p._id === selectedProjectId) || null;

  const selectedEmployeeHours =
    (selectedEmployeeId && hoursByEmployee[selectedEmployeeId]) || 0;

  // -------- REPORT METRICS (Manager) ----------

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.isActive).length;
  const totalProjects = projects.length;
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
  const pendingCount = pendingRequests.length;

  const employeeHoursRows = employees
    .map((e) => ({
      ...e,
      workedHours: hoursByEmployee[e._id] || 0
    }))
    .sort((a, b) => b.workedHours - a.workedHours);

  // -------- LOG METRICS + FILTERING ----------

  const loginLogs = logs.filter(
    (l) => l.type === "LOGIN" || l.type === "LOGOUT"
  );
  const operationLogs = logs.filter((l) => l.type === "OPERATION");
  const errorLogs = logs.filter(
    (l) => l.type === "ERROR" || l.status === "ERROR" || l.status === "FAILED"
  );

  const failedLoginCount = logs.filter(
    (l) =>
      l.type === "LOGIN" && (l.status === "FAILED" || l.status === "ERROR")
  ).length;

  const filteredLogs = logs
    .filter((l) => {
      if (logsView === "LOGIN") {
        return l.type === "LOGIN" || l.type === "LOGOUT";
      }
      if (logsView === "OPERATION") {
        return l.type === "OPERATION" || l.type === "ERROR";
      }
      return true; // ALL
    })
    .filter((l) => {
      if (logUserFilter === "ALL") return true;
      const uid =
        l.userId ||
        (l.user && (l.user._id || l.user.id)) ||
        l.userEmail ||
        l.userName;
      return uid === logUserFilter;
    })
    .filter((l) => {
      if (!logSearch.trim()) return true;
      const q = logSearch.trim().toLowerCase();
      const parts = [
        l.action,
        l.entity,
        l.description,
        l.details,
        l.ipAddress,
        l.status,
        l.type,
        l.role,
        l.userName,
        l.userEmail
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return parts.includes(q);
    });

  // unique user list for Employee filter (from logs, includes admin/manager too)
  const logUserOptions = Array.from(
    new Map(
      logs.map((l) => {
        const id =
          l.userId ||
          (l.user && (l.user._id || l.user.id)) ||
          l.userEmail ||
          l.userName;
        if (!id) return [null, null];
        const name = l.userName || (l.user && l.user.fullName) || l.userEmail;
        const email = l.userEmail || (l.user && l.user.email) || "";
        const label = email ? `${name} (${email})` : name;
        return [id, { id, label }];
      })
    ).values()
  ).filter(Boolean);

  return (
    <div className="page">
      <div className="shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src={logo} alt="NowIT Services" />
            </div>
            <div className="sidebar-role">Manager</div>
          </div>
          <nav className="sidebar-nav">
            {/* 1. Dashboard (old Reports tab) */}
            <button
              className={
                activeTab === "dashboard" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveTab("dashboard")}
            >
              Dashboard
            </button>

            {/* 2. Project Management (old Projects tab) */}
            <button
              className={
                activeTab === "projects" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveTab("projects")}
            >
              Project Management
            </button>

            {/* 3. Timesheet Management (old Employees & Attendance tab) */}
            <button
              className={
                activeTab === "timesheet" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveTab("timesheet")}
            >
              Timesheet Management
            </button>
            <button
              className={
                activeTab === "payslips" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveTab("payslips")}
            >
              Payslip Management
            </button>


            {/* 4. Logs & Audit */}
            <button
              className={activeTab === "logs" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("logs")}
            >
              Logs &amp; Audit
            </button>
          </nav>
        </aside>

        <div className="main-area">
          <header className="topbar">
            <div>
              <strong>{user.fullName}</strong> (Manager) — {user.email}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="outline-btn"
                style={{ position: "relative", paddingInline: 10 }}
                onClick={() => {
                  if (!alerts.length) {
                    try {
                      window.alert("No alerts yet");
                    } catch (err) {

                      console.error(
                        "Manager alert history popup error:",
                        err
                      );
                    }
                    return;
                  }
                  try {
                    window.alert(alerts.join("\n\n"));
                  } catch (err) {

                    console.error("Manager alert history popup error:", err);
                  }
                }}
              >
                <span role="img" aria-label="alerts">
                  🔔
                </span>
                {alerts.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 999,
                      background: "#ff4d4f",
                      color: "#fff",
                      fontSize: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {alerts.length}
                  </span>
                )}
              </button>

              <button onClick={handleLogout} className="outline-btn">
                Logout
              </button>
            </div>
          </header>

          {/* Global today-holiday banner for Manager */}
          {todayHolidayInfo && (
            <div
              className="today-holiday-banner"
              style={{
                margin: "10px 0 6px 0",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.18)",
                background:
                  todayHolidayInfo.tone === "danger"
                    ? "rgba(255,77,79,0.18)"
                    : todayHolidayInfo.tone === "warning"
                      ? "rgba(250,173,20,0.18)"
                      : "rgba(64,169,255,0.18)",
                color: "#fff",
                fontSize: 13
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {todayHolidayInfo.title}
              </div>
              <div>{todayHolidayInfo.message}</div>
            </div>
          )}

          {/* ========== TIMESHEET MANAGEMENT TAB (Employees & Attendance) ========== */}
          {activeTab === "timesheet" && (
            <main className="layout">
              {/* LEFT COLUMN – Employees & password */}
              <section className="left-column">
                <div className="card">
                  <h2>Create Employee Login</h2>
                  <form className="form-grid" onSubmit={handleCreateEmployee}>
                    <label>
                      Full Name
                      <input
                        value={form.fullName}
                        onChange={(e) =>
                          setForm({ ...form, fullName: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Laptop ID
                      <input
                        value={form.laptopId}
                        onChange={(e) =>
                          setForm({ ...form, laptopId: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Default Password
                      <input
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Total Leaves
                      <input
                        type="number"
                        value={form.totalLeaveEntitlement}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            totalLeaveEntitlement: Number(e.target.value)
                          })
                        }
                      />
                    </label>
                    {/* Auto-calculated, not editable */}
                    <label>
                      Public Holidays (auto for {monthLabel})
                      <input
                        type="number"
                        value={totalPublicForMonth}
                        readOnly
                        disabled
                      />
                    </label>
                    <label>
                      Weekend Holidays (auto for {monthLabel})
                      <input
                        type="number"
                        value={weekendHolidayCountForMonth}
                        readOnly
                        disabled
                      />
                    </label>
                    <label>
                      2025 Carry Forward
                      <input
                        type="number"
                        value={form.carryForward2025}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            carryForward2025: Number(e.target.value)
                          })
                        }
                      />
                    </label>
                    <div className="full-row">
                      <button type="submit" className="primary-btn">
                        Create Employee
                      </button>
                    </div>
                  </form>
                  <p className="note" style={{ marginTop: 6 }}>
                    Public holidays and weekend holidays are calculated from the
                    holiday calendar and cannot be changed by Manager.
                  </p>
                </div>

                {/* In the Employees table */}
<div className="card">
  <h2>Employees</h2>
  <div className="table-wrapper small-table">
    <table>
      <thead>
        <tr>
          <th>Employee ID</th> {/* Add this column */}
          <th>Name</th>
          <th>Email</th>
          <th>Laptop</th>
          <th>Status</th>
          <th>Leaves (T / PH / W / CF)</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((e) => (
          <tr key={e._id}>
            <td>
              <strong>{e.employeeId || "N/A"}</strong>
            </td>
            <td>{e.fullName}</td>
            <td>{e.email}</td>
            <td>{e.laptopId || "-"}</td>
            <td>
              <span className={`status-badge ${e.isActive ? 'active' : 'inactive'}`}>
                {e.isActive ? "Active" : "Inactive"}
              </span>
            </td>
            <td>
              {e.totalLeaveEntitlement ?? 0}/
              {e.publicHolidays ?? 0}/{e.weekendHolidays ?? 0}/
              {e.carryForward2025 ?? 0}
            </td>
            <td>
              <button
                className="link-btn"
                onClick={() => editLeaveConfig(e)}
              >
                Edit Leave
              </button>
              {e.isActive && (
                <>
                  {" "}
                  |{" "}
                  <button
                    className="link-btn danger"
                    onClick={() => deactivate(e._id)}
                  >
                    Deactivate
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {employees.length === 0 && (
      <p className="empty">No employees yet</p>
    )}
  </div>
</div>

                <div className="card">
                  <h2>Reset Employee Password</h2>
                  <form
                    className="form-grid"
                    onSubmit={handleResetEmployeePassword}
                  >
                    <label>
                      Employee Email
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                    </label>
                    <label>
                      New Password
                      <input
                        type="text"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                      />
                    </label>
                    <div className="full-row">
                      <button className="primary-btn" type="submit">
                        Reset Password
                      </button>
                    </div>
                  </form>
                  <p className="note">
                    Share the new password with the employee. They can change it
                    after login from their dashboard.
                  </p>
                </div>

                <ChangePasswordCard />
              </section>

              {/* RIGHT COLUMN – Leave summary + attendance */}
              <section className="right-column">
                <div className="card">
                  <div className="card-header-row">
                    <h2>Monthly Leave Summary</h2>
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
                    Auto-calculated from attendance for each employee in{" "}
                    {monthLabel}.
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
                            <td>{s.fullName}</td>
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

                <div className="card">
                  <h2>Pending Leave / Comp-off Requests</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Date</th>
                          <th>Requested Status</th>
                          <th>Note / Extra Work</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRequests.map((p) => (
                          <tr key={p._id}>
                            <td>{p.user?.fullName}</td>
                            <td>{p.date}</td>
                            <td>
                              {p.type === "UPDATE" && p.fromStatus
                                ? `${p.fromStatus} → ${p.toStatus}`
                                : p.toStatus}
                            </td>
                            <td>
                              {p.toStatus === "COMPOFF" && p.extraWork ? (
                                <>
                                  Extra: {p.extraWork.hours} hrs on{" "}
                                  {p.extraWork.workedDate}{" "}
                                  {p.extraWork.workedTime} → Comp-off{" "}
                                  {p.extraWork.compOffDate}{" "}
                                  {p.extraWork.compOffTime}
                                </>
                              ) : (
                                p.note || "-"
                              )}
                            </td>
                            <td>
                              <button
                                className="link-btn"
                                onClick={() => decideLeave(p._id, "APPROVED")}
                              >
                                Approve
                              </button>{" "}
                              <button
                                className="link-btn danger"
                                onClick={() => decideLeave(p._id, "REJECTED")}
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pendingRequests.length === 0 && (
                      <p className="empty">No pending requests</p>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h2>All Attendance (This Month)</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Employee</th>
                          <th>Status</th>
                          <th>In</th>
                          <th>Out</th>
                          <th>Decision</th>
                          <th>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((a) => (
                          <tr key={a._id}>
                            <td>{a.date}</td>
                            <td>{a.user?.fullName}</td>
                            <td>{a.status}</td>
                            <td>{a.workInTime}</td>
                            <td>{a.workOutTime}</td>
                            <td>{a.managerDecision?.status}</td>
                            <td>
                              <button
                                className="link-btn danger"
                                onClick={() => deleteRecord(a._id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {attendance.length === 0 && (
                      <p className="empty">No attendance yet</p>
                    )}
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* ========== PAYSLIP MANAGEMENT TAB ========== */}
          {activeTab === "payslips" && (
            <main className="layout single-column">
              <ManagerPayslip />
            </main>
          )}

           {/* <main className="layout single-column">
              <ManagerPayslip />
            </main> */}


          {activeTab === "projects" && (
            <main className="layout single-column">
              <section className="full-width">
                {/* Setup */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>Projects – Setup</h2>
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

                  <form className="form-grid" onSubmit={handleCreateProject}>
                    <label>
                      Project Name
                      <input
                        value={projectForm.name}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            name: e.target.value
                          })
                        }
                      />
                    </label>
                    <label>
                      Project Code
                      <input
                        value={projectForm.code}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            code: e.target.value
                          })
                        }
                      />
                    </label>
                    <label>
                      Total Estimated Hours
                      <input
                        type="number"
                        value={projectForm.totalEstimatedHours}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            totalEstimatedHours: Number(e.target.value)
                          })
                        }
                      />
                    </label>
                    <label>
                      Duration (Months)
                      <input
                        type="number"
                        value={projectForm.projectMonths}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            projectMonths: Number(e.target.value)
                          })
                        }
                      />
                    </label>
                    <label className="full-row">
                      Description
                      <input
                        value={projectForm.description}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            description: e.target.value
                          })
                        }
                      />
                    </label>
                    <div className="full-row">
                      <button type="submit" className="primary-btn">
                        Create Project
                      </button>
                    </div>
                  </form>

                  <hr
                    style={{
                      margin: "12px 0",
                      borderColor: "rgba(255,255,255,0.25)"
                    }}
                  />

                  <form className="form-grid" onSubmit={handleAssignProject}>
                    <label>
                      Select Project
                      <select
                        value={selectedProjectId || ""}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setSelectedProjectId(newId);
                          setSelectedEmployeeId(null);
                          setTaskForm((prev) => ({
                            ...prev,
                            projectId: newId
                          }));
                        }}
                      >
                        <option value="">-- Select --</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Employee
                      <select
                        value={assignUserId}
                        onChange={(e) => setAssignUserId(e.target.value)}
                      >
                        <option value="">-- Select employee --</option>
                        {employees.map((e) => (
                          <option key={e._id} value={e._id}>
                            {e.fullName} ({e.email})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Role in Project
                      <select
                        value={assignRole}
                        onChange={(e) => setAssignRole(e.target.value)}
                      >
                        {PROJECT_ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="full-row">
                      <button type="submit" className="primary-btn">
                        Assign to Project
                      </button>
                    </div>
                  </form>
                </div>

                {/* Holiday calendar for the selected month */}
                <div className="card">
                  <h2>Holiday Calendar – {monthLabel}</h2>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ flex: "1 1 320px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 8,
                          fontSize: 12
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
                              marginRight: 4
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
                              marginRight: 4
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
                              marginRight: 4
                            }}
                          />
                          Optional – Not Taken
                        </span>
                        <span>
                          <span
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              background: "#40a9ff",
                              marginRight: 4
                            }}
                          />
                          Optional – Taken
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

                                const { dateKey, date } = cell;
                                const h = holidayByDateKey[dateKey];

                                const weekday = date.getDay(); // 0 Sun .. 6 Sat
                                const weekIndex = Math.floor(
                                  (date.getDate() - 1) / 7
                                );
                                const isSunday = weekday === 0;
                                const isSecondSaturday =
                                  weekday === 6 && weekIndex === 1;

                                const isMandatory =
                                  h &&
                                  (h.type === "MANDATORY_PUBLIC" ||
                                    h.isMandatory ||
                                    h.kind === "MANDATORY");
                                const isOptional =
                                  h &&
                                  (h.type === "OPTIONAL_PUBLIC" ||
                                    h.isOptional ||
                                    h.kind === "OPTIONAL");

                                const takenStatus =
                                  holidayTakenMap[dateKey] || "NOT_TAKEN";

                                let bg = "transparent";
                                let border =
                                  "1px solid rgba(255,255,255,0.15)";
                                let color = "#fff";

                                if (isMandatory) {
                                  bg = "#ff7875";
                                } else if (isOptional) {
                                  bg =
                                    takenStatus === "TAKEN"
                                      ? "#40a9ff"
                                      : "#faad14";
                                } else if (isSunday || isSecondSaturday) {
                                  bg = "#434343";
                                }

                                const label =
                                  (h && h.name) ||
                                  (isSunday
                                    ? "Sunday"
                                    : isSecondSaturday
                                      ? "2nd Saturday"
                                      : "");

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
                                      minWidth: 40
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginBottom: 2
                                      }}
                                    >
                                      {cell.day}
                                    </div>
                                    {label && (
                                      <div
                                        style={{
                                          fontSize: 10,
                                          lineHeight: 1.2,
                                          whiteSpace: "normal"
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

                    {/* Optional / Mandatory holiday list with Taken dropdown */}
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
                              <th> Taken? </th>
                            </tr>
                          </thead>
                          <tbody>
                            {publicHolidays.map((h) => {
                              const isMandatory =
                                h.type === "MANDATORY_PUBLIC" ||
                                h.isMandatory ||
                                h.kind === "MANDATORY";
                              const isOptional =
                                h.type === "OPTIONAL_PUBLIC" ||
                                h.isOptional ||
                                h.kind === "OPTIONAL";

                              const taken =
                                holidayTakenMap[h.dateKey] || "NOT_TAKEN";

                              return (
                                <tr key={h.dateKey}>
                                  <td>{h.dateLabel || h.dateKey}</td>
                                  <td>{h.name}</td>
                                  <td>
                                    {isMandatory
                                      ? "Mandatory"
                                      : isOptional
                                        ? "Optional"
                                        : "-"}
                                  </td>
                                  <td>
                                    {isMandatory ? (
                                      "Mandatory"
                                    ) : (
                                      <select
                                        value={taken}
                                        onChange={(e) =>
                                          handleHolidayTakenChange(
                                            h.dateKey,
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="TAKEN">Taken</option>
                                        <option value="NOT_TAKEN">
                                          Not Taken
                                        </option>
                                      </select>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {publicHolidays.length === 0 && (
                          <p className="empty">
                            No configured public holidays for this month.
                          </p>
                        )}
                      </div>

                      <p className="note" style={{ marginTop: 8 }}>
                        These settings are controlled by Manager. Optional
                        holidays marked as <strong>Taken</strong> will also be
                        visible in Employee and Admin views.
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

                {/* Projects overview */}
                <div className="card">
                  <h2>Projects Overview – {monthLabel}</h2>
                  <p style={{ fontSize: 12, marginBottom: 6 }}>
                    Click a project row to see detailed allocation and balance
                    below. Public Holidays column is auto-calculated from the
                    holiday calendar above.
                  </p>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Code</th>
                          <th>Employees</th>
                          <th>Project Total (hrs)</th>
                          <th>Worked (hrs)</th>
                          <th>Balance (hrs)</th>
                          <th>Public Holidays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => {
                          const totals = projectTotals[p._id] || {
                            used: 0,
                            remaining: p.totalEstimatedHours || 355
                          };
                          const count = p.assignments?.length || 0;
                          const isSelected = selectedProjectId === p._id;
                          return (
                            <tr
                              key={p._id}
                              style={{
                                cursor: "pointer",
                                fontWeight: isSelected ? "600" : "400"
                              }}
                              onClick={() => {
                                setSelectedProjectId(p._id);
                                setSelectedEmployeeId(null);
                                setTaskForm((prev) => ({
                                  ...prev,
                                  projectId: p._id
                                }));
                              }}
                            >
                              <td>{p.name}</td>
                              <td>{p.code || "-"}</td>
                              <td>{count}</td>
                              <td>{p.totalEstimatedHours || 355}</td>
                              <td>{totals.used}</td>
                              <td>{totals.remaining}</td>
                              <td>{totalPublicForMonth}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {projects.length === 0 && (
                      <p className="empty">No projects created yet.</p>
                    )}
                  </div>
                </div>

                {/* Detailed project view */}
                {selectedProject && (
                  <>
                    <div className="card">
                      <h2>Project Details</h2>
                      <p style={{ fontSize: 13, marginBottom: 8 }}>
                        <strong>{selectedProject.name}</strong>{" "}
                        {selectedProject.code
                          ? `(${selectedProject.code})`
                          : ""}{" "}
                        — {selectedProject.description || "No description"}.
                      </p>
                      <p style={{ fontSize: 12, marginBottom: 8 }}>
                        Estimate:{" "}
                        <strong>
                          {selectedProject.totalEstimatedHours || 355} hrs
                        </strong>{" "}
                        • Worked:{" "}
                        <strong>
                          {projectTotals[selectedProject._id]?.used || 0} hrs
                        </strong>{" "}
                        • Balance:{" "}
                        <strong>
                          {projectTotals[selectedProject._id]?.remaining ||
                            (selectedProject.totalEstimatedHours || 355)}{" "}
                          hrs
                        </strong>
                      </p>

                      <h3 style={{ fontSize: 14, marginBottom: 6 }}>
                        Allocated Employees (this month)
                      </h3>
                      <div className="table-wrapper small-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Email</th>
                              <th>Role</th>
                              <th>Worked Hours</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedProject.assignments || []).map((a) => {
                              const id = (a.user && a.user._id) || a.user;
                              const emp = employees.find((e) => e._id === id);
                              const name =
                                a.user?.fullName || emp?.fullName || "-";
                              const email = a.user?.email || emp?.email || "-";
                              const hours = hoursByEmployee[id] || 0;
                              const isSelectedEmp =
                                selectedEmployeeId === id &&
                                projectTotals[selectedProject._id];

                              return (
                                <tr
                                  key={`${selectedProject._id}-${id}`}
                                  style={{
                                    cursor: "pointer",
                                    fontWeight: isSelectedEmp ? "600" : "400"
                                  }}
                                  onClick={() => {
                                    setSelectedEmployeeId(id);
                                  }}
                                >
                                  <td>{name}</td>
                                  <td>{email}</td>
                                  <td>{a.role || "Member"}</td>
                                  <td>{hours}</td>
                                  <td>
                                    <button
                                      className="link-btn danger"
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnassign(selectedProject._id, id);
                                      }}
                                    >
                                      Unassign
                                    </button>{" "}
                                    |{" "}
                                    <button
                                      className="link-btn"
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEmployeeId(id);
                                      }}
                                    >
                                      View Estimate
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {(selectedProject.assignments || []).length === 0 && (
                          <p className="empty">
                            No employees assigned to this project.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Project Discussion Tasks */}
                    <div className="card">
                      <h2>Project Discussion Tasks / Requirements</h2>
                      <form className="form-grid" onSubmit={handleSubmitTask}>
                        <label className="full-row">
                          Requirement
                          <textarea
                            rows={4}
                            value={taskForm.recentRequirement}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                recentRequirement: e.target.value
                              })
                            }
                            placeholder="Enter requirement details (supports long text)..."
                          />
                        </label>
                        <label>
                          Requirement Type
                          <select
                            value={taskForm.requirementType}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                requirementType: e.target.value
                              })
                            }
                          >
                            <option value="NEW">New</option>
                            <option value="OLD">Old</option>
                            <option value="BUG">Bug</option>
                          </select>
                        </label>
                        <label>
                          Assign To
                          <select
                            value={taskForm.assignedUserId}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                assignedUserId: e.target.value
                              })
                            }
                          >
                            <option value="">-- None --</option>
                            {employees.map((emp) => (
                              <option key={emp._id} value={emp._id}>
                                {emp.fullName} ({emp.email})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Status
                          <select
                            value={taskForm.status}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                status: e.target.value
                              })
                            }
                          >
                            {TASK_STATUS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Scope
                          <select
                            value={taskForm.scope}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                scope: e.target.value
                              })
                            }
                          >
                            <option value="AGREED">Agreed</option>
                            <option value="NOT_AGREED">Not Agreed</option>
                          </select>
                        </label>
                        <label>
                          Discussed Date
                          <input
                            type="date"
                            value={toInputDate(taskForm.discussedDate)}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                discussedDate: fromInputDate(e.target.value)
                              })
                            }
                          />
                        </label>
                        <label>
                          Start Date
                          <input
                            type="date"
                            value={toInputDate(taskForm.originalClosureDate)}
                            onChange={(e) => {
                              const value = fromInputDate(e.target.value);
                              setTaskForm((prev) => ({
                                ...prev,
                                originalClosureDate: value,
                                noOfDays: diffDays(value, prev.estimatedDate)
                              }));
                            }}
                          />
                        </label>
                        <label>
                          Close Date
                          <input
                            type="date"
                            value={toInputDate(taskForm.estimatedDate)}
                            onChange={(e) => {
                              const value = fromInputDate(e.target.value);
                              setTaskForm((prev) => ({
                                ...prev,
                                estimatedDate: value,
                                noOfDays: diffDays(
                                  prev.originalClosureDate,
                                  value
                                )
                              }));
                            }}
                          />
                        </label>
                        <label>
                          Working Days
                          <input
                            type="number"
                            value={taskForm.noOfDays}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                noOfDays: Number(e.target.value)
                              })
                            }
                          />
                        </label>
                        <label>
                          Client Priority
                          <select
                            value={taskForm.clientPriority}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                clientPriority: e.target.value
                              })
                            }
                          >
                            <option value="P1">P1 - Critical</option>
                            <option value="P2">P2 - Highest</option>
                            <option value="P3">P3 - Medium</option>
                            <option value="P4">P4 - Low</option>
                          </select>
                        </label>
                        <label>
                          Given By
                          <select
                            value={taskForm.prioritySource}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                prioritySource: e.target.value
                              })
                            }
                          >
                            <option value="CLIENT">Client</option>
                            <option value="SERVICE_PROVIDER">
                              Service Provider
                            </option>
                            <option value="THIRD_PARTY">Third Party</option>
                          </select>
                        </label>
                        <label>
                          Created By
                          <input
                            type="text"
                            value={taskForm.createdBy || user.fullName}
                            readOnly
                          />
                        </label>
                        {/* Notes at bottom, multi-line */}
                        <label className="full-row">
                          Notes
                          <textarea
                            rows={4}
                            value={taskForm.notes}
                            onChange={(e) =>
                              setTaskForm({
                                ...taskForm,
                                notes: e.target.value
                              })
                            }
                            placeholder="Any discussion notes or clarifications (supports long text)..."
                          />
                        </label>
                        <div className="full-row">
                          <button type="submit" className="primary-btn">
                            {editingTaskId
                              ? "Update Task"
                              : "Add / Allocate Task"}
                          </button>
                        </div>
                      </form>

                      <div
                        className="table-wrapper small-table"
                        style={{ marginTop: 10 }}
                      >
                        <table>
                          <thead>
                            <tr>
                              <th>S.No</th>
                              <th>Requirement</th>
                              <th>Type</th>
                              <th>Employee</th>
                              <th>Status</th>
                              <th>Scope</th>
                              <th>Notes</th>
                              <th>Discussed Date</th>
                              <th>Start Date</th>
                              <th>Close Date</th>
                              <th>Working Days</th>
                              <th>Client Priority</th>
                              <th>Given By</th>
                              <th>Created By</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectTasks.map((t, index) => {
                              const emp =
                                t.assignedUser?.fullName ||
                                employees.find(
                                  (e) => e._id === t.assignedUserId
                                )?.fullName ||
                                "-";

                              const meta =
                                priorityColors[t.clientPriority] || null;
                              const color = meta?.color || "#1890ff";
                              const label =
                                meta?.label || t.clientPriority || "-";

                              return (
                                <tr key={t._id}>
                                  <td>{index + 1}</td>
                                  <td
                                    style={{
                                      maxWidth: 260,
                                      whiteSpace: "pre-wrap"
                                    }}
                                  >
                                    {t.recentRequirement}
                                  </td>
                                  <td>{t.requirementType || "NEW"}</td>
                                  <td>{emp}</td>
                                  <td>
                                    <select
                                      value={t.status}
                                      onChange={(e) =>
                                        updateTaskStatus(
                                          t._id,
                                          e.target.value
                                        )
                                      }
                                    >
                                      {TASK_STATUS.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <select
                                      value={t.scope || "AGREED"}
                                      onChange={(e) =>
                                        updateTaskField(t._id, {
                                          scope: e.target.value
                                        })
                                      }
                                    >
                                      <option value="AGREED">Agreed</option>
                                      <option value="NOT_AGREED">
                                        Not Agreed
                                      </option>
                                    </select>
                                  </td>
                                  <td
                                    style={{
                                      maxWidth: 220,
                                      whiteSpace: "pre-wrap"
                                    }}
                                  >
                                    {t.notes}
                                  </td>
                                  <td>{t.discussedDate}</td>
                                  <td>{t.originalClosureDate}</td>
                                  <td>{t.estimatedDate}</td>
                                  <td>{t.noOfDays}</td>
                                  <td>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        backgroundColor: color,
                                        color: "#fff"
                                      }}
                                    >
                                      {label}
                                    </span>
                                  </td>
                                  <td>
                                    {prioritySourceLabels[t.prioritySource] ||
                                      t.prioritySource ||
                                      "-"}
                                  </td>
                                  <td>{t.createdBy || "-"}</td>
                                  <td>
                                    <button
                                      className="link-btn"
                                      type="button"
                                      onClick={() => startEditTask(t)}
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {projectTasks.length === 0 && (
                          <p className="empty">
                            No discussion tasks added for this project.
                          </p>
                        )}
                      </div>

                      {selectedEmployeeId && (
                        <ProjectEstimateCard usedHours={selectedEmployeeHours} />
                      )}
                    </div>
                  </>
                )}
              </section>
            </main>
          )}

          {/* ========== LOGS & AUDIT TAB ========== */}
          {activeTab === "logs" && (
            <main className="layout single-column">
              <section className="full-width">
                <div className="card">
                  <div className="card-header-row">
                    <h2>Logs &amp; Audit – {monthLabel}</h2>
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
                  <p className="note" style={{ marginBottom: 8 }}>
                    View all system activity for this month – login attempts,
                    logout events and key operations performed by Manager /
                    Employees / Admin. This is a read-only view for audit and
                    compliance. Only Manager can access this screen.
                  </p>

                  {/* KPI Row for logs */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 12,
                      fontSize: 13,
                      marginBottom: 12
                    }}
                  >
                    <div className="mini-kpi">
                      <strong>Total Events</strong>
                      <div>{logs.length}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Login / Logout</strong>
                      <div>{loginLogs.length}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Operations</strong>
                      <div>{operationLogs.length}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Failed Logins / Errors</strong>
                      <div>{failedLoginCount + errorLogs.length}</div>
                    </div>
                  </div>

                  {/* Sub-tabs + Filters */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 10
                    }}
                  >
                    <div className="pill-group">
                      <button
                        type="button"
                        className={
                          logsView === "ALL" ? "pill-btn active" : "pill-btn"
                        }
                        onClick={() => setLogsView("ALL")}
                      >
                        All Logs
                      </button>
                      <button
                        type="button"
                        className={
                          logsView === "LOGIN" ? "pill-btn active" : "pill-btn"
                        }
                        onClick={() => setLogsView("LOGIN")}
                      >
                        Login Logs
                      </button>
                      <button
                        type="button"
                        className={
                          logsView === "OPERATION"
                            ? "pill-btn active"
                            : "pill-btn"
                        }
                        onClick={() => setLogsView("OPERATION")}
                      >
                        Operation Logs
                      </button>
                    </div>

                    <div style={{ flex: 1 }} />

                    <label style={{ fontSize: 12 }}>
                      Employee
                      <select
                        value={logUserFilter}
                        onChange={(e) => setLogUserFilter(e.target.value)}
                        style={{ marginLeft: 4 }}
                      >
                        <option value="ALL">All</option>
                        {logUserOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <input
                      type="text"
                      placeholder="Search by action, module, IP, status..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      style={{
                        minWidth: 220,
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid rgba(255,255,255,0.25)",
                        background: "transparent",
                        color: "#fff",
                        fontSize: 12
                      }}
                    />
                  </div>

                  {logsLoading && <p className="note">Loading logs...</p>}
                  {logsError && (
                    <p className="note danger">
                      {logsError}
                    </p>
                  )}

                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>User</th>
                          <th>Role</th>
                          <th>Type</th>
                          <th>Action</th>
                          <th>Module / Entity</th>
                          <th>Details</th>
                          <th>IP</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.map((l) => {
                          const name =
                            l.userName ||
                            (l.user && l.user.fullName) ||
                            "Unknown";
                          const email =
                            l.userEmail || (l.user && l.user.email) || "";
                          const displayUser = email ? `${name} (${email})` : name;
                          const time =
                            l.time ||
                            l.createdAt ||
                            l.timestamp ||
                            null;
                          const created = time
                            ? new Date(time).toISOString()
                            : "";
                          const role = l.role || l.userRole || "-";
                          const type = l.type || "-";
                          const action = l.action || "-";
                          const entity = l.entity || l.module || "-";
                          const details = l.description || l.details || "-";
                          const ip = l.ipAddress || "-";
                          const status = l.status || "-";

                          const key =
                            l.id || l._id || `${created}-${name}-${action}`;

                          return (
                            <tr key={key}>
                              <td style={{ whiteSpace: "nowrap" }}>{created}</td>
                              <td style={{ maxWidth: 220 }}>{displayUser}</td>
                              <td>{role}</td>
                              <td>{type}</td>
                              <td style={{ maxWidth: 180 }}>{action}</td>
                              <td style={{ maxWidth: 160 }}>{entity}</td>
                              <td
                                style={{
                                  maxWidth: 260,
                                  whiteSpace: "pre-wrap"
                                }}
                              >
                                {details}
                              </td>
                              <td>{ip}</td>
                              <td>{status}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredLogs.length === 0 && !logsLoading && (
                      <p className="empty">
                        No logs available for the selected filters. Once the
                        <code> /logs </code> API captures login, logout and
                        operations, they will appear here.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* ========== DASHBOARD TAB (old Reports) ========== */}
          {activeTab === "dashboard" && (
            <main className="layout single-column">
              <section className="full-width">
                <div className="card">
                  <div className="card-header-row">
                    <h2>Organization Dashboard – {monthLabel}</h2>
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

                  {/* KPI row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: 12,
                      fontSize: 13
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
                      <div>{totalProjects}</div>
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
                    <div className="mini-kpi">
                      <strong>Pending Requests</strong>
                      <div>{pendingCount}</div>
                    </div>
                  </div>
                </div>

                {/* Employee hours table */}
                <div className="card">
                  <h2>Employee Effort – Worked Hours</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Worked Hours</th>
                          <th>Entitlement</th>
                          <th>Leaves Taken</th>
                          <th>Half Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeHoursRows.map((e) => {
                          const s = summaries.find((x) => x.userId === e._id);
                          return (
                            <tr key={e._id}>
                              <td>{e.fullName}</td>
                              <td>{e.email}</td>
                              <td>{e.isActive ? "Active" : "Inactive"}</td>
                              <td>{e.workedHours}</td>
                              <td>{s?.totalLeaveEntitlement ?? "-"}</td>
                              <td>{s?.leavesTaken ?? "-"}</td>
                              <td>{s?.totalHalfDays ?? "-"}</td>
                            </tr>
                          );
                        })}
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
                          <th>Public Holidays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => {
                          const totals = projectTotals[p._id] || {
                            used: 0,
                            remaining: p.totalEstimatedHours || 355
                          };
                          return (
                            <tr key={p._id}>
                              <td>{p.name}</td>
                              <td>{p.code || "-"}</td>
                              <td>{p.assignments?.length || 0}</td>
                              <td>{p.totalEstimatedHours || 355}</td>
                              <td>{totals.used}</td>
                              <td>{totals.remaining}</td>
                              <td>{totalPublicForMonth}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {projects.length === 0 && (
                      <p className="empty">No projects yet</p>
                    )}
                  </div>
                </div>

                {/* Leave summary reuse */}
                <div className="card">
                  <h2>Leave Summary (All Employees)</h2>
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
                            <td>{s.fullName}</td>
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
                  <p className="note">
                    Reports are view-only. Update data using Timesheet
                    Management, Project Management and Logs &amp; Audit tabs.
                    Admin sees the same reports but cannot change any data.
                  </p>
                </div>
              </section>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
