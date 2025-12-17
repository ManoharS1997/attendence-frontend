// src/pages/EmployeeDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import logo from "../assets/Company Logo.png";
import { buildHolidayCalendar } from "../utils/holidays";

const STATUS_OPTIONS = [
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

const HALF_DAY_STATUSES = [
  "PRESENT HALF DAY",
  "Half Day - Fun Thursday",
  "Half Day - Development"
];

const APPROVAL_STATUSES = [
  "PRESENT HALF DAY",
  "Half Day - Fun Thursday",
  "Half Day - Development",
  "EMERGENCY LEAVE",
  "CASUAL LEAVE",
  "COMPOFF",
  "ABSENT"
];

const priorityColors = {
  P1: { color: "#ff4d4f", label: "P1 - Critical" },
  P2: { color: "#fa8c16", label: "P2 - Highest" },
  P3: { color: "#1890ff", label: "P3 - Medium" },
  P4: { color: "#52c41a", label: "P4 - Low" }
};

// Default task hours per priority (you can adjust these values)
const PRIORITY_DEFAULT_HOURS = {
  P1: 16,
  P2: 12,
  P3: 8,
  P4: 4
};

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

const diffHours = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
};

const diffDays = (start, end) => {
  if (!start || !end) return 0;
  const [sd, sm, sy] = start.split("-").map(Number);
  const [ed, em, ey] = end.split("-").map(Number);
  if ([sd, sm, sy, ed, em, ey].some((n) => Number.isNaN(n))) return 0;
  const sDate = new Date(sy, sm - 1, sd);
  const eDate = new Date(ey, em - 1, ed);
  const ms = eDate - sDate;
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
};

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

const buildMonthMatrix = (month, year) => {
  const y = Number(year);
  const m = Number(month);
  const first = new Date(y, m - 1, 1);
  const firstWeekday = first.getDay();
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

const computeWorkingDaysExcludingHolidays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  if (diffDays(startStr, endStr) <= 0) return 0;

  const [sd, sm, sy] = startStr.split("-").map(Number);
  const [ed, em, ey] = endStr.split("-").map(Number);
  if ([sd, sm, sy, ed, em, ey].some((n) => Number.isNaN(n))) return 0;

  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
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

    const weekday = date.getDay();
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

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [{ month, year }, setMonthYear] = useState(getCurrentMonth);

  const [date, setDate] = useState(formatToday());
  const [status, setStatus] = useState("PRESENT FULL DAY");
  const [workInTime, setWorkInTime] = useState("10:00");
  const [workOutTime, setWorkOutTime] = useState("18:00");
  const [note, setNote] = useState("");

  const [extraWork, setExtraWork] = useState({
    hours: 2,
    workedDate: "",
    workedTime: "18:00",
    compOffDate: "",
    compOffTime: "10:00"
  });

  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingSave, setLoadingSave] = useState(false);

  const [lastAlertAttendanceId, setLastAlertAttendanceId] = useState(null);

  const [taskForm, setTaskForm] = useState({
    projectId: "",
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
    hoursAllocated: PRIORITY_DEFAULT_HOURS.P3
  });
  const [editingTaskId, setEditingTaskId] = useState(null);

  const loadAttendance = useCallback(async () => {
    const res = await api.get("/attendance/my", { params: { month, year } });
    setAttendance(res.data || []);
  }, [month, year]);

  const loadSummary = useCallback(async () => {
    const res = await api.get("/leave/summary/me", { params: { month, year } });
    setSummary(res.data || null);
  }, [month, year]);

  const loadProjects = useCallback(async () => {
    const res = await api.get("/projects/my");
    setProjects(res.data || []);
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get("/tasks/my");
      console.log("Employee /tasks/my result:", res.data);
      setTasks(res.data || []);
    } catch (err) {
      console.error("Error loading my tasks", err?.response || err);
      alert(
        err?.response?.data?.message ||
          "Error loading tasks. Please ensure backend GET /tasks/my allows employee role and returns assigned/created tasks."
      );
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      loadAttendance();
      loadSummary();
    }, 0);
    return () => clearTimeout(id);
  }, [loadAttendance, loadSummary]);

  useEffect(() => {
    const id = setInterval(() => {
      loadAttendance();
    }, 30000);
    return () => clearInterval(id);
  }, [loadAttendance]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadProjects();
      loadTasks();
    }, 0);
    return () => clearTimeout(id);
  }, [loadProjects, loadTasks]);

  useEffect(() => {
    if (!attendance || attendance.length === 0) return;

    const decided = attendance
      .filter(
        (a) =>
          a.managerDecision &&
          (a.managerDecision.status === "APPROVED" ||
            a.managerDecision.status === "REJECTED")
      )
      .sort((a, b) => {
        const ta =
          a.managerDecision.decidedAt ||
          a.updatedAt ||
          `${a.date.split("-").reverse().join("-")}T00:00:00Z`;
        const tb =
          b.managerDecision.decidedAt ||
          b.updatedAt ||
          `${b.date.split("-").reverse().join("-")}T00:00:00Z`;
        return new Date(tb) - new Date(ta);
      });

    if (decided.length === 0) return;

    const latest = decided[0];
    if (!latest._id || latest._id === lastAlertAttendanceId) return;

    const decision = latest.managerDecision.status;
    const label =
      latest.status === "COMPOFF"
        ? "Comp-off request"
        : latest.status || "attendance request";

    const message =
      decision === "APPROVED"
        ? `Your ${label} for ${latest.date} was APPROVED by Manager.`
        : `Your ${label} for ${latest.date} was REJECTED by Manager.`;

    try {
      window.alert(message);
    } catch (err) {
      console.error("Error showing employee alert popup:", err);
    }

    setLastAlertAttendanceId(latest._id);
  }, [attendance, lastAlertAttendanceId]);

  const metrics = (() => {
    let presentDays = 0;
    let halfDays = 0;
    let leavesTaken = 0;
    let hoursWorked = 0;
    let pendingRequests = 0;

    attendance.forEach((a) => {
      if (a.status === "PRESENT FULL DAY") presentDays += 1;
      if (HALF_DAY_STATUSES.includes(a.status)) {
        halfDays += 1;
      }
      if (a.status === "EMERGENCY LEAVE" || a.status === "CASUAL LEAVE") {
        leavesTaken += 1;
      }
      if (a.managerDecision?.status === "PENDING" && a.isLeaveRequest) {
        pendingRequests += 1;
      }

      const isPresentLike =
        a.status === "PRESENT FULL DAY" || HALF_DAY_STATUSES.includes(a.status);
      const factor = HALF_DAY_STATUSES.includes(a.status) ? 0.5 : 1;
      const baseHours = diffHours(a.workInTime, a.workOutTime);
      const effective = isPresentLike ? baseHours * factor : 0;

      hoursWorked += effective;
    });

    hoursWorked = Math.round(hoursWorked * 10) / 10;

    return { presentDays, halfDays, leavesTaken, hoursWorked, pendingRequests };
  })();

  const holidays = buildHolidayCalendar(month, year);
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
    const taken =
      h.taken === "TAKEN" ||
      h.takenStatus === "TAKEN" ||
      h.defaultTaken
        ? "TAKEN"
        : "NOT_TAKEN";
    return sum + (taken === "TAKEN" ? 1 : 0);
  }, 0);

  const totalPublicForMonth = mandatoryPublicCount + optionalTakenCount;

  const selectedHolidayInfo = (() => {
    if (!date) return null;
    const parts = date.split("-");
    if (parts.length !== 3) return null;
    const [ddStr, mmStr, yyyyStr] = parts;
    const dd = Number(ddStr);
    const mm = Number(mmStr);
    const yyyy = Number(yyyyStr);
    if ([dd, mm, yyyy].some((n) => Number.isNaN(n))) return null;

    const dateKey = `${yyyyStr}-${mmStr}-${ddStr}`;
    const dObj = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(dObj.getTime())) return null;

    const weekday = dObj.getDay();
    const weekIndex = Math.floor((dObj.getDate() - 1) / 7);
    const isSunday = weekday === 0;
    const isSecondSaturday = weekday === 6 && weekIndex === 1;

    const h = holidayByDateKey[dateKey];
    const isMandatory =
      h &&
      (h.type === "MANDATORY_PUBLIC" || h.isMandatory || h.kind === "MANDATORY");
    const isOptional =
      h &&
      (h.type === "OPTIONAL_PUBLIC" || h.isOptional || h.kind === "OPTIONAL");

    const taken =
      h &&
      (h.taken === "TAKEN" || h.takenStatus === "TAKEN" || h.defaultTaken)
        ? "TAKEN"
        : "NOT_TAKEN";

    const isOptionalEffectiveHoliday = isOptional && taken === "TAKEN";

    const isSystemHoliday =
      isMandatory || isOptionalEffectiveHoliday || isSunday || isSecondSaturday;

    if (!isSystemHoliday) {
      return {
        isSystemHoliday: false,
        isSunday,
        isSecondSaturday,
        isMandatoryPublic: !!isMandatory,
        isOptionalPublic: !!isOptional,
        taken,
        holidayName: h?.name || "",
        effectiveStatus: null,
        dateLabel: date,
        dateKey
      };
    }

    let effectiveStatus = "PUBLIC HOLIDAY";
    let title = "";
    let message = "";
    let label = "";

    if (isMandatory || isOptionalEffectiveHoliday) {
      effectiveStatus = "PUBLIC HOLIDAY";
      const name = h?.name || "Public Holiday";
      label = name;
      title = `Today is a Public Holiday`;
      message = `${date} is configured as "${name}". Attendance marking is disabled. Enjoy your holiday as per company policy.`;
    } else if (isSunday) {
      effectiveStatus = "SUNDAY";
      label = "Sunday (Weekly Off)";
      title = "Today is Sunday (Weekly Off)";
      message = `${date} is a weekly off (Sunday). Attendance marking is disabled. If you have worked today, please record your extra work details when applying for a future Comp-off.`;
    } else if (isSecondSaturday) {
      effectiveStatus = "2ND SATURDAY";
      label = "2nd Saturday (Weekly Off)";
      title = "Today is 2nd Saturday (Weekly Off)";
      message = `${date} is a weekly off (2nd Saturday). Attendance marking is disabled. If you have worked today, please discuss Comp-off eligibility with your Manager.`;
    }

    return {
      isSystemHoliday,
      isSunday,
      isSecondSaturday,
      isMandatoryPublic: !!isMandatory,
      isOptionalPublic: !!isOptional,
      taken,
      holidayName: h?.name || "",
      effectiveStatus,
      title,
      message,
      label,
      dateLabel: date,
      dateKey
    };
  })();

  const systemHolidayStatus = selectedHolidayInfo?.effectiveStatus || null;
  const isSystemHoliday = !!selectedHolidayInfo?.isSystemHoliday;

  useEffect(() => {
    if (!systemHolidayStatus) return;
    const id = setTimeout(() => {
      setStatus(systemHolidayStatus);
      setWorkInTime("");
      setWorkOutTime("");
      setNote("");
    }, 0);
    return () => clearTimeout(id);
  }, [systemHolidayStatus, date]);

  const holidayBanner =
    selectedHolidayInfo && selectedHolidayInfo.isSystemHoliday ? (
      <div
        className="holiday-banner"
        style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 8,
          background:
            "linear-gradient(90deg, rgba(0,21,41,0.98), rgba(24,144,255,0.85))",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)"
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            opacity: 0.85,
            marginBottom: 4
          }}
        >
          System Holiday • {selectedHolidayInfo.dateLabel} •{" "}
          {selectedHolidayInfo.label ||
            selectedHolidayInfo.holidayName ||
            "Weekly Off"}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
          {selectedHolidayInfo.title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.95 }}>
          {selectedHolidayInfo.message}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            opacity: 0.9,
            fontStyle: "italic"
          }}
        >
          Attendance fields are locked for this date to maintain policy
          compliance. Comp-off requests (if applicable) must include worked
          date, hours and compensatory off date.
        </div>
      </div>
    ) : null;

  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    try {
      setLoadingSave(true);

      if (isSystemHoliday) {
        alert(
          "This date is configured as a system holiday (Sunday / 2nd Saturday / Public Holiday). Attendance marking is disabled."
        );
        setLoadingSave(false);
        return;
      }

      const payload = {
        date,
        status,
        workInTime,
        workOutTime,
        note
      };

      if (status === "COMPOFF") {
        const {
          hours,
          workedDate,
          workedTime,
          compOffDate,
          compOffTime
        } = extraWork;

        if (
          !hours ||
          Number(hours) <= 0 ||
          !workedDate ||
          !workedTime ||
          !compOffDate ||
          !compOffTime
        ) {
          setLoadingSave(false);
          alert(
            "For Comp-off requests, please enter:\n\n• Extra work hours\n• Worked date and time (for example, the Sunday you worked)\n• Comp-off date and time (when you plan to take the compensatory off)"
          );
          return;
        }

        payload.isLeaveRequest = true;
        payload.extraWork = {
          hours: Number(hours),
          workedDate,
          workedTime,
          compOffDate: compOffDate || date,
          compOffTime
        };
      }

      await api.post("/attendance", payload);

      if (APPROVAL_STATUSES.includes(status)) {
        alert(
          "Attendance / leave change sent to Manager for approval. It will reflect in your dashboard and project views after Manager approval."
        );
      } else {
        alert("Attendance saved");
      }

      await loadAttendance();
      await loadSummary();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error saving attendance");
    } finally {
      setLoadingSave(false);
    }
  };

  const handleMonthChange = (e) => {
    const [m, y] = e.target.value.split("-");
    setMonthYear({ month: m, year: y });
    setLastAlertAttendanceId(null);
  };

  const monthLabel = `${monthNames[Number(month) - 1]}, ${year}`;

  const timesheetRows = attendance.map((a) => {
    const isPresentLike =
      a.status === "PRESENT FULL DAY" || HALF_DAY_STATUSES.includes(a.status);
    const factor = HALF_DAY_STATUSES.includes(a.status) ? 0.5 : 1;
    const baseHours = diffHours(a.workInTime, a.workOutTime);
    const workedHours = isPresentLike ? baseHours * factor : 0;

    return {
      ...a,
      workedHours
    };
  });

  const totalTimesheetHours = timesheetRows.reduce(
    (sum, r) => sum + r.workedHours,
    0
  );

  const taskHoursByProject = tasks.reduce((acc, t) => {
    const pid = t.project?._id || t.projectId;
    if (!pid) return acc;
    acc[pid] = (acc[pid] || 0) + (t.hoursAllocated || 0);
    return acc;
  }, {});

  const resetTaskForm = (keepProjectId = false) => {
    setEditingTaskId(null);
    setTaskForm((prev) => ({
      projectId: keepProjectId ? prev.projectId : "",
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
      hoursAllocated: PRIORITY_DEFAULT_HOURS.P3
    }));
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();

    if (!taskForm.projectId) {
      alert("Please select a project");
      return;
    }

    const finalDays = taskForm.noOfDays || 0;

    try {
      const payload = {
        ...taskForm,
        projectId: taskForm.projectId,
        noOfDays: finalDays,
        hoursAllocated: Number(taskForm.hoursAllocated) || 0,
        assignedUserId: user._id || user.id,
        createdBy: user.fullName || user.email
      };

      if (
        !payload.recentRequirement ||
        !payload.recentRequirement.trim().length
      ) {
        payload.recentRequirement = "Requirement not specified";
      }

      if (!editingTaskId) {
        await api.post("/tasks", payload);
        alert("Task / requirement added");
      } else {
        await api.patch(`/tasks/${editingTaskId}`, payload);
        alert("Task updated");
      }

      resetTaskForm(true);
      loadTasks();
    } catch (err) {
      console.error("Employee create/update task error", err?.response || err);
      alert(err.response?.data?.message || "Error saving task");
    }
  };

  const startEditTask = (t) => {
    const createdByMe =
      t.createdBy === (user.fullName || "") || t.createdBy === user.email;
    if (!createdByMe) return;

    setEditingTaskId(t._id);
    setTaskForm({
      projectId: t.project?._id || t.projectId || "",
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
      hoursAllocated:
        t.hoursAllocated ||
        PRIORITY_DEFAULT_HOURS[t.clientPriority || "P3"] ||
        PRIORITY_DEFAULT_HOURS.P3
    });
  };

  const monthSelect = (
    <select value={`${month}-${year}`} onChange={handleMonthChange}>
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
  );

  return (
    <div className="page">
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src={logo} alt="NowIT Services" />
            </div>
            <div className="sidebar-role">Employee</div>
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
          </nav>
        </aside>

        <div className="main-area">
          <header className="topbar">
            <div>
              <strong>{user.fullName}</strong> (Employee) — {user.email}
            </div>
            <button onClick={logout} className="outline-btn">
              Logout
            </button>
          </header>

          {/* TIMESHEET TAB */}
          {activeTab === "timesheet" && (
            <main className="layout">
              <section className="left-column">
                {holidayBanner}

                <div className="card mark-card">
                  <h2>Mark Attendance</h2>
                  <p className="note" style={{ marginBottom: 8, fontSize: 11 }}>
                    Please record your attendance for working days only.
                    Sundays, 2nd Saturdays and configured Public Holidays are
                    treated as system holidays and cannot be edited.
                  </p>
                  <form className="form-grid" onSubmit={handleSaveAttendance}>
                    <label>
                      Date
                      <input
                        type="text"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder="dd-mm-yyyy"
                      />
                    </label>

                    <label>
                      Status
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={isSystemHoliday}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="badge-row">
                      <span className="status-badge">{status}</span>
                      {isSystemHoliday && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.4)",
                            opacity: 0.9
                          }}
                        >
                          System Holiday — Attendance Locked
                        </span>
                      )}
                    </div>

                    <label>
                      Work In Time
                      <input
                        type="time"
                        value={workInTime}
                        onChange={(e) => setWorkInTime(e.target.value)}
                        disabled={isSystemHoliday}
                      />
                    </label>

                    <label>
                      Work Out Time
                      <input
                        type="time"
                        value={workOutTime}
                        onChange={(e) => setWorkOutTime(e.target.value)}
                        disabled={isSystemHoliday}
                      />
                    </label>

                    <label className="full-row">
                      Note (optional)
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Emergency, client visit, etc."
                        disabled={isSystemHoliday}
                      />
                    </label>

                    {status === "COMPOFF" && (
                      <div className="full-row">
                        <div className="compoff-box">
                          <div className="compoff-hint">
                            Extra work details (mandatory for Comp-off request):
                          </div>
                          <div className="compoff-grid">
                            <label>
                              Extra Hours
                              <input
                                type="number"
                                value={extraWork.hours}
                                onChange={(e) =>
                                  setExtraWork({
                                    ...extraWork,
                                    hours: Number(e.target.value)
                                  })
                                }
                              />
                            </label>
                            <label>
                              Worked Date (e.g. Sunday)
                              <input
                                type="text"
                                placeholder="dd-mm-yyyy"
                                value={extraWork.workedDate}
                                onChange={(e) =>
                                  setExtraWork({
                                    ...extraWork,
                                    workedDate: e.target.value
                                  })
                                }
                              />
                            </label>
                            <label>
                              Worked Time
                              <input
                                type="time"
                                value={extraWork.workedTime}
                                onChange={(e) =>
                                  setExtraWork({
                                    ...extraWork,
                                    workedTime: e.target.value
                                  })
                                }
                              />
                            </label>
                            <label>
                              Comp-off Date
                              <input
                                type="text"
                                placeholder="dd-mm-yyyy"
                                value={extraWork.compOffDate}
                                onChange={(e) =>
                                  setExtraWork({
                                    ...extraWork,
                                    compOffDate: e.target.value
                                  })
                                }
                              />
                            </label>
                            <label>
                              Comp-off Time
                              <input
                                type="time"
                                value={extraWork.compOffTime}
                                onChange={(e) =>
                                  setExtraWork({
                                    ...extraWork,
                                    compOffTime: e.target.value
                                  })
                                }
                              />
                            </label>
                          </div>
                          <p className="note" style={{ marginTop: 4 }}>
                            Example: You worked on Sunday (07-12-2025) for 6
                            hours. When applying Comp-off for a working day,
                            mention the Sunday date &amp; hours here and the
                            corresponding Comp-off date/time.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="full-row">
                      <button
                        type="submit"
                        className="primary-btn"
                        disabled={loadingSave || isSystemHoliday}
                      >
                        {isSystemHoliday
                          ? "Attendance Locked for Holiday"
                          : loadingSave
                          ? "Saving..."
                          : "Save Attendance"}
                      </button>
                    </div>
                  </form>
                </div>

                <ChangePasswordCard />
              </section>

              <section className="right-column">
                <div className="card">
                  <div className="card-header-row">
                    <h2>My Dashboard – {monthLabel}</h2>
                    {monthSelect}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: 12,
                      fontSize: 13
                    }}
                  >
                    <div className="mini-kpi">
                      <strong>Present Days</strong>
                      <div>{metrics.presentDays}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Half Days</strong>
                      <div>{metrics.halfDays}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Leaves Taken</strong>
                      <div>{metrics.leavesTaken}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Hours Worked</strong>
                      <div>{metrics.hoursWorked}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Pending Requests</strong>
                      <div>{metrics.pendingRequests}</div>
                    </div>
                  </div>
                </div>

                <div className="card leave-card">
                  <h2>Leave Summary</h2>
                  {summary ? (
                    <>
                      <ul className="summary-list">
                        <li>
                          <span>Total Leave Entitlement:</span>
                          <span>{summary.totalLeaveEntitlement}</span>
                        </li>
                        <li>
                          <span>Public Holidays:</span>
                          <span>{summary.publicHolidays}</span>
                        </li>
                        <li>
                          <span>Weekend Holidays:</span>
                          <span>{summary.weekendHolidays}</span>
                        </li>
                        <li>
                          <span>2025 Carry Forward Leaves:</span>
                          <span>{summary.carryForward2025}</span>
                        </li>
                        <li>
                          <span>Leaves Taken:</span>
                          <span>{summary.leavesTaken}</span>
                        </li>
                        <li>
                          <span>Balance Leaves:</span>
                          <span>{summary.balanceLeaves}</span>
                        </li>
                        <li>
                          <span>Total Half Days:</span>
                          <span>{summary.totalHalfDays}</span>
                        </li>
                        <li>
                          <span>Balance Leaves After Half Days:</span>
                          <span>{summary.balanceAfterHalfDays}</span>
                        </li>
                      </ul>
                      <p className="note">
                        * These values are read-only; only Manager can update
                        them in the system.
                      </p>
                    </>
                  ) : (
                    <p className="empty">No summary yet for {monthLabel}</p>
                  )}
                </div>

                <div className="card">
                  <h2>Public Holidays – {monthLabel}</h2>

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

                                const weekday = date.getDay();
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

                                const taken =
                                  h &&
                                  (h.taken === "TAKEN" ||
                                    h.takenStatus === "TAKEN" ||
                                    h.defaultTaken)
                                    ? "TAKEN"
                                    : "NOT_TAKEN";

                                let bg = "transparent";
                                let border =
                                  "1px solid rgba(255,255,255,0.15)";
                                let color = "#fff";

                                if (isMandatory) {
                                  bg = "#ff7875";
                                } else if (isOptional) {
                                  bg =
                                    taken === "TAKEN"
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

                    <div style={{ flex: "1 1 260px" }}>
                      <div
                        className="table-wrapper small-table"
                        style={{ maxHeight: 220, overflowY: "auto" }}
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
                                h.taken === "TAKEN" ||
                                h.takenStatus === "TAKEN" ||
                                h.defaultTaken
                                  ? "TAKEN"
                                  : "NOT_TAKEN";

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
                                    {isMandatory
                                      ? "Mandatory"
                                      : taken === "TAKEN"
                                      ? "Taken (Optional)"
                                      : "Not Taken"}
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
                      <p className="note">
                        Optional holidays and their Taken / Not Taken status are
                        decided by the Manager. This section is read-only.
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

                <div className="card">
                  <h2>My Attendance (This Month)</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
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
                            <td>{a.status}</td>
                            <td>{a.workInTime}</td>
                            <td>{a.workOutTime}</td>
                            <td>{a.managerDecision?.status || "-"}</td>
                            <td>
                              {a.status === "COMPOFF" && a.extraWork ? (
                                <>
                                  Extra: {a.extraWork.hours} hrs on{" "}
                                  {a.extraWork.workedDate}{" "}
                                  {a.extraWork.workedTime} → Comp-off{" "}
                                  {a.extraWork.compOffDate}{" "}
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
                      <p className="empty">No attendance yet</p>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header-row">
                    <h2>Timesheet – {monthLabel}</h2>
                    {monthSelect}
                  </div>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th>In</th>
                          <th>Out</th>
                          <th>Hours</th>
                          <th>Manager Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timesheetRows.map((r) => (
                          <tr key={r._id}>
                            <td>{r.date}</td>
                            <td>{r.status}</td>
                            <td>{r.workInTime}</td>
                            <td>{r.workOutTime}</td>
                            <td>{r.workedHours}</td>
                            <td>{r.managerDecision?.status || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {timesheetRows.length === 0 && (
                      <p className="empty">No entries for {monthLabel}</p>
                    )}
                  </div>
                  <p className="note">
                    Total hours (present days only):{" "}
                    <strong>{Math.round(totalTimesheetHours * 10) / 10}</strong>
                  </p>
                </div>
              </section>
            </main>
          )}

          {/* PROJECTS TAB */}
          {activeTab === "projects" && (
            <main className="layout single-column">
              <section className="full-width">
                <div className="card">
                  <h2>
                    {editingTaskId
                      ? "Update Task / Requirement"
                      : "Add Project Task / Requirement"}
                  </h2>
                  <form
                    className="form-grid"
                    onSubmit={handleCreateOrUpdateTask}
                  >
                    <label>
                      Project
                      <select
                        value={taskForm.projectId}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            projectId: e.target.value
                          })
                        }
                      >
                        <option value="">-- Select project --</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="full-row">
                      Requirement
                      <textarea
                        rows={3}
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
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="ON_HOLD_FROM_COMPANY">
                          ON_HOLD_FROM_COMPANY
                        </option>
                        <option value="ON_HOLD_FROM_CLIENT">
                          ON_HOLD_FROM_CLIENT
                        </option>
                        <option value="ON_HOLD">ON_HOLD</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
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
                          setTaskForm((prev) => {
                            const workingDays =
                              computeWorkingDaysExcludingHolidays(
                                value,
                                prev.estimatedDate
                              );
                            return {
                              ...prev,
                              originalClosureDate: value,
                              noOfDays: workingDays
                            };
                          });
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
                          setTaskForm((prev) => {
                            const workingDays =
                              computeWorkingDaysExcludingHolidays(
                                prev.originalClosureDate,
                                value
                              );
                            return {
                              ...prev,
                              estimatedDate: value,
                              noOfDays: workingDays
                            };
                          });
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
                        onChange={(e) => {
                          const value = e.target.value;
                          setTaskForm((prev) => ({
                            ...prev,
                            clientPriority: value,
                            hoursAllocated:
                              PRIORITY_DEFAULT_HOURS[value] ??
                              prev.hoursAllocated
                          }));
                        }}
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
                      Estimated Hours (for this task)
                      <input
                        type="number"
                        value={taskForm.hoursAllocated}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            hoursAllocated: Number(e.target.value)
                          })
                        }
                      />
                    </label>

                    <label>
                      Created By
                      <input
                        type="text"
                        value={user.fullName || user.email}
                        readOnly
                      />
                    </label>

                    <label className="full-row">
                      Notes
                      <textarea
                        rows={3}
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
                          ? "Update Task / Requirement"
                          : "Add Task / Requirement"}
                      </button>
                      {editingTaskId && (
                        <button
                          type="button"
                          className="outline-btn"
                          style={{ marginLeft: 8 }}
                          onClick={() => resetTaskForm(true)}
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="card">
                  <h2>My Projects &amp; Task Allocation</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Code</th>
                          <th>Description</th>
                          <th>Estimate (hrs)</th>
                          <th>Task Allocated (hrs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => (
                          <tr key={p._id}>
                            <td>{p.name}</td>
                            <td>{p.code || "-"}</td>
                            <td>{p.description || "-"}</td>
                            <td>{p.totalEstimatedHours || 355}</td>
                            <td>{taskHoursByProject[p._id] || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {projects.length === 0 && (
                      <p className="empty">
                        No projects assigned to you yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h2>My Tasks</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Project</th>
                          <th>Requirement</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Scope</th>
                          <th>Discussed</th>
                          <th>Start</th>
                          <th>Close</th>
                          <th>Working Days</th>
                          <th>Est. Hrs</th>
                          <th>Client Priority</th>
                          <th>Given By</th>
                          <th>Created By</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((t, index) => {
                          const meta = priorityColors[t.clientPriority] || null;
                          const givenBy =
                            (t.prioritySource || "")
                              .replace(/_/g, " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase()) || "-";

                          const createdByMe =
                            t.createdBy === (user.fullName || "") ||
                            t.createdBy === user.email;

                          return (
                            <tr key={t._id}>
                              <td>{index + 1}</td>
                              <td>{t.project?.name || "-"}</td>
                              <td
                                style={{
                                  maxWidth: 260,
                                  whiteSpace: "pre-wrap"
                                }}
                              >
                                {t.recentRequirement}
                              </td>
                              <td>{t.requirementType || "NEW"}</td>
                              <td>{t.status}</td>
                              <td>{t.scope || "-"}</td>
                              <td>{t.discussedDate || "-"}</td>
                              <td>{t.originalClosureDate || "-"}</td>
                              <td>{t.estimatedDate || "-"}</td>
                              <td>{t.noOfDays || 0}</td>
                              <td>{t.hoursAllocated || 0}</td>
                              <td>
                                {meta ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      backgroundColor: meta.color,
                                      color: "#fff"
                                    }}
                                  >
                                    {meta.label}
                                  </span>
                                ) : (
                                  t.clientPriority || "-"
                                )}
                              </td>
                              <td>{givenBy}</td>
                              <td>{t.createdBy || "-"}</td>
                              <td>
                                {createdByMe ? (
                                  <button
                                    type="button"
                                    className="link-btn"
                                    onClick={() => startEditTask(t)}
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {tasks.length === 0 && (
                      <p className="empty">
                        No tasks yet. Manager can allocate tasks to you, and you
                        can create your own above.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <main className="layout single-column">
              <section className="full-width">
                {holidayBanner}

                <div className="card">
                  <div className="card-header-row">
                    <h2>My Dashboard – {monthLabel}</h2>
                    {monthSelect}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: 12,
                      fontSize: 13
                    }}
                  >
                    <div className="mini-kpi">
                      <strong>Present Days</strong>
                      <div>{metrics.presentDays}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Half Days</strong>
                      <div>{metrics.halfDays}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Leaves Taken</strong>
                      <div>{metrics.leavesTaken}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Hours Worked</strong>
                      <div>{metrics.hoursWorked}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Pending Requests</strong>
                      <div>{metrics.pendingRequests}</div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h2>Attendance Report</h2>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th>In</th>
                          <th>Out</th>
                          <th>Hours</th>
                          <th>Manager Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timesheetRows.map((r) => (
                          <tr key={r._id}>
                            <td>{r.date}</td>
                            <td>{r.status}</td>
                            <td>{r.workInTime}</td>
                            <td>{r.workOutTime}</td>
                            <td>{r.workedHours}</td>
                            <td>{r.managerDecision?.status || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {timesheetRows.length === 0 && (
                      <p className="empty">No data for {monthLabel}</p>
                    )}
                  </div>
                </div>

                <div className="card leave-card">
                  <h2>Leave Summary</h2>
                  {summary ? (
                    <>
                      <ul className="summary-list">
                        <li>
                          <span>Total Leave Entitlement:</span>
                          <span>{summary.totalLeaveEntitlement}</span>
                        </li>
                        <li>
                          <span>Public Holidays:</span>
                          <span>{summary.publicHolidays}</span>
                        </li>
                        <li>
                          <span>Weekend Holidays:</span>
                          <span>{summary.weekendHolidays}</span>
                        </li>
                        <li>
                          <span>2025 Carry Forward Leaves:</span>
                          <span>{summary.carryForward2025}</span>
                        </li>
                        <li>
                          <span>Leaves Taken:</span>
                          <span>{summary.leavesTaken}</span>
                        </li>
                        <li>
                          <span>Balance Leaves:</span>
                          <span>{summary.balanceLeaves}</span>
                        </li>
                        <li>
                          <span>Total Half Days:</span>
                          <span>{summary.totalHalfDays}</span>
                        </li>
                        <li>
                          <span>Balance Leaves After Half Days:</span>
                          <span>{summary.balanceAfterHalfDays}</span>
                        </li>
                      </ul>
                      <p className="note">
                        This is a read-only report. Any change will be done by
                        the Manager from their dashboard.
                      </p>
                    </>
                  ) : (
                    <p className="empty">No summary for {monthLabel}</p>
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
