import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ManagerPayslip from "./ManagerPayslip";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import ProjectEstimateCard from "../components/ProjectEstimateCard";
import { calculateProjectHours } from "../utils/hours";
import { buildHolidayCalendar } from "../utils/holidays";
import logo from "../assets/Company Logo.png";
import { io } from "socket.io-client";

// Add these imports after existing imports
import ProjectStatusBadge from "../components/projects/ProjectStatusBadge";
import ProjectActions from "../components/projects/ProjectActions";
//import TaskApproval from "../components/projects/TaskApproval";
import BalanceDisplay from "../components/projects/BalanceDisplay";

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

// Birthday months
const BIRTHDAY_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const BIRTHDAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

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
 *  - Optional public holidays that are marked as TAKEN
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

  // Get holidays for the date range
  const holidaysInRange = [];
  let currentMonth = sm;
  let currentYear = sy;

  while (currentYear < ey || (currentYear === ey && currentMonth <= em)) {
    const monthHolidays = buildHolidayCalendar(
      String(currentMonth).padStart(2, '0'),
      String(currentYear)
    ) || [];

    // Filter holidays that are within the date range
    monthHolidays.forEach((h) => {
      let holidayDate = null;

      // Case 1: h.date is "dd-mm-yyyy"
      if (typeof h.date === "string" && h.date.includes("-")) {
        const [hd, hm, hy] = h.date.split("-").map(Number);
        holidayDate = new Date(hy, hm - 1, hd);
      }

      // Case 2: h.dateKey is "yyyy-mm-dd"
      else if (typeof h.dateKey === "string" && h.dateKey.includes("-")) {
        const [hy, hm, hd] = h.dateKey.split("-").map(Number);
        holidayDate = new Date(hy, hm - 1, hd);
      }

      // Case 3: h.date is already a Date object
      else if (h.date instanceof Date) {
        holidayDate = h.date;
      }

      if (
        holidayDate &&
        !isNaN(holidayDate.getTime()) &&
        holidayDate >= start &&
        holidayDate <= end
      ) {
        holidaysInRange.push(h);
      }
    });


    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  // Create a Set of holiday dates for quick lookup
  const holidayDates = new Set();
  holidaysInRange.forEach(h => {
    if (typeof h.date === "string") {
      holidayDates.add(h.date);
    } else if (typeof h.dateKey === "string") {
      const [y, m, d] = h.dateKey.split("-");
      holidayDates.add(`${d}-${m}-${y}`);
    }

  });

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    const dateStr = `${dd}-${mm}-${yyyy}`;

    const weekday = cursor.getDay(); // 0 Sunday .. 6 Saturday
    const isSunday = weekday === 0;

    // Check if it's 2nd Saturday
    const dayOfMonth = cursor.getDate();
    const weekIndex = Math.floor((dayOfMonth - 1) / 7);
    const isSecondSaturday = weekday === 6 && weekIndex === 1;

    // Check if it's a holiday
    const isHoliday = holidayDates.has(dateStr);

    if (!isSunday && !isSecondSaturday && !isHoliday) {
      count += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
};

/**
 * Calculate months difference between two dates
 */
const calculateMonthsDiff = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;

  const [sd, sm, sy] = startStr.split("-").map(Number);
  const [ed, em, ey] = endStr.split("-").map(Number);

  // Validate all parts are numbers
  if ([sd, sm, sy, ed, em, ey].some(isNaN)) return 0;

  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  // Calculate difference in months
  let months = (ey - sy) * 12 + (em - sm);

  // If end day is less than start day, it's not a full month
  if (ed < sd) {
    months--;
  }

  // Add 1 to include both start and end months
  return Math.max(1, months + 1);
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

const calculateProjectDates = async (startDate, endDate) => {
  if (!startDate || !endDate) {
    return {
      workingDays: 0,
      totalEstimateHours: 0,
      durationMonths: 0
    };
  }

  try {
    const response = await api.post("/utils/calculate-dates", {

      startDate,
      endDate
    });

    if (response.data?.success) {
      return {
        workingDays: response.data.data.workingDays,
        totalEstimateHours: response.data.data.totalEstimateHours,
        durationMonths: response.data.data.durationMonths
      };
    }
  } catch {
    console.warn("Using fallback project date calculation");
  }


  // ---- FALLBACK ----
  const [, sm, sy] = startDate.split("-").map(Number);
  const [, em, ey] = endDate.split("-").map(Number);

  const months = (ey - sy) * 12 + (em - sm);
  const durationMonths = Math.max(1, months + 1);

  const estimatedWorkingDays = durationMonths * 20;
  const totalEstimateHours = estimatedWorkingDays * 8;

  return {
    workingDays: estimatedWorkingDays,
    totalEstimateHours,
    durationMonths
  };
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

// Helper function to calculate upcoming birthdays
const getUpcomingBirthdays = (birthdaysList, daysAhead = 3) => {
  const today = new Date();
  const upcoming = [];

  birthdaysList.forEach(b => {
    if (!b.month || !b.day) return;

    // Create birthday date for current year
    const birthdayThisYear = new Date(
      today.getFullYear(),
      BIRTHDAY_MONTHS.indexOf(b.month),
      b.day
    );

    // Calculate difference in days
    const diffInDays = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));

    // Check if birthday is within the next X days (including today)
    if (diffInDays >= 0 && diffInDays <= daysAhead) {
      upcoming.push({
        ...b,
        daysUntil: diffInDays,
        date: birthdayThisYear
      });
    }
  });

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
};

export default function ManagerDashboard() {
    const socketRef = useRef(null);

  const CURRENT_YEAR = new Date().getFullYear().toString();

  const { user, logout } = useAuth();

  // ---- TASK PERMISSION (MANAGER) ----
  const canManagerEditTask = (task) => {
    if (!task) return false;

    const userRole = user.role;
    const taskCreatedByRole = task.createdByRole;
    const taskCreatedById = task.createdByUserId?._id || task.createdByUserId;
    const userId = user._id || user.id;

    // Admin never edits (safety)
    if (userRole === "admin") return false;

    // Manager can edit:
    // 1. Tasks created by employees (any employee)
    // 2. Tasks created by themselves
    if (userRole === "manager") {
      if (taskCreatedByRole === "employee") return true;
      if (taskCreatedByRole === "manager" && taskCreatedById === userId) return true;
    }

    return false;
  };

  // ------- NOTIFICATION CENTER (bell icon) -------
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Tabs: dashboard | projects | timesheet | logs | birthdays
  const [activeTab, setActiveTab] = useState("dashboard");

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [{ month, year }, setMonthYear] = useState(getCurrentMonth);
  const [summaries, setSummaries] = useState([]);
  const [taskSearch, setTaskSearch] = useState("");

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null); // Added missing state

  const [projectTasks, setProjectTasks] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({
    projectId: "",
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
    createdBy: user.fullName, // Set default to current manager
    createdByRole: "manager", // Set default role
    createdByUserId: user._id || user.id // Set current user ID
  });

  // Create employee form
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    laptopId: "",
    password: "Emp@123",
    totalLeaveEntitlement: 16,
    carryForward2025: 0
  });

  // Project create form – with start and end dates
  const [projectForm, setProjectForm] = useState({
    name: "",
    code: "",
    description: "",
    startDate: "",
    endDate: "",
    totalEstimatedHours: 0,
    projectMonths: 0
  });

  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] = useState("Developer");

  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // Optional holiday "Taken / Not Taken" state
  const [holidayTakenMap, setHolidayTakenMap] = useState({});

  // ---------- LOGS (HR View) ----------

  const [logs, setLogs] = useState([]);
  const [logsError] = useState(null);

  const [logsLoading, setLogsLoading] = useState(false);
  const [logsView, setLogsView] = useState("ALL");
  const [logUserFilter, setLogUserFilter] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");

  // Pending attendance / leave / comp-off requests
  const [pendingRequests, setPendingRequests] = useState([]);

  // Today holiday information
  const todayHolidayInfo = getTodayHolidayInfo();

  // ---------- BIRTHDAYS ----------
  const [birthdays, setBirthdays] = useState([]);
  const [birthdayForm, setBirthdayForm] = useState({
    employeeId: "",
    month: "",
    day: "",
    year: new Date().getFullYear(),
    note: ""
  });
  const [filterMonth, setFilterMonth] = useState("");
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [employeeBirthdayMap, setEmployeeBirthdayMap] = useState({});
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [creatingBirthday, setCreatingBirthday] = useState(false);

  // Calculate employees without birthdays using useMemo
  const employeesWithoutBirthdays = useMemo(() => {
    return employees.filter(emp =>
      !employeeBirthdayMap[emp._id] && emp.isActive
    );
  }, [employees, employeeBirthdayMap]);

  // Calculate filtered birthdays using useMemo
  const filteredBirthdays = useMemo(() => {
    if (!filterMonth) return birthdays;
    return birthdays.filter(b => b.month === filterMonth);
  }, [birthdays, filterMonth]);

  // -------- LOGOUT HANDLER ----------
  const handleLogout = async () => {
    try {
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
      if (year !== CURRENT_YEAR) {
        setAttendance([]);
        return;
      }

      const res = await api.get("/attendance", { params: { month, year } });
      setAttendance(res.data || []);
    },
    [month, year, CURRENT_YEAR]
  );



  const loadSummaries = useCallback(
    async () => {
      if (year !== CURRENT_YEAR) {
        setSummaries([]);
        return;
      }

      try {
        const res = await api.get("/leave/summary/all", {
          params: { month, year }
        });
        setSummaries(res.data || []);
      } catch {
        setSummaries([]);
      }
    },
    [month, year, CURRENT_YEAR]
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

  const loadPendingRequests = useCallback(async () => {
    try {
      const res = await api.get("/attendance/requests");
      setPendingRequests(res.data || []);
    } catch (err) {
      console.error("Error loading attendance requests", err?.response || err);
      setPendingRequests([]);
    }
  }, []);

  const loadLogs = useCallback(
    async () => {
      if (year !== CURRENT_YEAR) {
        setLogs([]);
        return;
      }

      try {
        setLogsLoading(true);
        const res = await api.get("/logs", { params: { month, year } });
        setLogs(res.data || []);
      } finally {
        setLogsLoading(false);
      }
    },
    [month, year, CURRENT_YEAR]
  );

  // -------- NOTIFICATION LOADER ----------
  const loadNotifications = useCallback(async () => {
    try {
      // 1️⃣ Generate daily summary (creates if not exists)
      await api.post("/notifications/manager/daily-summary");

      // 2️⃣ Fetch notifications
      const res = await api.get("/notifications/my", {
        params: { unreadOnly: false }
      });

      setNotifications(res.data || []);
    } catch (err) {
      console.error("Notification load error", err);
    }
  }, []);

  // -------- BIRTHDAY FUNCTIONS ----------
  const loadBirthdays = useCallback(async () => {
    try {
      setBirthdaysLoading(true);

      let res;
      try {
        // Primary endpoint
        res = await api.get("/birthday");

      } catch {
        // 🔁 Fallback endpoint (IMPORTANT)
        res = await api.get("/birthday");
      }

      const raw = res.data || [];

      // ✅ Normalize backend response (FINAL)
      const normalized = raw.map((b) => {
        let day;
        let month;
        let year;

        // ✅ Case 1: Backend already sends parsed fields
        if (b.day && b.month && b.year) {
          day = b.day;
          month = BIRTHDAY_MONTHS[b.month - 1]; // 🔴 FIX: number → name
          year = b.year;
        }

        // ✅ Case 2: Backend sends only dob (dd-mm-yyyy)
        else if (b.dob && typeof b.dob === "string") {
          const [dd, mm, yyyy] = b.dob.split("-").map(Number);
          day = dd;
          month = BIRTHDAY_MONTHS[mm - 1];
          year = yyyy;
        }

        return {
          ...b,
          day,
          month,
          year,

          // ✅ employee mapping (VERY IMPORTANT)
          employeeId: b.employee?._id,
          employeeName: b.employee?.fullName,
          employeeEmail: b.employee?.email,
          employeeCode: b.employee?.employeeId
        };
      });


      setBirthdays(normalized);

      // Employee → birthday map
      const map = {};
      normalized.forEach((b) => {
        map[b.employeeId] = b;
      });
      setEmployeeBirthdayMap(map);

      // Upcoming birthdays (next 7 days)
      setUpcomingBirthdays(getUpcomingBirthdays(normalized, 7));

    } catch (err) {
      console.error("❌ Birthday load failed:", err?.response?.data || err);
      setBirthdays([]);
      setEmployeeBirthdayMap({});
      setUpcomingBirthdays([]);
    } finally {
      setBirthdaysLoading(false);
    }
  }, []);


  const handleCreateBirthday = async (e) => {
    e.preventDefault();

    try {
      if (!birthdayForm.employeeId || !birthdayForm.month || !birthdayForm.day) {
        alert("Please select employee, month and day");
        return;
      }

      // Get the selected employee info for better feedback
      const selectedEmp = employees.find(emp => emp._id === birthdayForm.employeeId);
      if (!selectedEmp) {
        alert("Selected employee not found");
        return;
      }

      // Check if employee already has a birthday record
      if (employeeBirthdayMap[birthdayForm.employeeId]) {
        alert("This employee already has a birthday record. Please update the existing record instead.");
        return;
      }

      setCreatingBirthday(true);

      // Format the date properly
      const monthIndex = BIRTHDAY_MONTHS.indexOf(birthdayForm.month) + 1;
      const dob = `${String(birthdayForm.day).padStart(2, "0")}-${String(monthIndex).padStart(2, "0")}-${birthdayForm.year || "1990"}`;

      console.log("Creating birthday with data:", {
        employeeId: birthdayForm.employeeId,
        dob: dob,
        note: birthdayForm.note || `Birthday of ${selectedEmp.fullName}`
      });

      try {
        // Try POST to /birthdays first (plural endpoint)
        await api.post("/birthday", {
          employeeId: birthdayForm.employeeId,
          dob: dob,
          note: birthdayForm.note || `Birthday of ${selectedEmp.fullName}`
        });
      } catch (postErr) {
        console.log("POST /birthdays failed, trying /birthday:", postErr);
        // Try POST to /birthday (singular endpoint) as fallback
        await api.post("/birthday", {
          employeeId: birthdayForm.employeeId,
          dob: dob,
          note: birthdayForm.note || `Birthday of ${selectedEmp.fullName}`
        });
      }

      alert(`🎉 Birthday for ${selectedEmp.fullName} saved successfully!`);

      // Reset form
      setBirthdayForm({
        employeeId: "",
        month: "",
        day: "",
        year: new Date().getFullYear(),
        note: ""
      });

      // Reload birthdays immediately
      await loadBirthdays();

      // Also reload employees to update the "without birthdays" list
      await loadEmployees();

    } catch (err) {
      console.error("Birthday save error:", err?.response?.data || err.message || err);
      alert(err.response?.data?.message || "Error saving birthday. Please check console for details.");
    } finally {
      setCreatingBirthday(false);
    }
  };

  const handleDeleteBirthday = async (id) => {
    if (!window.confirm("Delete this birthday record?")) return;

    try {
      await api.delete(`/birthday/${id}`);
      alert("Birthday record deleted");

      // Reload birthdays immediately
      await loadBirthdays();
      await loadEmployees();
    } catch (err) {
      console.error("Error deleting birthday", err);
      alert("Error deleting birthday");
    }
  };

  const sendBirthdayWish = async (birthdayId) => {
    try {
      await api.post(`/birthday/${birthdayId}/wish`, {
        wishedBy: user.fullName,
        wishedByEmail: user.email
      });
      alert("Birthday wish sent to employee!");

      // Reload birthdays to update wish status
      await loadBirthdays();
    } catch (err) {
      console.error("Error sending birthday wish", err);
      alert("Error sending birthday wish");
    }
  };

  // Automatically send birthday wishes for today's birthdays
  const autoSendBirthdayWishes = useCallback(async () => {
    const today = new Date();
    const todayMonth = BIRTHDAY_MONTHS[today.getMonth()];
    const todayDay = today.getDate();

    const todaysBirthdays = birthdays.filter(b =>
      b.month === todayMonth && b.day === todayDay && !b.wished
    );

    for (const bd of todaysBirthdays) {
      try {
        await api.post(`/birthday/${bd._id}/wish`, {
          wishedBy: user.fullName,
          wishedByEmail: user.email,
          auto: true
        });
        console.log(`Auto birthday wish sent to ${bd.employeeName}`);
      } catch (err) {
        console.error(`Failed to auto-wish ${bd.employeeName}`, err);
      }
    }

    if (todaysBirthdays.length > 0) {
      await loadBirthdays();
    }
  }, [birthdays, user, loadBirthdays]);

  // Add this function to refresh project balance
  const refreshProjectBalance = useCallback(async (projectId) => {
    if (!projectId) return;
    
    try {
      const response = await api.get(`/projects/${projectId}`);
      if (response.data) {
        const updatedProject = response.data;
        
        // Update selected project
        setSelectedProject(prev => ({
          ...prev,
          balanceHours: updatedProject.balanceHours,
          consumedHours: updatedProject.consumedHours,
          consumptionByRole: updatedProject.consumptionByRole
        }));
        
        // Update projects list
        setProjects(prev => prev.map(p => 
          p._id === projectId 
            ? {...p, 
               balanceHours: updatedProject.balanceHours,
               consumedHours: updatedProject.consumedHours,
               consumptionByRole: updatedProject.consumptionByRole
              }
            : p
        ));
      }
    } catch (err) {
      console.error("Error refreshing project balance:", err);
    }
  }, []);

  // Debug useEffect to monitor state changes
  useEffect(() => {
    console.log("=== BIRTHDAY STATE DEBUG ===");
    console.log("Birthdays:", birthdays.length, "records");
    console.log("Birthdays data:", birthdays);
    console.log("Employee Birthday Map:", Object.keys(employeeBirthdayMap).length, "employees");
    console.log("Employees without birthdays:", employeesWithoutBirthdays.length);
    console.log("Filtered birthdays:", filteredBirthdays.length);
    console.log("Upcoming birthdays:", upcomingBirthdays.length);
  }, [birthdays, employeeBirthdayMap, employeesWithoutBirthdays, filteredBirthdays, upcomingBirthdays]);

  // Monitor birthday form state
  useEffect(() => {
    console.log("Birthday form state:", birthdayForm);
  }, [birthdayForm]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadEmployees();
      loadProjects();
      loadBirthdays();
      loadNotifications();   // ✅ ADD THIS
    }, 0);
    return () => clearTimeout(id);
  }, [loadEmployees, loadProjects, loadBirthdays, loadNotifications]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadAttendance();
      loadSummaries();
      loadPendingRequests();
    }, 0);
    return () => clearTimeout(id);
  }, [loadAttendance, loadSummaries, loadPendingRequests]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadProjectTasks(selectedProjectId);
    }, 0);
    return () => clearTimeout(id);
  }, [selectedProjectId, loadProjectTasks]);

  // Update selectedProject when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId && projects.length > 0) {
      const project = projects.find(p => p._id === selectedProjectId);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projects]);

  // Rebuild default Taken/NotTaken map
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

  // Load logs only when Logs tab is active
  useEffect(() => {
    if (activeTab !== "logs") return undefined;
    const id = setTimeout(() => {
      loadLogs();
    }, 0);
    return () => clearTimeout(id);
  }, [activeTab, loadLogs]);

  // Auto send birthday wishes on component mount
  useEffect(() => {
    const id = setTimeout(() => {
      autoSendBirthdayWishes();
    }, 1000); // Wait 1 second after component mounts
    return () => clearTimeout(id);
  }, [autoSendBirthdayWishes]);

    // Socket.IO connection for real-time updates
    // Socket.IO connection for real-time updates
  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_URL || "http://localhost:5000");

    socketRef.current.on("connect", () => {
      console.log("Manager connected:", socketRef.current.id);
    });

    socketRef.current.on("dashboardUpdated", () => {
      loadEmployees();
      loadAttendance();
      loadSummaries();
      loadProjects();
      loadProjectTasks(selectedProjectId);
      loadPendingRequests();
      loadBirthdays();
      loadLogs();
      loadNotifications(); // ✅ ADD THIS
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [
    loadEmployees,
    loadAttendance,
    loadSummaries,
    loadProjects,
    loadProjectTasks,
    loadPendingRequests,
    loadBirthdays,
    loadLogs,
    loadNotifications, // ✅ ADD THIS
    selectedProjectId // Add this since loadProjectTasks uses it
  ]);

  // -------- EMPLOYEE CRUD / LEAVES ----------
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
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

      const generatedEmployeeId = response.data.employeeId;

      alert(
        `✅ Employee created successfully!
        
        Employee Details:
        • Name: ${form.fullName}
        • Email: ${form.email}
        • Employee ID: ${generatedEmployeeId}
        • Default Password: ${form.password}
        
        Please share the Employee ID and password with the employee.
        Public & weekend holidays are auto-configured.`
      );

      setForm({
        fullName: "",
        email: "",
        laptopId: "",
        password: "Emp@123",
        totalLeaveEntitlement: 16,
        carryForward2025: 0
      });

      await loadEmployees();
      await loadSummaries();

    } catch (err) {
      console.error("Create employee error:", err);
      alert(err.response?.data?.message || "Error creating employee");
    }
  };

  const deactivate = async (id) => {
    if (!window.confirm("Deactivate this employee?")) return;
    await api.patch(`/employees/${id}/deactivate`);
    loadEmployees();
    loadSummaries();
  };

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

      alert(
        `Leave configuration updated for ${emp.fullName} (${emp.employeeId}).`
      );

      await loadEmployees();
      setSummaries([]);
      await loadSummaries();
      setAttendance([]);
      await loadAttendance();

    } catch (err) {
      console.error("Edit leave config error:", err);
      alert(err.response?.data?.message || "Error updating leave config");
    }
  };

  const decideLeave = async (id, decision) => {
    try {
      await api.patch(`/attendance/requests/${id}/decision`, { decision });
      loadAttendance();
      loadSummaries();
      loadPendingRequests();
      alert(
        decision === "APPROVED"
          ? "Leave / attendance request approved."
          : "Leave / attendance request rejected."
      );
    } catch (err) {
      console.error("Error deciding leave request", err?.response || err);
      alert(
        err?.response?.data?.message ||
        "Error applying decision on leave / attendance request"
      );
    }
  };



  const handleResetEmployeePassword = async (e) => {
    e.preventDefault();
    try {
      await api.patch("/auth/reset-by-admin", {
        email: resetEmail.trim(),
        role: "employee",
        newPassword: resetNewPassword
      });
      alert(
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
      alert(msg);
    }
  };

  // -------- MONTH FILTER ----------
  const handleMonthChange = (e) => {
    const [m, y] = e.target.value.split("-");
    setMonthYear({ month: m, year: y });
  };

  const handleYearChange = (e) => {
    const y = e.target.value;
    setMonthYear({ month, year: y });
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
      // Validate dates
      if (!projectForm.startDate || !projectForm.endDate) {
        alert("Start date and end date are required");
        return;
      }

      // Parse dates for validation
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const [dd, mm, yyyy] = dateStr.split("-").map(Number);
        return new Date(yyyy, mm - 1, dd);
      };

      const startDate = parseDate(projectForm.startDate);
      const endDate = parseDate(projectForm.endDate);

      if (endDate < startDate) {
        alert("End date cannot be before start date");
        return;
      }

      const payload = {
        name: projectForm.name,
        code: projectForm.code,
        description: projectForm.description,
        startDate: projectForm.startDate,
        endDate: projectForm.endDate,
        totalEstimatedHours: Number(projectForm.totalEstimatedHours) || 0,
        durationMonths: Number(projectForm.projectMonths) || 0,
      };

      const res = await api.post("/projects", payload);
      alert("✅ Project created successfully with date range and auto-calculated hours");
      setSelectedProjectId(res.data._id);
      setTaskForm((prev) => ({
        ...prev,
        projectId: res.data._id
      }));
      loadProjects();

      // Reset form
      setProjectForm({
        name: "",
        code: "",
        description: "",
        startDate: "",
        endDate: "",
        totalEstimatedHours: 0,
        projectMonths: 0,
      });
    } catch (err) {
      console.error("Create project error:", err);
      alert(err.response?.data?.message || "Error creating project");
    }
  };

  const handleAssignProject = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !assignUserId) {
      alert("Select project and employee");
      return;
    }
    try {
      await api.post(`/projects/${selectedProjectId}/assign`, {
        userId: assignUserId,
        role: assignRole
      });
      alert("Employee assigned to project");
      setAssignUserId("");
      setAssignRole("Developer");
      loadProjects();
    } catch (err) {
      alert(err.response?.data?.message || "Error assigning employee");
    }
  };

  const handleUnassign = async (projectId, userId) => {
    if (!window.confirm("Remove this employee from project?")) return;
    await api.delete(`/projects/${projectId}/assign/${userId}`);
    loadProjects();
    loadProjectTasks(projectId);
  };

  // -------- PROJECT TASKS ----------
  const handleSubmitTask = async (e) => {
  e.preventDefault();
  
  if (!selectedProjectId) {
    alert("Select a project first");
    return;
  }

  // Get the selected project to check if it exists
  const selectedProjectObj = projects.find(p => p._id === selectedProjectId);
  if (!selectedProjectObj) {
    alert("Selected project not found");
    return;
  }

  // Validate required fields
  if (!taskForm.recentRequirement?.trim()) {
    alert("Requirement field is required");
    return;
  }

  // Calculate days and hours
  const calculatedDays = diffDays(
    taskForm.originalClosureDate,
    taskForm.estimatedDate
  );
  
  const finalDays = taskForm.noOfDays || calculatedDays || 0;
  const hoursAllocated = taskForm.hoursAllocated || (finalDays > 0 ? finalDays * 8 : 0);

  try {
    // ✅ CORRECT PAYLOAD STRUCTURE - matches backend requirements
    const payload = {
      // REQUIRED FIELDS (Backend will reject without these)
      project: selectedProjectId, // Changed from projectId to project
      title: taskForm.recentRequirement?.trim() || "Project Requirement",
      estimateHours: hoursAllocated,
      month: Number(month),
      year: Number(year),
      role: assignRole || "Developer", // Use dropdown value or default

      // Optional fields (if you want to include them)
      description: taskForm.notes || "",
      notes: taskForm.notes || "",
      status: taskForm.status || "OPEN",
      
      // Your existing fields (mapped to correct schema)
      requirementType: taskForm.requirementType,
      scope: taskForm.scope,
      discussedDate: taskForm.discussedDate,
      originalClosureDate: taskForm.originalClosureDate,
      estimatedDate: taskForm.estimatedDate,
      noOfDays: finalDays,
      clientPriority: taskForm.clientPriority,
      prioritySource: taskForm.prioritySource,
      
      // Assignment fields
      assignedUserId: taskForm.assignedUserId || null,
      
      // Created by information
      createdBy: user.fullName,
      createdByRole: "manager",
      createdByUserId: user._id || user.id
    };

    // Clean up empty fields
    if (!payload.assignedUserId) {
      delete payload.assignedUserId;
    }

    if (editingTaskId) {
      // Update existing task
      await api.patch(`/tasks/${editingTaskId}`, payload);
      alert("Task updated successfully");
    } else {
      // Create new task
      await api.post("/tasks", payload);
      alert("Task created successfully");
    }

    // Reset form
    setEditingTaskId(null);
    setTaskForm({
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
      createdBy: user.fullName,
      createdByRole: "manager",
      createdByUserId: user._id || user.id
    });
    
    // Reload tasks
    loadProjectTasks(selectedProjectId);
    
  } catch (err) {
    console.error("Error saving task", err);
    const errorMsg = err.response?.data?.message || 
                     err.response?.data?.error || 
                     "Error saving task";
    alert(`Error: ${errorMsg}`);
  }
};

  const startEditTask = (t) => {
    setEditingTaskId(t._id);
    setAssignRole(t.role || "Developer"); // Populate role from task
    
    setTaskForm({
      projectId: selectedProjectId,
      assignedUserId: t.assignedUserId || (t.assignedUser && t.assignedUser._id) || "",
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
      createdBy: t.createdBy || user.fullName,
      createdByRole: t.createdByRole || "manager",
      createdByUserId: t.createdByUserId?._id || t.createdByUserId || user._id || user.id
    });
  };

  const updateTaskField = async (id, updates) => {
    try {
      const payload = { ...updates };
      await api.patch(`/tasks/${id}`, payload);
      loadProjectTasks();
    } catch (err) {
      console.error("Error updating task", err);
      alert(err.response?.data?.message || "Error updating task");
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
      remaining: Math.max(0, (p.totalEstimatedHours || 0) - used)
    };
    return acc;
  }, {});

  const selectedEmployeeHours =
    (selectedEmployeeId && hoursByEmployee[selectedEmployeeId]) || 0;

  // -------- REPORT METRICS (HR) ----------

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

  // -------- BIRTHDAY STATISTICS ----------
  const birthdayStats = {
    totalRecords: birthdays.length,
    withoutRecords: employeesWithoutBirthdays.length,
    wishedThisYear: birthdays.filter(b => b.wished).length,
    upcoming7Days: upcomingBirthdays.length
  };
  const filteredProjectTasks = (Array.isArray(projectTasks) ? projectTasks : []).filter((t) => {
  if (!taskSearch.trim()) return true;

  const q = taskSearch.toLowerCase();

  const projectName =
    t.project?.name ||
    projects.find(p => p._id === t.projectId)?.name ||
    "";

  const employeeName =
    t.assignedUser?.fullName ||
    t.assignedUser?.email ||
    "";

  return (
    (t.recentRequirement || "").toLowerCase().includes(q) ||
    (t.status || "").toLowerCase().includes(q) ||
    (t.scope || "").toLowerCase().includes(q) ||
    (t.clientPriority || "").toLowerCase().includes(q) ||
    projectName.toLowerCase().includes(q) ||
    employeeName.toLowerCase().includes(q)
  );
});
  return (
    <div className="page">
      <div className="shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src={logo} alt="NowIT Services" />
            </div>

          </div>
          <nav className="sidebar-nav">
            <button
              className={
                activeTab === "dashboard" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveTab("dashboard")}
            >
              Dashboard
            </button>

            <button
              className={
                activeTab === "projects" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveTab("projects")}
            >
              Project Management
            </button>

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

            <button
              className={activeTab === "logs" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("logs")}
            >
              Logs &amp; Audit
            </button>
            <button
              className={activeTab === "birthdays" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("birthdays")}
            >
              Birthdays
            </button>

          </nav>
        </aside>

        <div className="main-area">
          <header className="topbar">
            <div>
              <strong>{user.fullName}</strong> (HR) — {user.email}

            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              {/* Notification Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="outline-btn"
                  style={{ position: "relative", paddingInline: 10 }}
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                  }}
                >
                  <span role="img" aria-label="alerts">
                    🔔
                  </span>
                  {notifications.filter(n => !n.read).length > 0 && (
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
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {showNotifications && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      width: 420,
                      maxHeight: 480,
                      background: "linear-gradient(180deg, #1f1f1f, #141414)",
                      border: "1px solid #2a2a2a",
                      borderRadius: 12,
                      boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
                      zIndex: 1000,
                      overflow: "hidden",
                      marginTop: 10
                    }}
                  >

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 18px",
                        background: "rgba(255,255,255,0.03)",
                        borderBottom: "1px solid #2a2a2a"
                      }}
                    >
                      <strong style={{ fontSize: 14, color: "#e6f7ff" }}>
                        Notifications ({notifications.length})
                      </strong>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowNotifications(false)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#aaa",
                            fontSize: 18,
                            cursor: "pointer"
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>


                    <div style={{
                      maxHeight: 400,
                      overflowY: "auto",
                      padding: 0
                    }}>
                      {notifications.length === 0 ? (
                        <div style={{
                          padding: "40px 20px",
                          textAlign: "center",
                          color: "#999",
                          fontSize: 14
                        }}>
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            style={{
                              padding: "12px 16px",
                              borderBottom: "1px solid #333",
                              background: n.read ? "#1a1a1a" : "#262626",
                              position: "relative"
                            }}
                          >
                            <div style={{
                              fontSize: 13,
                              fontWeight: 600,
                              marginBottom: 4
                            }}>
                              {n.title}
                            </div>

                            <div style={{
                              fontSize: 12,
                              color: "#ccc",
                              marginBottom: 6,
                              whiteSpace: "pre-wrap"
                            }}>
                              {n.message}
                            </div>

                            {!n.read && (
                              <button
                                style={{
                                  fontSize: 11,
                                  background: "#1890ff",
                                  color: "#fff",
                                  border: "none",
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  cursor: "pointer"
                                }}
                                onClick={async () => {
                                  await api.patch(`/notifications/${n._id}/read`);
                                  loadNotifications();
                                }}
                              >
                                Mark Read
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

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

          {/* ========== TIMESHEET MANAGEMENT TAB ========== */}
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
holiday calendar and cannot be changed by HR.

                  </p>
                </div>

                <div className="card">
                  <h2>Employees</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Laptop ID</th>

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
                            <td>{e.assets?.find(a => a.type === "LAPTOP")?.assetId || "-"}</td>

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
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {/* MONTH DROPDOWN */}
                      <select
                        value={month}
                        onChange={(e) =>
                          setMonthYear({ month: e.target.value, year })
                        }
                        className="month-selector"
                      >
                        {monthNames.map((m, i) => (
                          <option key={m} value={String(i + 1).padStart(2, "0")}>
                            {m}
                          </option>
                        ))}
                      </select>

                      {/* YEAR DROPDOWN */}
                      <select
                        value={year}
                        onChange={handleYearChange}
                        className="month-selector"
                      >
                        {Array.from({ length: 6 }, (_, i) => {
                          const y = new Date().getFullYear() - 3 + i;
                          return (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          );
                        })}
                      </select>

                    </div>

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
                          <th>Requested Date</th>
                          <th>Request Type</th>
                          <th>Requested Timings</th>
                          <th>Note</th>
                          <th>Action</th>
                        </tr>

                      </thead>
                      <tbody>
                        {pendingRequests.map((p) => (
                          <tr key={p._id}>
                            <td>{p.user?.fullName || "Unknown Employee"}</td>

                            <td>{p.date}</td>

                            <td>{p.toStatus}</td>

                            <td>
                              {p.toWorkInTime && p.toWorkOutTime ? (
  <>
    {p.toWorkInTime.slice(0, 5)} – {p.toWorkOutTime.slice(0, 5)}
    <br />
    <small style={{ opacity: 0.75 }}>
      Lunch: {p.lunchBreakMinutes ? `${p.lunchBreakMinutes} mins` : "—"}
    </small>
  </>
) : "-"}

                            </td>

                            <td>
                              {p.note?.trim() ? p.note : "-"}
                            </td>

                            <td style={{ whiteSpace: "nowrap" }}>
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
  <th>Lunch</th> {/* ADD THIS LINE */}
  <th>Decision</th>
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
      <td>
        {a.lunchBreakMinutes
          ? `${a.lunchBreakMinutes} mins`
          : "-"}
      </td>
      <td>{a.managerDecision?.status}</td>
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

          {/* ========== PROJECT MANAGEMENT TAB ========== */}
          {activeTab === "projects" && (
            <main className="layout single-column">
              <section className="full-width">
                {/* Project Setup */}
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
                        placeholder="Enter project name"
                        required
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
                        placeholder="e.g., PROJ-001"
                      />
                    </label>

                    {/* DATE FIELDS */}
                    {/* START DATE */}
                    <label>
                      Start Date
                      <input
                        type="date"
                        value={toInputDate(projectForm.startDate)}
                        onChange={async (e) => {
                          const newStartDate = fromInputDate(e.target.value);

                          if (!newStartDate) {
                            setProjectForm({
                              ...projectForm,
                              startDate: "",
                              totalEstimatedHours: 0,
                              projectMonths: 0
                            });
                            return;
                          }

                          // If no end date, just set start date
                          if (!projectForm.endDate) {
                            setProjectForm({
                              ...projectForm,
                              startDate: newStartDate
                            });
                            return;
                          }

                          // Validate dates
                          const [sd, sm, sy] = newStartDate.split("-").map(Number);
                          const [ed, em, ey] = projectForm.endDate.split("-").map(Number);

                          const startDate = new Date(sy, sm - 1, sd);
                          const endDate = new Date(ey, em - 1, ed);

                          if (endDate < startDate) {
                            alert("❌ End date cannot be before start date");
                            return;
                          }

                          // Calculate project details from backend
                          const calculation = await calculateProjectDates(
                            newStartDate,
                            projectForm.endDate
                          );

                          setProjectForm({
                            ...projectForm,
                            startDate: newStartDate,
                            totalEstimatedHours: calculation.totalEstimateHours,
                            projectMonths: calculation.durationMonths,
                          });
                        }}
                        required
                      />
                      <small style={{ fontSize: 11, color: '#aaa', display: 'block', marginTop: 4 }}>
                        Format: DD-MM-YYYY
                      </small>
                    </label>

                    {/* END DATE */}
                    <label>
                      End Date
                      <input
                        type="date"
                        value={toInputDate(projectForm.endDate)}
                        onChange={async (e) => {
                          const newEndDate = fromInputDate(e.target.value);

                          if (!newEndDate) {
                            setProjectForm({
                              ...projectForm,
                              endDate: "",
                              totalEstimatedHours: 0,
                              projectMonths: 0
                            });
                            return;
                          }

                          // If no start date, just set end date
                          if (!projectForm.startDate) {
                            setProjectForm({
                              ...projectForm,
                              endDate: newEndDate
                            });
                            return;
                          }

                          // Validate dates
                          const [sd, sm, sy] = projectForm.startDate.split("-").map(Number);
                          const [ed, em, ey] = newEndDate.split("-").map(Number);

                          const startDate = new Date(sy, sm - 1, sd);
                          const endDate = new Date(ey, em - 1, ed);

                          if (endDate < startDate) {
                            alert("❌ End date cannot be before start date");
                            return;
                          }

                          // Calculate project details from backend
                          const calculation = await calculateProjectDates(
                            projectForm.startDate,
                            newEndDate
                          );

                          setProjectForm({
                            ...projectForm,
                            endDate: newEndDate,
                            totalEstimatedHours: calculation.totalEstimateHours,
                            projectMonths: calculation.durationMonths,
                          });
                        }}
                        required
                      />
                      <small style={{ fontSize: 11, color: '#aaa', display: 'block', marginTop: 4 }}>
                        Format: DD-MM-YYYY
                      </small>
                    </label>

                    {/* AUTO-CALCULATED & EDITABLE FIELDS */}
                    <label>
                      Total Estimate Hours
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          value={projectForm.totalEstimatedHours}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setProjectForm({
                              ...projectForm,
                              totalEstimatedHours: value >= 0 ? value : 0
                            });
                          }}
                          min="0"
                          step="1"
                        />
                        {projectForm.startDate && projectForm.endDate && (
                          <small style={{
                            fontSize: 10,
                            color: '#40a9ff',
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'rgba(64, 169, 255, 0.1)',
                            padding: '2px 6px',
                            borderRadius: 3
                          }}>
                            Auto: {diffDays(projectForm.startDate, projectForm.endDate) * 8} hrs
                          </small>
                        )}
                      </div>
                      <small style={{ fontSize: 11, color: '#aaa', display: 'block', marginTop: 4 }}>
                        Auto-calculated from dates (Working days × 8 hours)
                      </small>
                    </label>

                    <label>
                      Duration (Months)
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          value={projectForm.projectMonths}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setProjectForm({
                              ...projectForm,
                              projectMonths: value >= 1 ? value : 1
                            });
                          }}
                          min="1"
                          step="1"
                        />
                        {projectForm.startDate && projectForm.endDate && (
                          <small style={{
                            fontSize: 10,
                            color: '#40a9ff',
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'rgba(64, 169, 255, 0.1)',
                            padding: '2px 6px',
                            borderRadius: 3
                          }}>
                            Auto: {calculateMonthsDiff(projectForm.startDate, projectForm.endDate)} mo
                          </small>
                        )}
                      </div>
                      <small style={{ fontSize: 11, color: '#aaa', display: 'block', marginTop: 4 }}>
                        Auto-calculated from dates
                      </small>
                    </label>

                    <label className="full-row">
                      Description
                      <textarea
                        rows={3}
                        value={projectForm.description}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            description: e.target.value
                          })
                        }
                        placeholder="Enter project description..."
                      />
                    </label>

                    <div className="full-row" style={{ marginTop: 8 }}>
                      <button type="submit" className="primary-btn" style={{ width: '100%' }}>
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
                            {p.name} ({p.code || 'No Code'})
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
                                      border: "1px solid rgba(255,255,255,0.15)",
                                      color: bg === "transparent" ? "#000" : color,
                                      verticalAlign: "top",
                                      padding: 4,
                                      minWidth: 40,
                                      backgroundColor: bg === "transparent" ? "#ffffff" : bg,
                                      fontWeight: bg === "transparent" ? "600" : "400"
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
                        These settings are controlled by HR. Optional
holidays marked as Taken will also be visible in Employee and Admin views.

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
                    below.
                  </p>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Code</th>
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Status</th> {/* ADD THIS */}
                          <th>Duration</th>
                          <th>Total Hours</th>
                          <th>Employees</th>
                          <th>Worked (hrs)</th>
                          <th>Balance (hrs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => {
                          const totals = projectTotals[p._id] || {
                            used: 0,
                            remaining: p.totalEstimatedHours || 0
                          };
                          const count = p.assignments?.length || 0;
                          const isSelected = selectedProjectId === p._id;

                          return (
                            <tr
                              key={p._id}
                              style={{
                                cursor: "pointer",
                                fontWeight: isSelected ? "600" : "400",
                                backgroundColor: isSelected ? "rgba(64, 169, 255, 0.1)" : "transparent"
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
                              <td style={{ padding: '8px' }}>{p.name}</td>
                              <td style={{ padding: '8px' }}>{p.code || "-"}</td>
                              <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{p.startDate || "-"}</td>
                              <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{p.endDate || "-"}</td>
                              
                              {/* ADD STATUS BADGE */}
                              <td style={{ padding: '8px' }}>
                                <ProjectStatusBadge status={p.status} />
                              </td>
                              
                              <td style={{ padding: '8px', textAlign: 'center' }}>{p.durationMonths || 0} mo</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <div>
                                  <div>{p.totalEstimatedHours || 0} hrs</div>
                                </div>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{count}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{totals.used} hrs</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <span className={p.balanceHours < 0 ? "text-red-600 font-bold" : ""}>
                                  {p.balanceHours ?? 0} hrs
                                </span>
                              </td>
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
                        <strong>Estimate:</strong> {selectedProject.totalEstimatedHours || 0} hrs •
                        <strong> Worked:</strong> {projectTotals[selectedProject._id]?.used || 0} hrs •
                        <strong> Balance:</strong> {selectedProject.balanceHours ?? 0} hrs
                      </p>
                      
                      {/* ADD PROJECT ACTIONS */}
                      <ProjectActions 
                        projectId={selectedProject._id}
                        currentStatus={selectedProject.status}
                        balanceHours={selectedProject.balanceHours}
                        onStatusChange={(newStatus) => {
                          // Update the project in the list
                          setProjects(prev => prev.map(p => 
                            p._id === selectedProject._id ? {...p, status: newStatus} : p
                          ));
                          // Update the selected project
                          setSelectedProject(prev => ({...prev, status: newStatus}));
                          alert(`Project status updated to ${newStatus}`);
                        }}
                      />

                      {/* ADD BALANCE DISPLAY */}
                      <BalanceDisplay 
                        totalEstimatedHours={selectedProject.totalEstimatedHours || 0}
                        consumedHours={selectedProject.consumedHours || 0}
                        balanceHours={selectedProject.balanceHours || 0}
                        consumptionByRole={selectedProject.consumptionByRole || []}
                      />

                      {/* ADD BALANCE REFRESH BUTTON */}
                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => refreshProjectBalance(selectedProject._id)}
                          className="outline-btn"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                          🔄 Refresh Balance
                        </button>
                      </div>

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
                      </div>


                      <form
                        className="form-grid"
                        onSubmit={(e) => {
                          handleSubmitTask(e);
                        }}
                      >
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
                          Role for Task
                          <select
                            value={assignRole}
                            onChange={(e) => setAssignRole(e.target.value)}
                          >
                            {PROJECT_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
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
                            {filteredProjectTasks.map((t, index) => {

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
                                  <td>{index + 1}</td> {/* Added S.No */}

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
                                      disabled={!canManagerEditTask(t)}
                                      onChange={(e) => {
                                        if (!canManagerEditTask(t)) return;
                                        updateTaskStatus(t._id, e.target.value);
                                      }}
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
                                      disabled={!canManagerEditTask(t)}
                                      onChange={(e) => {
                                        if (!canManagerEditTask(t)) return;
                                        updateTaskField(t._id, { scope: e.target.value });
                                      }}
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
                                  <td>
                                    {t.createdByUserId?.fullName || t.createdBy || "-"}
                                  </td>
                            
                                  <td>
                                    <button
                                      className="link-btn"
                                      type="button"
                                      disabled={!canManagerEditTask(t)}
                                      onClick={() => {
                                        if (!canManagerEditTask(t)) return;
                                        startEditTask(t);
                                      }}
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
logout events and key operations performed by HR /
Employees / Admin.

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
                        No logs available for the selected filters.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* ========== DASHBOARD TAB ========== */}
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
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Status</th> {/* ADD THIS */}
                          <th>Duration</th>
                          <th>Total Hours</th>
                          <th>Employees</th>
                          <th>Worked (hrs)</th>
                          <th>Balance (hrs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => {
                          const totals = projectTotals[p._id] || {
                            used: 0,
                            remaining: p.totalEstimatedHours || 0
                          };
                          return (
                            <tr key={p._id}>
                              <td>{p.name}</td>
                              <td>{p.code || "-"}</td>
                              <td>{p.startDate || "-"}</td>
                              <td>{p.endDate || "-"}</td>
                              <td><ProjectStatusBadge status={p.status} /></td>
                              <td>{p.durationMonths || 0} mo</td>
                              <td>{p.totalEstimatedHours || 0}</td>
                              <td>{p.assignments?.length || 0}</td>
                              <td>{totals.used}</td>
                              <td>{p.balanceHours ?? 0}</td>
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
                  </p>
                </div>
              </section>
            </main>
          )}

          {/* ========== BIRTHDAYS TAB ========== */}
          {activeTab === "birthdays" && (
            <main className="layout single-column">
              <section className="full-width">
                {/* Birthday Recording Form */}
                <div className="card">
                  <h2>Record Employee Birthday</h2>
                  {birthdaysLoading && <p className="note">Loading birthdays...</p>}
                  <form className="form-grid" onSubmit={handleCreateBirthday}>
                    <label>
                      Select Employee
                      <select
                        value={birthdayForm.employeeId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const selectedEmp = employees.find(emp => emp._id === selectedId);
                          setBirthdayForm({
                            ...birthdayForm,
                            employeeId: selectedId,
                            note: selectedEmp ? `Birthday of ${selectedEmp.fullName}` : ""
                          });
                        }}
                        disabled={creatingBirthday}
                      >
                        <option value="">-- Select Employee --</option>
                        {employeesWithoutBirthdays.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.fullName} ({emp.email}) - {emp.employeeId || "No ID"}
                          </option>
                        ))}
                      </select>
                      <small style={{ fontSize: 11, color: '#aaa', display: 'block', marginTop: 4 }}>
                        Only shows employees without birthday records ({employeesWithoutBirthdays.length} available)
                      </small>
                    </label>

                    <label>
                      Birth Month
                      <select
                        value={birthdayForm.month}
                        onChange={(e) => setBirthdayForm({
                          ...birthdayForm,
                          month: e.target.value
                        })}
                        disabled={creatingBirthday}
                      >
                        <option value="">-- Select Month --</option>
                        {BIRTHDAY_MONTHS.map((monthName) => (
                          <option key={monthName} value={monthName}>
                            {monthName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Birth Day
                      <select
                        value={birthdayForm.day}
                        onChange={(e) => setBirthdayForm({
                          ...birthdayForm,
                          day: Number(e.target.value)
                        })}
                        disabled={creatingBirthday}
                      >
                        <option value="">-- Select Day --</option>
                        {BIRTHDAY_DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Year (Optional)
                      <input
                        type="number"
                        value={birthdayForm.year}
                        onChange={(e) => setBirthdayForm({
                          ...birthdayForm,
                          year: Number(e.target.value)
                        })}
                        min="1900"
                        max={new Date().getFullYear()}
                        placeholder="e.g., 1990"
                        disabled={creatingBirthday}
                      />
                    </label>

                    <label className="full-row">
                      Notes (Optional)
                      <textarea
                        rows={2}
                        value={birthdayForm.note}
                        onChange={(e) => setBirthdayForm({
                          ...birthdayForm,
                          note: e.target.value
                        })}
                        placeholder="Add any special notes about birthday..."
                        disabled={creatingBirthday}
                      />
                    </label>

                    <div className="full-row">
                      <button
                        type="submit"
                        className="primary-btn"
                        disabled={creatingBirthday || !birthdayForm.employeeId || !birthdayForm.month || !birthdayForm.day}
                      >
                        {creatingBirthday ? "Saving..." : "Save Birthday"}
                      </button>
                    </div>
                  </form>
                  <p className="note">
                    <strong>Debug Info:</strong> Check browser console (F12) for detailed state updates and API responses.
                  </p>
                </div>

                {/* Upcoming Birthdays (7 days ahead) */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>Upcoming Birthdays (Next 7 Days)</h2>
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() => {
                        loadBirthdays();
                        alert("Upcoming birthdays refreshed");
                      }}
                      disabled={birthdaysLoading}
                    >
                      {birthdaysLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  {birthdaysLoading ? (
                    <p className="note">Loading upcoming birthdays...</p>
                  ) : upcomingBirthdays.length > 0 ? (
                    <div className="table-wrapper small-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Employee ID</th>
                            <th>Email</th>
                            <th>Birthday</th>
                            <th>Days Until</th>
                            <th>Wish Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingBirthdays.map((b) => {
                            const emp = employees.find(e => e._id === b.employeeId);
                            const birthdayDate = new Date(
                              new Date().getFullYear(),
                              BIRTHDAY_MONTHS.indexOf(b.month),
                              b.day
                            );
                            const formattedDate = `${b.day} ${b.month} ${birthdayDate.getFullYear()}`;

                            return (
                              <tr key={b._id}>
                                <td>{emp?.fullName || "Unknown"}</td>
                                <td>{emp?.employeeId || "N/A"}</td>
                                <td>{emp?.email || "N/A"}</td>
                                <td>{formattedDate}</td>
                                <td>
                                  <span className={`status-badge ${b.daysUntil === 0 ? 'active' : b.daysUntil <= 3 ? 'warning' : 'info'}`}>
                                    {b.daysUntil === 0 ? "Today" : `${b.daysUntil} days`}
                                  </span>
                                </td>
                                <td>
                                  {b.wished ? (
                                    <span className="status-badge success">
                                      Wished on {new Date(b.wishedAt).toLocaleDateString()}
                                    </span>
                                  ) : (
                                    <span className="status-badge warning">
                                      Not Wished
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {!b.wished ? (
                                    <button
                                      className="link-btn"
                                      type="button"
                                      onClick={() => sendBirthdayWish(b._id)}
                                      disabled={b.daysUntil > 3}
                                    >
                                      Send Wish
                                    </button>
                                  ) : (
                                    <button
                                      className="link-btn"
                                      type="button"
                                      onClick={() => sendBirthdayWish(b._id)}
                                    >
                                      Resend
                                    </button>
                                  )}
                                  {" "}
                                  <button
                                    className="link-btn danger"
                                    type="button"
                                    onClick={() => handleDeleteBirthday(b._id)}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty">No upcoming birthdays in the next 7 days.</p>
                  )}

                  <p className="note" style={{ marginTop: 8 }}>
                    <strong>Note:</strong> Birthdays are automatically reminded 3 days in advance.
                    The system will automatically send birthday wishes on the birthday date.
                  </p>
                </div>

                {/* All Birthdays List */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>All Employee Birthdays ({birthdays.length} records)</h2>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="month-selector"
                        disabled={birthdaysLoading}
                      >
                        <option value="">All Months</option>
                        {BIRTHDAY_MONTHS.map((monthName) => (
                          <option key={monthName} value={monthName}>
                            {monthName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() => {
                          loadBirthdays();
                          alert("Birthday list refreshed");
                        }}
                        style={{ fontSize: 12 }}
                        disabled={birthdaysLoading}
                      >
                        {birthdaysLoading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
                  </div>

                  {birthdaysLoading ? (
                    <p className="note">Loading all birthdays...</p>
                  ) : (
                    <>
                      <div className="table-wrapper small-table">
                        <table>
                          <thead>
                            <tr>
                              <th>S.No</th>
                              <th>Employee</th>
                              <th>Employee ID</th>
                              <th>Email</th>
                              <th>Birthday</th>
                              <th>Year</th>
                              <th>Wish Status</th>
                              <th>Last Wished</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBirthdays.map((b, index) => {
                              const emp = employees.find(e => e._id === b.employeeId);
                              return (
                                <tr key={b._id}>
                                  <td>{index + 1}</td>
                                  <td>{emp?.fullName || "Unknown"}</td>
                                  <td>{emp?.employeeId || "N/A"}</td>
                                  <td>{emp?.email || "N/A"}</td>
                                  <td>
                                    <strong>{b.day} {b.month}</strong>
                                  </td>
                                  <td>{b.year || "N/A"}</td>
                                  <td>
                                    {b.wished ? (
                                      <span className="status-badge success">Wished</span>
                                    ) : (
                                      <span className="status-badge warning">Pending</span>
                                    )}
                                  </td>
                                  <td>
                                    {b.wishedAt ? (
                                      new Date(b.wishedAt).toLocaleDateString()
                                    ) : (
                                      "Never"
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      className="link-btn"
                                      type="button"
                                      onClick={() => sendBirthdayWish(b._id)}
                                    >
                                      {b.wished ? "Resend" : "Send"}
                                    </button>
                                    {" "}
                                    <button
                                      className="link-btn danger"
                                      type="button"
                                      onClick={() => handleDeleteBirthday(b._id)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {filteredBirthdays.length === 0 && (
                          <p className="empty">
                            {filterMonth ? `No birthdays in ${filterMonth}` : "No birthdays recorded yet"}
                          </p>
                        )}
                      </div>
                      <p className="note">
                        Showing {filteredBirthdays.length} of {birthdays.length} total birthday records.
                        {filterMonth && ` Filtered by month: ${filterMonth}`}
                      </p>
                    </>
                  )}
                </div>

                {/* Birthday Statistics */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>Birthday Statistics</h2>
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() => {
                        loadBirthdays();
                        loadEmployees();
                        alert("Birthday statistics refreshed");
                      }}
                      style={{ fontSize: 12 }}
                      disabled={birthdaysLoading}
                    >
                      {birthdaysLoading ? "Refreshing..." : "Refresh Stats"}
                    </button>
                  </div>

                  {birthdaysLoading ? (
                    <p className="note">Loading statistics...</p>
                  ) : (
                    <>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 12,
                        fontSize: 13
                      }}>
                        <div className="mini-kpi">
                          <strong>Total Records</strong>
                          <div>{birthdayStats.totalRecords}</div>
                        </div>
                        <div className="mini-kpi">
                          <strong>Without Records</strong>
                          <div>{birthdayStats.withoutRecords}</div>
                        </div>
                        <div className="mini-kpi">
                          <strong>Wished This Year</strong>
                          <div>{birthdayStats.wishedThisYear}</div>
                        </div>
                        <div className="mini-kpi">
                          <strong>Upcoming (7 days)</strong>
                          <div>{birthdayStats.upcoming7Days}</div>
                        </div>
                      </div>

                      <p className="note" style={{ marginTop: 8 }}>
                        <strong>Auto-Wish Feature:</strong> The system automatically sends birthday wishes
                        to employees on their birthday date. HR will receive notifications 3 days in advance.

                        <br />
                        <strong>Debug Info:</strong> Check browser console (F12) for detailed state updates and API responses.
                      </p>
                    </>
                  )}
                </div>
              </section>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}