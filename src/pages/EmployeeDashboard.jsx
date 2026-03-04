import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import logo from "../assets/Company Logo.png";
import { buildHolidayCalendar } from "../utils/holidays";
import "../../styles/employeeDashboard.css";
import {
  FaEdit, FaCalendarAlt, FaBell, FaCheck, FaCheckCircle,
  FaTimes, FaExclamationCircle, FaInfoCircle, FaTrash,
  FaEye, FaEnvelope, FaFileExcel, FaDownload, FaClock,
} from "react-icons/fa";
import { io } from "socket.io-client";
import * as XLSX from 'xlsx';

// FIXED HELPER FUNCTION FOR PROJECT ROLE
const getMyRoleFromProject = (project, userId) => {
  if (!project?.assignments || !Array.isArray(project.assignments)) return null;

  const assignment = project.assignments.find(a => {
    const assignedUserId =
      a.user?._id ||
      a.userId ||
      a.user;

    return String(assignedUserId) === String(userId);
  });

  return assignment?.role || null;
};

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

const normalizeAttendanceStatus = (a) => {
  if (!a) return "-";
  if (a.status === "Half Day - Fun Thursday") return "Half Day (Fun Activity)";
  if (a.status === "Half Day - Development") return "Half Day (Development)";
  return a.status;
};

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

const PRIORITY_DEFAULT_HOURS = {
  P1: 16,
  P2: 12,
  P3: 8,
  P4: 4
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= currentYear - 5; i--) {
    years.push(i);
  }
  return years;
};

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

const getManagementBirthdayMessage = (name) => {
  const messages = [
    `Dear ${name}, on behalf of NOWIT Services management, we extend our heartfelt birthday greetings. Your dedication and professional excellence continue to drive our collective success. Wishing you continued growth and achievement in the coming year.`,
    `To ${name}: The management team extends warm birthday wishes. Your commitment to excellence and consistent contributions are highly valued. May this year bring you new opportunities and continued professional fulfillment.`,
    `Happy Birthday, ${name}! NSW IT Services management recognizes your valuable contributions and wishes you a year of continued success, growth, and meaningful achievements in your professional journey.`,
    `Dear ${name}, on this special day, the management extends sincere birthday wishes. Your professionalism and dedication inspire your colleagues. Wishing you a rewarding year ahead filled with accomplishments.`,
    `To our valued team member ${name}: Management wishes you a happy birthday. Your work ethic and commitment to quality exemplify our company values. May the coming year bring you both professional success and personal joy.`,
    `Happy Birthday, ${name}! The leadership team extends best wishes for your special day. Your contributions are instrumental to our success, and we look forward to celebrating many more achievements with you.`,
    `Dear ${name}, on your birthday, we acknowledge your outstanding professionalism and dedication. NSW IT Services management wishes you continued success and fulfillment in all your endeavors this year.`,
    `To ${name}: Wishing you a wonderful birthday from the entire management team. Your consistent performance and positive attitude are greatly appreciated. May this year bring you new challenges and triumphs.`
  ];
  const today = new Date();
  const messageIndex = (today.getDate() + today.getMonth()) % messages.length;
  return messages[messageIndex];
};

const getTeamBirthdayWish = () => {
  const wishes = [
    "Your colleagues join in celebrating your special day and extend warm wishes for continued success in your professional journey.",
    "The entire team sends birthday greetings and looks forward to achieving more milestones together in the coming year.",
    "On behalf of your teammates, we wish you a productive year ahead filled with collaborative successes and shared achievements.",
    "Your fellow team members extend birthday wishes and appreciation for your valuable contributions to our collective goals.",
    "The team celebrates your special day and wishes you a year of professional growth and collaborative accomplishments.",
    "Colleagues across departments join in wishing you a happy birthday and continued success in your professional endeavors.",
    "Your teammates extend warm birthday wishes and look forward to another year of productive collaboration and shared successes.",
    "The entire NSW IT Services team celebrates your birthday and wishes you a rewarding year of professional development."
  ];
  const today = new Date();
  const wishIndex = (today.getDate() + today.getDay()) % wishes.length;
  return wishes[wishIndex];
};

// Notification Component with UI Fixes
const NotificationCenter = ({ notifications, onClose, onMarkAsRead, onMarkAllAsRead, onDelete, onDeleteAll, onViewDetails }) => {
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter(n => !n?.read).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return <FaCheckCircle style={{ color: '#52c41a' }} />;
      case 'warning': return <FaExclamationCircle style={{ color: '#faad14' }} />;
      case 'error': return <FaTimes style={{ color: '#ff4d4f' }} />;
      case 'info': return <FaInfoCircle style={{ color: '#1890ff' }} />;
      default: return <FaBell style={{ color: '#8c8c8c' }} />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return '#f6ffed';
      case 'warning': return '#fff7e6';
      case 'error': return '#fff2f0';
      case 'info': return '#e6f7ff';
      default: return '#fafafa';
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Generate a stable key for notification items
  const getNotificationKey = (notification, index) => {
    return notification?._id || `notification-${index}`;
  };

  return (
    <div className="notification-center">
      <div className="notification-header">
        <div className="notification-title">
          <FaBell style={{ marginRight: '8px' }} />
          Notifications
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </div>
        <div className="notification-actions">
          {unreadCount > 0 && (
            <button
              className="notification-action-btn"
              onClick={onMarkAllAsRead}
              title="Mark all as read"
            >
              <FaCheck /> Mark all read
            </button>
          )}
          {safeNotifications.length > 0 && (
            <button
              className="notification-action-btn delete"
              onClick={onDeleteAll}
              title="Clear all notifications"
            >
              <FaTrash /> Clear all
            </button>
          )}
          <button
            className="notification-close-btn"
            onClick={onClose}
            title="Close notifications"
          >
            ×
          </button>
        </div>
      </div>

      <div className="notification-list">
        {safeNotifications.length === 0 ? (
          <div className="no-notifications">
            <FaBell size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p>No notifications</p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>You're all caught up!</p>
          </div>
        ) : (
          safeNotifications.map((notification, index) => (
            <div
              key={getNotificationKey(notification, index)}
              className={`notification-item ${!notification?.read ? 'unread' : ''}`}
              style={{ backgroundColor: getNotificationColor(notification?.type) }}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification?.type)}
              </div>
              <div className="notification-content">
                <div className="notification-message">
                  {notification?.message || 'No message'}
                </div>
                <div className="notification-meta">
                  <span className="notification-time">
                    {formatTimeAgo(notification?.createdAt || notification?.timestamp)}
                  </span>
                  {notification?.category && (
                    <span className="notification-category">
                      {notification.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="notification-item-actions">
                {!notification?.read && (
                  <button
                    className="notification-item-btn"
                    onClick={() => onMarkAsRead(notification._id)}
                    title="Mark as read"
                  >
                    <FaCheck size={12} />
                  </button>
                )}
                <button
                  className="notification-item-btn view"
                  onClick={() => onViewDetails(notification)}
                  title="View details"
                >
                  <FaEye size={12} />
                </button>
                <button
                  className="notification-item-btn delete"
                  onClick={() => onDelete(notification._id)}
                  title="Delete notification"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {safeNotifications.length > 0 && (
        <div className="notification-footer">
          <button
            className="notification-view-all-btn"
            onClick={() => {
              alert('View all notifications feature would open detailed view');
            }}
          >
            <FaEnvelope style={{ marginRight: '8px' }} />
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
};

// Excel Export Component
const ExportToExcel = ({ data, filename, sheetName, buttonText }) => {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
    XLSX.writeFile(wb, filename || 'export.xlsx');
  };

  return (
    <button
      onClick={handleExport}
      className="export-btn"
      title="Export to Excel"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: '#217346',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '500',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a5e38'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#217346'}
    >
      <FaFileExcel /> {buttonText || 'Export to Excel'} <FaDownload size={12} />
    </button>
  );
};

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();

  const TAGLINES = useMemo(
    () => [
      "Consistency builds professional excellence.",
      "Every workday is a step toward mastery.",
      "Discipline today creates success tomorrow.",
      "Quality work speaks louder than words.",
      "Focus, commitment, and growth define professionals.",
      "Building careers. Strengthening organizations.",
      "Professionalism, trust, and excellence.",
      "Committed to people. Focused on results.",
      "Your success is our business.",
      "Empowering professionals, transforming futures"
    ],
    []
  );

  const getTaglineOfTheDay = useCallback(() => {
    return TAGLINES[new Date().getDate() % TAGLINES.length];
  }, [TAGLINES]);

  const getTodayInfo = () => {
    const now = new Date();
    return {
      day: now.toLocaleDateString("en-IN", { weekday: "long" }),
      date: now.getDate(),
      month: now.toLocaleDateString("en-IN", { month: "long" }),
      year: now.getFullYear()
    };
  };

  const [todayInfo, setTodayInfo] = useState(getTodayInfo());
  const [tagline, setTagline] = useState(getTaglineOfTheDay());
  const [compOffBalance, setCompOffBalance] = useState(0);
  const [yearOptions] = useState(getYearOptions());
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [lastVisitedMonthYear, setLastVisitedMonthYear] = useState(null);
  const [showNextMonthPopup, setShowNextMonthPopup] = useState(false);
  const [showBirthdayBanner, setShowBirthdayBanner] = useState(false);
  const [birthdayManagerMessage, setBirthdayManagerMessage] = useState("");

  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  const popupShownRef = useRef(false);

  const [sharedMetrics, setSharedMetrics] = useState({
    presentDays: 0,
    halfDays: 0,
    leavesTaken: 0,
    hoursWorked: 0,
    pendingRequests: 0,
    extraHours: 0,
    compOffRequests: 0
  });

  const [activeTab, setActiveTab] = useState("timesheet");

  const [{ month, year }, setMonthYear] = useState(getCurrentMonth());

  const [date, setDate] = useState(formatToday());
  const [status, setStatus] = useState("PRESENT FULL DAY");
  const [workInTime, setWorkInTime] = useState("10:00");
  const [workOutTime, setWorkOutTime] = useState("18:00");
  const [lunchInTime, setLunchInTime] = useState("13:00");
  const [lunchOutTime, setLunchOutTime] = useState("14:00");
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
  const [filteredTasks, setFilteredTasks] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [payslips, setPayslips] = useState([]);
  const [loadingSave, setLoadingSave] = useState(false);
  const [lastAlertAttendanceId, setLastAlertAttendanceId] = useState(null);
  const [taskError, setTaskError] = useState("");

  const [showTaskSuccess, setShowTaskSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // UPDATED TASK FORM WITH CORRECT FIELD NAMES
  const [taskForm, setTaskForm] = useState({
    projectId: "",
    requirement: "", // was recentRequirement
    type: "NEW", // was requirementType
    requirementRole: "DEVELOPER",
    status: "OPEN",
    scope: "AGREED",
    notes: "",
    discussedDate: formatToday(),
    startDate: "", // was originalClosureDate
    closeDate: "", // was estimatedDate
    workingDays: 0, // was noOfDays
    clientPriority: "P3",
    prioritySource: "CLIENT",
    estHours: PRIORITY_DEFAULT_HOURS.P3 // was hoursAllocated
  });
  const [editingTaskId, setEditingTaskId] = useState(null);

  // Project State for Employee
  const [myProjects, setMyProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayInfo(getTodayInfo());
      setTagline(getTaglineOfTheDay());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [getTaglineOfTheDay]);

  // ============================================
  // ✅ ALL useCallback FUNCTIONS DEFINED FIRST
  // ============================================

  const loadNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get("/notifications/my");

      const notificationsData = Array.isArray(res.data) ? res.data : [];

      const employeeNotifications = notificationsData.filter(notification =>
        notification?.userId === user?._id ||
        notification?.userId === user?.id ||
        notification?.recipientId === user?._id ||
        notification?.recipientId === user?.id ||
        (notification?.recipientType === 'employee' && (!notification?.recipientId || notification?.recipientId === user?._id))
      );

      setNotifications(employeeNotifications);
      const unread = employeeNotifications.filter(n => !n?.read).length;
      setUnreadNotificationCount(unread);
    } catch (error) {
      console.error("Error loading notifications", error);
      setNotifications([]);
      setUnreadNotificationCount(0);
    } finally {
      setLoadingNotifications(false);
    }
  }, [user?._id, user?.id]);

  const loadAttendance = useCallback(async (selectedMonth = month, selectedYear = year) => {
    try {
      const res = await api.get("/attendance/my", {
        params: { month: selectedMonth, year: selectedYear }
      });
      setAttendance(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading attendance", error);
      setAttendance([]);
    }
  }, [month, year]);

  const loadSummary = useCallback(async (selectedMonth = month, selectedYear = year) => {
    try {
      const res = await api.get("/leave/summary/me", { params: { month: selectedMonth, year: selectedYear } });
      setSummary(res.data || null);
    } catch (error) {
      console.error("Error loading summary", error);
      setSummary(null);
    }
  }, [month, year]);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await api.get("/utils/dashboard");

      setSharedMetrics({
        presentDays: res.data?.attendance?.presentDays || 0,
        halfDays: res.data?.attendance?.halfDays || 0,
        leavesTaken: res.data?.attendance?.leaveDays || 0,
        hoursWorked: res.data?.timesheet?.totalHoursWorked || 0,
        pendingRequests: 0,
        extraHours: res.data?.timesheet?.totalExtraHours || 0,
        compOffRequests: 0
      });

      setCompOffBalance(res.data?.leaveBalance?.compOff || 0);
    } catch (error) {
      console.error("Error loading dashboard", error);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get("/projects/my");
      console.log("Employee projects loaded:", res.data);
      const projectsData = Array.isArray(res.data) ? res.data : [];

      setProjects(projectsData);
      setMyProjects(projectsData);
    } catch (error) {
      console.error("Error loading projects", error);
      setProjects([]);
      setMyProjects([]);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get("/tasks/my");
      console.log("Employee /tasks/my result:", res.data);
      const tasksData = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
      setTasks(tasksData);
      setFilteredTasks(tasksData);
      setSearchTerm("");

      if (selectedProject?._id) {
        const projectTasksRes = await api.get(`/projects/${selectedProject._id}/tasks`);
        setProjectTasks(Array.isArray(projectTasksRes.data) ? projectTasksRes.data : []);
      }
    } catch (error) {
      console.error("Error loading my tasks", error?.response || error);
      setTasks([]);
      setFilteredTasks([]);
      setProjectTasks([]);
    }
  }, [selectedProject?._id]);

  const loadPayslips = useCallback(async () => {
    try {
      const res = await api.get("/payslips/my");
      setPayslips(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to load payslips", error);
      setPayslips([]);
    }
  }, []);

  const refreshNotificationsAfterAction = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const forceRefreshAll = useCallback(async () => {
    try {
      await Promise.all([
        loadAttendance(),
        loadSummary(),
        loadDashboard()
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  }, [loadAttendance, loadSummary, loadDashboard]);

  // ============================================
  // ✅ SOCKET CONNECTION useEffect
  // ============================================

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

    const socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    socket.on("connect", () => {
      console.log("✅ Employee socket connected:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.log("⚠️ Socket connection error:", error.message);
    });

    socket.on("dashboard:update", async (data) => {
      console.log("📡 Real-time update received:", data);

      try {
        await Promise.all([
          loadAttendance(),
          loadSummary(),
          loadDashboard(),
          loadTasks(),
          loadProjects(),
          loadNotifications(),
          loadPayslips()
        ]);
      } catch (err) {
        console.error("Socket reload error:", err);
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
        console.log("❌ Employee socket disconnected");
      }
    };
  }, [
    loadAttendance,
    loadSummary,
    loadDashboard,
    loadTasks,
    loadProjects,
    loadNotifications,
    loadPayslips
  ]);

  // ============================================
  // ✅ INITIAL DATA LOAD useEffect
  // ============================================

  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        loadAttendance(),
        loadSummary(),
        loadDashboard(),
        loadProjects(),
        loadTasks(),
        loadNotifications(),
        loadPayslips()
      ]);
    };

    loadInitialData();
  }, [
    loadAttendance,
    loadSummary,
    loadDashboard,
    loadProjects,
    loadTasks,
    loadNotifications,
    loadPayslips
  ]);

  // ============================================
  // ✅ OTHER useEffect HOOKS
  // ============================================

  useEffect(() => {
    const current = new Date();
    const currentMonth = current.getMonth() + 1;
    const currentYear = current.getFullYear();

    const selected = new Date(parseInt(year), parseInt(month) - 1, 1);
    const selectedMonth = selected.getMonth() + 1;
    const selectedYear = selected.getFullYear();

    const isNextMonth = (selectedYear > currentYear) ||
      (selectedYear === currentYear && selectedMonth > currentMonth);

    const key = `${month}-${year}`;

    if (isNextMonth && !popupShownRef.current && key !== lastVisitedMonthYear) {
      setShowNextMonthPopup(true);
      popupShownRef.current = true;
      setLastVisitedMonthYear(key);
    }

    if (!isNextMonth) {
      popupShownRef.current = false;
    }
  }, [month, year, lastVisitedMonthYear]);

  useEffect(() => {
    const checkBirthday = async () => {
      try {
        const isTestMode = import.meta.env.VITE_BIRTHDAY_TEST_MODE === "true";

        if (isTestMode) {
          setShowBirthdayBanner(true);
          setBirthdayManagerMessage(
            getManagementBirthdayMessage(user?.fullName || "Team Member")
          );
          return;
        }

        const dismissed = sessionStorage.getItem("birthdayDismissed");
        if (dismissed) return;

        const res = await api.get("/birthday/today");

        if (res.data?.isBirthday) {
          setShowBirthdayBanner(true);
          setBirthdayManagerMessage(
            getManagementBirthdayMessage(user?.fullName || "Team Member")
          );
        }
      } catch (err) {
        console.error("Birthday check failed", err);
      }
    };

    checkBirthday();
  }, [user?.fullName]);

  useEffect(() => {
    if (activeTab === "payslips") {
      loadPayslips();
    }
  }, [activeTab, loadPayslips]);

  useEffect(() => {
    if (!Array.isArray(attendance) || attendance.length === 0) {
      setSharedMetrics({
        presentDays: 0,
        halfDays: 0,
        leavesTaken: 0,
        hoursWorked: 0,
        pendingRequests: 0,
        extraHours: 0,
        compOffRequests: 0
      });
      return;
    }

    let presentDays = 0;
    let halfDays = 0;
    let leavesTaken = 0;
    let hoursWorked = 0;
    let pendingRequests = 0;
    let extraHours = 0;
    let compOffRequests = 0;

    attendance.forEach((a) => {
      if (!a) return;

      if (a.managerDecision?.status === "REJECTED") {
        return;
      }

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

      if (a.status === "COMPOFF") {
        compOffRequests += 1;
      }

      hoursWorked += a.hoursWorked || 0;
      extraHours += a.extraHoursWorked || 0;
    });

    hoursWorked = Math.round(hoursWorked * 10) / 10;
    extraHours = Math.round(extraHours * 10) / 10;

    setSharedMetrics({
      presentDays,
      halfDays,
      leavesTaken,
      hoursWorked,
      pendingRequests,
      extraHours,
      compOffRequests
    });
  }, [attendance]);

  useEffect(() => {
    if (!Array.isArray(attendance) || attendance.length === 0) return;

    const decided = attendance
      .filter(
        (a) =>
          a &&
          a.managerDecision &&
          (a.managerDecision.status === "APPROVED" ||
            a.managerDecision.status === "REJECTED")
      )
      .sort((a, b) => {
        const ta =
          a.managerDecision?.decidedAt ||
          a.updatedAt ||
          `${a.date?.split("-").reverse().join("-")}T00:00:00Z`;
        const tb =
          b.managerDecision?.decidedAt ||
          b.updatedAt ||
          `${b.date?.split("-").reverse().join("-")}T00:00:00Z`;
        return new Date(tb) - new Date(ta);
      });

    if (decided.length === 0) return;

    const latest = decided[0];
    if (!latest?._id || latest._id === lastAlertAttendanceId) return;

    const decision = latest.managerDecision.status;
    const label =
      latest.status === "COMPOFF"
        ? "Comp-off request"
        : latest.status || "attendance request";

    const message =
      decision === "APPROVED"
        ? `Your ${label} for ${latest.date} was APPROVED by Manager.`
        : `Your ${label} for ${latest.date} was REJECTED by Manager.`;

    const [_, mm, yyyy] = (latest.date || "").split("-");
    if (`${mm}-${yyyy}` === `${month}-${year}`) {
      setTimeout(() => {
        alert(message);
      }, 100);

      const newNotification = {
        _id: `attendance-${latest._id}-${Date.now()}`,
        type: decision === "APPROVED" ? 'success' : 'error',
        message: message,
        category: 'Attendance',
        read: false,
        createdAt: new Date().toISOString(),
        userId: user?._id
      };

      setNotifications(prev => Array.isArray(prev) ? [newNotification, ...prev] : [newNotification]);
      setUnreadNotificationCount(prev => (prev || 0) + 1);
    }

    setLastAlertAttendanceId(latest._id);
  }, [attendance, lastAlertAttendanceId, month, year, user?._id]);

  // ============================================
  // ✅ Holiday calculations
  // ============================================

  const holidays = buildHolidayCalendar(month, year) || [];
  const calendarWeeks = buildMonthMatrix(month, year);

  const holidayByDateKey = holidays.reduce((acc, h) => {
    if (h?.dateKey) acc[h.dateKey] = h;
    return acc;
  }, {});

  const publicHolidays = holidays.filter(
    (h) =>
      h &&
      (h.type === "MANDATORY_PUBLIC" ||
        h.type === "OPTIONAL_PUBLIC" ||
        h.isMandatory ||
        h.isOptional ||
        h.kind === "MANDATORY" ||
        h.kind === "OPTIONAL")
  );

  const mandatoryPublicCount = publicHolidays.filter(
    (h) =>
      h &&
      (h.type === "MANDATORY_PUBLIC" ||
        h.isMandatory ||
        h.kind === "MANDATORY")
  ).length;

  const optionalPublic = publicHolidays.filter(
    (h) =>
      h &&
      (h.type === "OPTIONAL_PUBLIC" ||
        h.isOptional ||
        h.kind === "OPTIONAL")
  );

  const optionalTakenCount = optionalPublic.reduce((sum, h) => {
    const taken =
      h?.taken === "TAKEN" ||
        h?.takenStatus === "TAKEN" ||
        h?.defaultTaken
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
      setLunchInTime("13:00");
      setLunchOutTime("14:00");
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

  // ============================================
  // ✅ MARK NOTIFICATION FUNCTIONS
  // ============================================

  const markNotificationAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);

      setNotifications(prev =>
        Array.isArray(prev) ? prev.map(n =>
          n?._id === notificationId
            ? { ...n, read: true }
            : n
        ) : []
      );
      setUnreadNotificationCount(prev => Math.max(0, (prev || 0) - 1));
    } catch (error) {
      console.error("Error marking notification as read", error);
      setNotifications(prev =>
        Array.isArray(prev) ? prev.map(n =>
          n?._id === notificationId
            ? { ...n, read: true }
            : n
        ) : []
      );
      setUnreadNotificationCount(prev => Math.max(0, (prev || 0) - 1));
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await api.patch("/notifications/mark-all-read");

      setNotifications(prev =>
        Array.isArray(prev) ? prev.map(n => ({ ...n, read: true })) : []
      );
      setUnreadNotificationCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read", error);
      setNotifications(prev =>
        Array.isArray(prev) ? prev.map(n => ({ ...n, read: true })) : []
      );
      setUnreadNotificationCount(0);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);

      const notification = Array.isArray(notifications) ? notifications.find(n => n?._id === notificationId) : null;
      setNotifications(prev => Array.isArray(prev) ? prev.filter(n => n?._id !== notificationId) : []);

      if (notification && !notification.read) {
        setUnreadNotificationCount(prev => Math.max(0, (prev || 0) - 1));
      }
    } catch (error) {
      console.error("Error deleting notification", error);
      const notification = Array.isArray(notifications) ? notifications.find(n => n?._id === notificationId) : null;
      setNotifications(prev => Array.isArray(prev) ? prev.filter(n => n?._id !== notificationId) : []);

      if (notification && !notification.read) {
        setUnreadNotificationCount(prev => Math.max(0, (prev || 0) - 1));
      }
    }
  };

  const deleteAllNotifications = async () => {
    try {
      await api.delete("/notifications/clear-all");

      setNotifications([]);
      setUnreadNotificationCount(0);
    } catch (error) {
      console.error("Error deleting all notifications", error);
      setNotifications([]);
      setUnreadNotificationCount(0);
    }
  };

  const handleViewNotificationDetails = (notification) => {
    const details = `
Notification Details:
────────────────────
Type: ${notification?.type || 'info'}
Category: ${notification?.category || 'General'}
Message: ${notification?.message || 'No message'}
Date: ${notification?.createdAt || notification?.timestamp ? new Date(notification.createdAt || notification.timestamp).toLocaleString() : 'Unknown'}
Status: ${notification?.read ? 'Read' : 'Unread'}
    `;

    alert(details);
  };

  // ============================================
  // ✅ HANDLE SAVE ATTENDANCE
  // ============================================

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
        requestType: "UPDATE",
        isLeaveRequest: APPROVAL_STATUSES.includes(status),

        date,
        status,
        workInTime,
        workOutTime,
        lunchInTime,
        lunchOutTime,
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
          workedDate,
          workedMinutes: Number(hours) * 60,
          approved: false
        };

      }

      await api.post("/attendance", payload);

      await forceRefreshAll();
      await refreshNotificationsAfterAction();

      if (APPROVAL_STATUSES.includes(status)) {
        const message = `Attendance / leave change for ${date} sent to Manager for approval. It will reflect in your dashboard and project views after Manager approval.`;
        alert(message);

        const newNotification = {
          _id: `attendance-${Date.now()}`,
          type: 'info',
          message: `Attendance request for ${date} submitted. Waiting for manager approval.`,
          category: 'Attendance',
          read: false,
          createdAt: new Date().toISOString(),
          userId: user?._id
        };

        setNotifications(prev => Array.isArray(prev) ? [newNotification, ...prev] : [newNotification]);
        setUnreadNotificationCount(prev => (prev || 0) + 1);
      } else {
        const message = `Attendance for ${date} saved successfully!`;
        alert(message);

        const newNotification = {
          _id: `attendance-${Date.now()}`,
          type: 'success',
          message: `Attendance for ${date} marked as ${status}.`,
          category: 'Attendance',
          read: false,
          createdAt: new Date().toISOString(),
          userId: user?._id
        };

        setNotifications(prev => Array.isArray(prev) ? [newNotification, ...prev] : [newNotification]);
        setUnreadNotificationCount(prev => (prev || 0) + 1);
      }

      setDate(formatToday());
      setStatus("PRESENT FULL DAY");
      setWorkInTime("10:00");
      setWorkOutTime("18:00");
      setLunchInTime("13:00");
      setLunchOutTime("14:00");
      setNote("");
      setExtraWork({
        hours: 2,
        workedDate: "",
        workedTime: "18:00",
        compOffDate: "",
        compOffTime: "10:00"
      });

    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Error saving attendance");
    } finally {
      setLoadingSave(false);
    }
  };

  // ============================================
  // ✅ HANDLE MONTH CHANGE
  // ============================================

  const handleMonthChange = (e) => {
    const [m, y] = e.target.value.split("-");
    setMonthYear({ month: m, year: y });
    setLastAlertAttendanceId(null);
  };

  const handleYearChange = (e) => {
    const y = e.target.value;
    setSelectedYear(y);
    setMonthYear({
      month: "01",
      year: y
    });
    setLastAlertAttendanceId(null);
  };

  const monthLabel = `${monthNames[Number(month) - 1]}, ${year}`;

  const timesheetRows = useMemo(() => {
    return Array.isArray(attendance) ? attendance.map((a) => {
      const workedHours = a?.hoursWorked || 0;
      const extraHours = a?.extraHoursWorked || 0;

      return {
        ...a,
        workedHours,
        extraHours
      };
    }) : [];
  }, [attendance]);

  const totalTimesheetHours = timesheetRows.reduce(
    (sum, r) => sum + (r?.workedHours || 0),
    0
  );

  // UPDATED RESET FUNCTION WITH CORRECT FIELD NAMES
  const resetTaskForm = (keepProjectId = false) => {
    setEditingTaskId(null);
    setTaskForm((prev) => ({
      projectId: keepProjectId ? prev.projectId : "",
      requirement: "", // was recentRequirement
      type: "NEW", // was requirementType
      requirementRole: "DEVELOPER",
      status: "OPEN",
      scope: "AGREED",
      notes: "",
      discussedDate: formatToday(),
      startDate: "", // was originalClosureDate
      closeDate: "", // was estimatedDate
      workingDays: 0, // was noOfDays
      clientPriority: "P3",
      prioritySource: "CLIENT",
      estHours: PRIORITY_DEFAULT_HOURS.P3 // was hoursAllocated
    }));
    setTaskError("");
    setShowTaskSuccess(false);
    setSuccessMessage("");
  };

  const showSuccessPopup = (message) => {
    setSuccessMessage(message);
    setShowTaskSuccess(true);
    setTimeout(() => {
      setShowTaskSuccess(false);
      setSuccessMessage("");
    }, 3000);
  };

  // UPDATED CREATE/UPDATE TASK FUNCTION WITH CORRECT PAYLOAD
  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    setTaskError("");

    if (!taskForm.projectId) {
      setTaskError("Please select a project");
      return;
    }

    if (!taskForm.requirement || taskForm.requirement.trim().length === 0) {
      setTaskError("Please enter a requirement description");
      return;
    }

    if (!taskForm.estHours || taskForm.estHours <= 0) {
      setTaskError("Please enter estimated hours greater than 0");
      return;
    }

    const finalDays = taskForm.workingDays || 0;

    try {
      const now = new Date();
      // UPDATED PAYLOAD WITH CORRECT FIELD NAMES
      const payload = {
        projectId: taskForm.projectId,
        requirement: taskForm.requirement?.trim(), // was recentRequirement
        type: taskForm.type, // was requirementType
        status: taskForm.status,
        scope: taskForm.scope,
        notes: taskForm.notes,
        discussedDate: taskForm.discussedDate,
        startDate: taskForm.startDate, // was originalClosureDate
        closeDate: taskForm.closeDate, // was estimatedDate
        workingDays: finalDays, // was noOfDays
        clientPriority: taskForm.clientPriority,
        givenBy: taskForm.prioritySource, // was prioritySource
        estHours: Number(taskForm.estHours) > 0 ? Number(taskForm.estHours) : PRIORITY_DEFAULT_HOURS[taskForm.clientPriority] || 8, // was estimateHours/hoursAllocated
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        assignedUserId: user?._id || user?.id,
        createdByUserId: user?._id || user?.id
      };

      console.log("DEBUG - Creating task with payload:", payload);

      if (!editingTaskId) {
        await api.post("/tasks", payload);
        setSuccessMessage("Task created successfully");
setShowTaskSuccess(true);

setTimeout(() => {
  setShowTaskSuccess(false);
}, 3000);
        const message = "Task / requirement added successfully";
        showSuccessPopup(message);

        const newNotification = {
          _id: `task-${Date.now()}`,
          type: 'success',
          message: `Task created: "${taskForm.requirement.substring(0, 50)}..."`,
          category: 'Tasks',
          read: false,
          createdAt: new Date().toISOString(),
          userId: user?._id
        };

        setNotifications(prev => Array.isArray(prev) ? [newNotification, ...prev] : [newNotification]);
        setUnreadNotificationCount(prev => (prev || 0) + 1);
      } else {
        console.log("UPDATE PAYLOAD →", payload);
        await api.patch(`/tasks/${editingTaskId}`, payload);
        const message = "Task updated successfully";
        showSuccessPopup(message);

        const newNotification = {
          _id: `task-${Date.now()}`,
          type: 'info',
          message: `Task updated: "${taskForm.requirement.substring(0, 50)}..."`,
          category: 'Tasks',
          read: false,
          createdAt: new Date().toISOString(),
          userId: user?._id
        };

        setNotifications(prev => Array.isArray(prev) ? [newNotification, ...prev] : [newNotification]);
        setUnreadNotificationCount(prev => (prev || 0) + 1);
      }

      resetTaskForm(true);
      setSuccessMessage("Task created successfully");


      setTimeout(() => {

      }, 3000);
      await loadTasks();
      await refreshNotificationsAfterAction();

    } catch (error) {
      console.error("Employee create/update task error", error?.response || error);
      setTaskError(error.response?.data?.message || "Error saving task. Please check your input.");
    }
  };

  // UPDATED EDIT TASK FUNCTION WITH CORRECT FIELD MAPPING
  const startEditTask = (t) => {
    if (!t) return;

    const canEdit = (() => {
      const userRole = user?.role;
      const createdByRole = t?.createdByRole;
      const createdById = t?.createdByUserId?._id || t?.createdByUserId;
      const userId = user?._id || user?.id;

      if (userRole === "admin") return false;
      if (userRole === "employee") {
        return createdByRole === "employee" && createdById === userId;
      }
      if (userRole === "manager" && createdByRole === "employee") {
        return true;
      }
      if (userRole === "manager" && createdByRole === "manager") {
        return createdById === userId;
      }
      return false;
    })();

    if (!canEdit) {
      alert("You don't have permission to edit this task");
      return;
    }

    setEditingTaskId(t._id);
    setTaskForm({
      projectId: t.projectId?._id || t.projectId || "",
      requirement: t.requirement || t.recentRequirement || "", // handle both old and new
      type: t.type || t.requirementType || "NEW", // handle both old and new
      requirementRole: t.requirementRole || "DEVELOPER",
      status: t.status || "OPEN",
      scope: t.scope || "AGREED",
      notes: t.notes || "",
      discussedDate: t.discussedDate || formatToday(),
      startDate: t.startDate || t.originalClosureDate || "", // handle both old and new
      closeDate: t.closeDate || t.estimatedDate || "", // handle both old and new
      workingDays: t.workingDays || t.noOfDays || 0, // handle both old and new
      clientPriority: t.clientPriority || "P3",
      prioritySource: t.givenBy || t.prioritySource || "CLIENT", // handle both old and new
      estHours: t.estHours || t.estimateHours || PRIORITY_DEFAULT_HOURS[t.clientPriority || "P3"] || 8 // handle both old and new
    });
  };

  const monthYearSelect = (
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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
      <select value={selectedYear} onChange={handleYearChange} style={{ marginLeft: "10px" }}>
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );

  const handleDownloadPayslip = async (payslipId, month, year) => {
    try {
      const response = await api.get(`/payslips/${payslipId}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const employeeName = (user?.fullName || "Employee").replace(/\s+/g, "_");
      const monthName = monthNames[month - 1];

      const link = document.createElement("a");
      link.href = url;
      link.download = `${employeeName}_${monthName}_${year}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      const newNotification = {
        _id: `payslip-${Date.now()}`,
        type: 'info',
        message: `Payslip for ${monthName} ${year} downloaded.`,
        category: 'Payslip',
        read: false,
        createdAt: new Date().toISOString(),
        userId: user?._id
      };

      setNotifications(prev => Array.isArray(prev) ? [newNotification, ...prev] : [newNotification]);
      setUnreadNotificationCount(prev => (prev || 0) + 1);
    } catch (error) {
      console.error("Error downloading payslip:", error);
      alert("Failed to download payslip.");
    }
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    try {
      const res = await api.get(`/tasks/project/${project._id}`);
      setProjectTasks(Array.isArray(res.data?.tasks) ? res.data.tasks : []);
    } catch (error) {
      console.error("Error loading project tasks:", error);
      setProjectTasks([]);
    }
  };

  const NextMonthPopup = () => {
    if (!showNextMonthPopup) return null;

    return (
      <div className="popup-overlay">
        <div className="popup-content">
          <h3>Next Month View</h3>
          <p>You are viewing {monthLabel}. This is a future month view. Please note:</p>
          <ul>
            <li>Attendance cannot be marked for future dates</li>
            <li>You can view holiday calendar for planning</li>
            <li>Tasks and projects will be visible as usual</li>
          </ul>
          <button
            className="primary-btn"
            onClick={() => setShowNextMonthPopup(false)}
            style={{ marginTop: '10px' }}
          >
            OK, Got it
          </button>
        </div>
      </div>
    );
  };

  // Project Status Badge Component
  const ProjectStatusBadge = ({ status }) => {
    const statusConfig = {
      DRAFT: {
        label: "DRAFT",
        color: "#8c8c8c",
        bgColor: "#f5f5f5",
        borderColor: "#d9d9d9"
      },
      PENDING_APPROVAL: {
        label: "PENDING APPROVAL",
        color: "#fa8c16",
        bgColor: "#fff7e6",
        borderColor: "#ffa940"
      },
      APPROVED: {
        label: "APPROVED",
        color: "#52c41a",
        bgColor: "#f6ffed",
        borderColor: "#95de64"
      },
      REJECTED: {
        label: "REJECTED",
        color: "#ff4d4f",
        bgColor: "#fff2f0",
        borderColor: "#ff7875"
      },
      COMPLETED: {
        label: "COMPLETED",
        color: "#1890ff",
        bgColor: "#e6f7ff",
        borderColor: "#69c0ff"
      },
      ARCHIVED: {
        label: "ARCHIVED",
        color: "#722ed1",
        bgColor: "#f9f0ff",
        borderColor: "#b37feb"
      }
    };

    const config = statusConfig[status] || statusConfig.DRAFT;

    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "11px",
          fontWeight: "600",
          color: config.color,
          backgroundColor: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          textTransform: "uppercase",
          letterSpacing: "0.3px"
        }}
      >
        {config.label}
      </span>
    );
  };

  // Balance Display Component
  const BalanceDisplay = ({ balance, estimated, consumed }) => {
    const isNegative = balance < 0;
    const isLow = balance < (estimated * 0.1);

    return (
      <div style={{
        padding: "10px",
        borderRadius: "6px",
        backgroundColor: isNegative ? "#fff2f0" : isLow ? "#fff7e6" : "#f6ffed",
        border: `1px solid ${isNegative ? "#ffccc7" : isLow ? "#ffe58f" : "#b7eb8f"}`,
        marginBottom: "10px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span style={{ fontWeight: "bold", color: isNegative ? "#ff4d4f" : isLow ? "#fa8c16" : "#52c41a" }}>
            Project Balance
          </span>
          <span style={{
            fontWeight: "bold",
            fontSize: "16px",
            color: isNegative ? "#ff4d4f" : isLow ? "#fa8c16" : "#52c41a"
          }}>
            {balance?.toFixed(1) || 0} hrs
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          <div>Estimated: {estimated || 0} hrs</div>
          <div>Consumed: {consumed || 0} hrs</div>
          {isNegative && (
            <div style={{ color: "#ff4d4f", fontWeight: "bold", marginTop: "5px" }}>
              ⚠️ Project has exceeded estimated hours
            </div>
          )}
          {isLow && !isNegative && (
            <div style={{ color: "#fa8c16", fontWeight: "bold", marginTop: "5px" }}>
              ⚠️ Low balance remaining ({((balance / estimated) * 100).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // ✅ SEARCH FUNCTIONALITY
  // ============================================

  const handleSearch = (term) => {
    setSearchTerm(term);

    const safeTasks = Array.isArray(tasks) ? tasks : [];

    if (!term || term.trim() === "") {
      setFilteredTasks(safeTasks);
    } else {
      const searchLower = term.toLowerCase().trim();

      const filtered = safeTasks.filter((task) => {
        if (!task) return false;

        const requirement = (task.requirement || task.recentRequirement || task.title || "").toLowerCase(); // handle both old and new
        const project = (task.projectId?.name || task.project || "").toLowerCase();
        const status = (task.status || "").toLowerCase();
        const createdBy = (task.createdByUserId?.fullName || "").toLowerCase();
        const role = (task.requirementRole || "").toLowerCase();
        const priority = (task.clientPriority || "").toLowerCase();

        return (
          requirement.includes(searchLower) ||
          project.includes(searchLower) ||
          status.includes(searchLower) ||
          createdBy.includes(searchLower) ||
          role.includes(searchLower) ||
          priority.includes(searchLower)
        );
      });

      setFilteredTasks(filtered);
    }
  };

  // ============================================
  // ✅ EXPORT FUNCTIONS
  // ============================================

  const getAttendanceExportData = useCallback(() => {
    return timesheetRows.map(row => ({
      Date: row.date,
      Status: normalizeAttendanceStatus(row),
      'In Time': row.workInTime,
      'Out Time': row.workOutTime,
      'Hours Worked': row.workedHours?.toFixed(1) || 0,
      'Extra Hours': row.extraHours?.toFixed(1) || 0,
      'Manager Decision': row.managerDecision?.status || '-',
      Notes: row.note || '-'
    }));
  }, [timesheetRows]);

  // UPDATED EXPORT FUNCTION WITH CORRECT FIELD NAMES
  const getTasksExportData = useCallback(() => {
    return filteredTasks.map((task, index) => ({
      'S.No': index + 1,
      Project: task.projectId?.name || '-',
      Requirement: task.requirement || task.recentRequirement || task.title, // handle both old and new
      Type: task.type || task.requirementType || 'NEW', // handle both old and new
      Status: task.status,
      Scope: task.scope || '-',
      'Discussed Date': task.discussedDate || '-',
      'Est. Hours': task.estHours || task.estimateHours || 0, // handle both old and new
      Priority: task.clientPriority || '-',
      'Given By': task.givenBy || task.prioritySource || '-', // handle both old and new
      'Created By': task.createdByUserId?.fullName || '-'
    }));
  }, [filteredTasks]);

  const getProjectsExportData = useCallback(() => {
    return myProjects.map(project => ({
      'Project Name': project.name,
      Code: project.code || '-',
      Status: project.status,
      'Total Estimated Hours': project.totalEstimatedHours || 0,
      'Balance Hours': project.balanceHours || 0,
      'My Role': getMyRoleFromProject(project, user?._id) || 'Not assigned'
    }));
  }, [myProjects, user?._id]);

  const getHolidaysExportData = useCallback(() => {
    return publicHolidays.map(h => ({
      Date: h.dateLabel || h.dateKey,
      Occasion: h.name,
      Type: h.type === "MANDATORY_PUBLIC" || h.isMandatory ? "Mandatory" : "Optional",
      Status: h.taken === "TAKEN" ? "Taken" : "Not Taken"
    }));
  }, [publicHolidays]);

  // ============================================
  // ✅ RETURN JSX
  // ============================================

  return (
    <div className="page">
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src={logo} alt="NSW IT Services" className="sidebar-logo" />
          </div>

          <nav className="sidebar-nav">
            <button
              className={activeTab === "dashboard" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("dashboard")}
            >
              Dashboard
            </button>

            <button
              className={activeTab === "projects" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("projects")}
            >
              Project Management
            </button>

            <button
              className={activeTab === "timesheet" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab("timesheet")}
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

        <div className="main-area">
          <header className="topbar">
            {showBirthdayBanner && (
              <>
                <div className="birthday-balloons">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="balloon"
                      style={{
                        left: `${Math.random() * 100}%`,
                        animationDuration: `${10 + Math.random() * 8}s`,
                        animationDelay: `${Math.random() * 4}s`,
                        background: [
                          "#ff7875",
                          "#ffd666",
                          "#95de64",
                          "#69c0ff",
                          "#b37feb"
                        ][i % 5]
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    position: "fixed",
                    top: "18%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 9999,
                    maxWidth: 620,
                    width: "92%",
                    padding: "26px",
                    borderRadius: 24,
                    background:
                      "linear-gradient(135deg, #fffbe6, #fff1b8)",
                    border: "2px solid #faad14",
                    boxShadow: "0 20px 50px rgba(250,173,20,0.45)"
                  }}
                >
                  <div style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: "#874d00" }}>
                    🎉 Happy Birthday, {user?.fullName}! 🎂
                  </div>

                  <div style={{ marginTop: 8, textAlign: "center", fontSize: 14, color: "#5c3a00" }}>
                    Wishing you good health, continued success, and new milestones in the year ahead.
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      padding: "12px 16px",
                      borderRadius: 14,
                      background: "#ffffff",
                      border: "1px dashed #faad14",
                      fontSize: 13,
                      color: "#5c3a00"
                    }}
                  >
                    💼 <strong>Message from Management</strong>
                    <div style={{ marginTop: 6, fontStyle: "italic" }}>
                      {birthdayManagerMessage ||
                        getManagementBirthdayMessage(user?.fullName)}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 13, color: "#7a4a00", textAlign: "center" }}>
                    🎊 {getTeamBirthdayWish()}
                  </div>

                  <div style={{ textAlign: "center", marginTop: 18 }}>
                    <button
                      onClick={() => {
                        setShowBirthdayBanner(false);
                        sessionStorage.setItem("birthdayDismissed", "true");
                      }}
                      style={{
                        background: "#faad14",
                        color: "#fff",
                        border: "none",
                        padding: "8px 26px",
                        borderRadius: 999,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Thank You 🎈
                    </button>
                  </div>
                </div>
              </>
            )}

            <div
              style={{
                position: "absolute",
                right: 420,
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                padding: "8px 14px",
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, #e6f7ff 0%, #f0faff 60%, #ffffff 100%)",
                border: "1px solid #bae7ff",
                boxShadow: "0 6px 18px rgba(24, 144, 255, 0.15)",
                animation: "fadeSlideIn 0.6s ease-out",
                zIndex: 100
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0050b3",
                  letterSpacing: "0.3px",
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <FaClock size={12} /> {todayInfo.day}, {todayInfo.date} {todayInfo.month} {todayInfo.year}
              </div>

              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "#096dd9",
                  opacity: 0.9,
                  whiteSpace: "nowrap"
                }}
              >
                "{tagline}"
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <strong>{user?.fullName}</strong> <span style={{ color: '#666', fontSize: '12px' }}>(Employee)</span>
              </div>
              <div style={{ color: '#666', fontSize: '12px' }}>{user?.email}</div>
            </div>

            {/* Notification Button */}
            <div style={{ position: "relative", marginLeft: "16px" }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="notification-btn"
                style={{
                  position: "relative",
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#1890ff",
                  padding: "8px",
                  borderRadius: "50%",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  backgroundColor: unreadNotificationCount > 0 ? "#e6f7ff" : "transparent"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f0f5ff"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = unreadNotificationCount > 0 ? "#e6f7ff" : "transparent"}
              >
                <FaBell />
                {unreadNotificationCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      backgroundColor: "#ff4d4f",
                      color: "white",
                      borderRadius: "50%",
                      width: "18px",
                      height: "18px",
                      fontSize: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      animation: "pulse 2s infinite"
                    }}
                  >
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Notification Center */}
              {showNotifications && (
                <>
                  <div
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 9998
                    }}
                    onClick={() => setShowNotifications(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "50px",
                      right: 0,
                      zIndex: 9999,
                      minWidth: "380px",
                      maxWidth: "400px",
                      backgroundColor: "white",
                      borderRadius: "12px",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                      border: "1px solid #e8e8e8",
                      overflow: "hidden",
                      animation: "slideDown 0.3s ease-out"
                    }}
                  >
                    {loadingNotifications ? (
                      <div className="notification-center">
                        <div className="notification-header">
                          <div className="notification-title">
                            <FaBell style={{ marginRight: '8px' }} />
                            Loading Notifications...
                          </div>
                          <button
                            className="notification-close-btn"
                            onClick={() => setShowNotifications(false)}
                            title="Close notifications"
                          >
                            ×
                          </button>
                        </div>
                        <div className="notification-list">
                          <div className="no-notifications">
                            <div style={{ marginBottom: '16px' }}>
                              <div className="loading-spinner" style={{
                                width: '40px',
                                height: '40px',
                                border: '3px solid #f3f3f3',
                                borderTop: '3px solid #1890ff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto'
                              }}></div>
                            </div>
                            <p>Loading your notifications...</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <NotificationCenter
                        notifications={notifications}
                        onClose={() => setShowNotifications(false)}
                        onMarkAsRead={markNotificationAsRead}
                        onMarkAllAsRead={markAllNotificationsAsRead}
                        onDelete={deleteNotification}
                        onDeleteAll={deleteAllNotifications}
                        onViewDetails={handleViewNotificationDetails}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={logout}
              className="outline-btn"
              style={{ marginLeft: "8px" }}
            >
              Logout
            </button>
          </header>

          <NextMonthPopup />

          {/* Success Popup */}
          {showTaskSuccess && (
            <div
              style={{
                position: "fixed",
                top: "20%",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10000,
                backgroundColor: "#52c41a",
                color: "white",
                padding: "16px 24px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                animation: "slideDown 0.3s ease-out",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <FaCheckCircle size={20} />
              <span>{successMessage}</span>
            </div>
          )}

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
                      <div className="date-input-wrapper">
                        <FaCalendarAlt className="date-icon" />
                        <input
                          type="date"
                          value={toInputDate(date)}
                          onChange={(e) => setDate(fromInputDate(e.target.value))}
                          disabled={isSystemHoliday}
                        />
                      </div>
                    </label>

                    <label>
                      Status
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={
                          isSystemHoliday ||
                          (HALF_DAY_STATUSES.includes(status) &&
                            Array.isArray(attendance) &&
                            attendance.some(
                              (a) =>
                                a?.date === date &&
                                a?.managerDecision?.status === "APPROVED"
                            ))
                        }
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

                    {status === "PRESENT FULL DAY" && (
                      <>
                        <label>
                          Lunch In Time
                          <input
                            type="time"
                            value={lunchInTime}
                            onChange={(e) => setLunchInTime(e.target.value)}
                            disabled={isSystemHoliday}
                            required
                          />
                        </label>

                        <label>
                          Lunch Out Time
                          <input
                            type="time"
                            value={lunchOutTime}
                            onChange={(e) => setLunchOutTime(e.target.value)}
                            disabled={isSystemHoliday}
                            required
                          />
                        </label>
                      </>
                    )}

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
                    {monthYearSelect}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: 12,
                      fontSize: 13
                    }}
                  >
                    <div className="mini-kpi" style={{ background: "#1890ff", color: "white" }}>
                      <strong style={{ color: "rgba(255, 255, 255, 0.9)" }}>Present Days</strong>
                      <div style={{ color: "white" }}>{sharedMetrics.presentDays}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#1890ff", color: "white" }}>
                      <strong style={{ color: "rgba(255, 255, 255, 0.9)" }}>Half Days</strong>
                      <div style={{ color: "white" }}>{sharedMetrics.halfDays}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#1890ff", color: "white" }}>
                      <strong style={{ color: "rgba(255, 255, 255, 0.9)" }}>Leaves Taken</strong>
                      <div style={{ color: "white" }}>{sharedMetrics.leavesTaken}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#1890ff", color: "white" }}>
                      <strong style={{ color: "rgba(255, 255, 255, 0.9)" }}>Hours Worked</strong>
                      <div style={{ color: "white" }}>{sharedMetrics.hoursWorked}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#1890ff", color: "white" }}>
                      <strong style={{ color: "rgba(255, 255, 255, 0.9)" }}>Pending Requests</strong>
                      <div style={{ color: "white" }}>{sharedMetrics.pendingRequests}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#1890ff", color: "white" }}>
                      <strong style={{ color: "rgba(255, 255, 255, 0.9)" }}>Extra Hours</strong>
                      <div style={{ color: "white" }}>{sharedMetrics.extraHours.toFixed(1)}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#1890ff", color: "white" }}>
                      <strong style={{ color: "rgba(255, 255, 255, 0.9)" }}>Comp-off Balance</strong>
                      <div style={{ color: "white" }}>{compOffBalance}</div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header-row">
                    <h2>Public Holidays – {monthLabel}</h2>
                    <ExportToExcel
                      data={getHolidaysExportData()}
                      filename={`Public_Holidays_${monthLabel.replace(', ', '_')}.xlsx`}
                      sheetName="Public Holidays"
                      buttonText="Export"
                    />
                  </div>

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
                        <span>
                          <span
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              background: "#ffffff",
                              marginRight: 4,
                              border: "1px solid #d9d9d9"
                            }}
                          />
                          Working Day
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

                                let bg = "#ffffff";
                                let border = "1px solid #d9d9d9";
                                let color = "#000000";

                                if (isMandatory) {
                                  bg = "#ff7875";
                                  color = "#ffffff";
                                } else if (isOptional) {
                                  bg =
                                    taken === "TAKEN"
                                      ? "#40a9ff"
                                      : "#faad14";
                                  color = taken === "TAKEN" ? "#ffffff" : "#000000";
                                } else if (isSunday || isSecondSaturday) {
                                  bg = "#434343";
                                  color = "#ffffff";
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
                                      minWidth: 40,
                                      borderRadius: 4
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
                            {publicHolidays.map((h, index) => {
                              const isMandatory =
                                h?.type === "MANDATORY_PUBLIC" ||
                                h?.isMandatory ||
                                h?.kind === "MANDATORY";
                              const isOptional =
                                h?.type === "OPTIONAL_PUBLIC" ||
                                h?.isOptional ||
                                h?.kind === "OPTIONAL";

                              const taken =
                                h?.taken === "TAKEN" ||
                                  h?.takenStatus === "TAKEN" ||
                                  h?.defaultTaken
                                  ? "TAKEN"
                                  : "NOT_TAKEN";

                              return (
                                <tr key={h?.dateKey || `holiday-${index}`}>
                                  <td>{h?.dateLabel || h?.dateKey}</td>
                                  <td>{h?.name}</td>
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

                <div className="card table-shadow-card">
                  <div className="card-header-row">
                    <h2>Attendance Report</h2>
                    <ExportToExcel
                      data={getAttendanceExportData()}
                      filename={`Attendance_Report_${monthLabel.replace(', ', '_')}.xlsx`}
                      sheetName="Attendance"
                      buttonText="Export to Excel"
                    />
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
                          <th>Extra Hours</th>
                          <th>Manager Decision</th>
                          <th>Note / Extra Work</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timesheetRows.map((a, index) => {
                          const rowExtraHours = a?.extraHours || 0;

                          return (
                            <tr key={a?._id || `attendance-${index}`}>
                              <td>{a?.date}</td>
                              <td>{normalizeAttendanceStatus(a)}</td>
                              <td>{a?.workInTime}</td>
                              <td>{a?.workOutTime}</td>
                              <td>{a?.workedHours?.toFixed(1) || 0}</td>
                              <td>
                                {rowExtraHours > 0 ? `${rowExtraHours.toFixed(1)} hrs` : "-"}
                              </td>
                              <td>{a?.managerDecision?.status || "-"}</td>
                              <td>
                                {a?.status === "COMPOFF" && a?.extraWork ? (
                                  <>
                                    Extra: {a.extraWork.hours} hrs on{" "}
                                    {a.extraWork.workedDate}{" "}
                                    {a.extraWork.workedTime} → Comp-off{" "}
                                    {a.extraWork.compOffDate}{" "}
                                    {a.extraWork.compOffTime}
                                  </>
                                ) : (
                                  a?.note || "-"
                                )}
                              </td>
                            </tr>
                          );
                        })}
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
                    {monthYearSelect}
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
                          <th>Extra Hours</th>
                          <th>Manager Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timesheetRows.map((r, index) => (
                          <tr key={r?._id || `timesheet-${index}`}>
                            <td>{r?.date}</td>
                            <td>{normalizeAttendanceStatus(r)}</td>
                            <td>{r?.workInTime}</td>
                            <td>{r?.workOutTime}</td>
                            <td>{r?.workedHours?.toFixed(1) || 0}</td>
                            <td>{r?.extraHours > 0 ? `${r.extraHours.toFixed(1)} hrs` : "-"}</td>
                            <td>{r?.managerDecision?.status || "-"}</td>
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
                    {sharedMetrics.extraHours > 0 && (
                      <span style={{ marginLeft: '10px', color: '#d48806' }}>
                        Extra hours this month: <strong>{sharedMetrics.extraHours.toFixed(1)} hrs</strong>
                      </span>
                    )}
                  </p>
                </div>
              </section>
            </main>
          )}

          {/* PROJECTS TAB */}
          {activeTab === "projects" && (
            <main className="layout single-column">
              <section className="full-width">
                {/* PROJECT SELECTION SECTION */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>My Assigned Projects</h2>
                    <ExportToExcel
                      data={getProjectsExportData()}
                      filename={`My_Projects_${new Date().toISOString().split('T')[0]}.xlsx`}
                      sheetName="Projects"
                      buttonText="Export to Excel"
                    />
                  </div>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Project Name</th>
                          <th>Status</th>
                          <th>Total Estimated Hours</th>
                          <th>Balance Hours</th>
                          <th>My Role</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(myProjects) && myProjects.length > 0 ? (
                          myProjects.map((project, index) => (
                            <tr key={project?._id || `project-${index}`}>
                              <td>
                                <strong>{project?.name}</strong>
                                {project?.code && ` (${project.code})`}
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                  {project?.description || 'No description'}
                                </div>
                              </td>
                              <td>
                                <ProjectStatusBadge status={project?.status} />
                              </td>
                              <td>{project?.totalEstimatedHours || 0} hrs</td>
                              <td>
                                <span style={{
                                  color: project?.balanceHours < 0 ? '#ff4d4f' :
                                    project?.balanceHours < (project?.totalEstimatedHours * 0.1) ? '#fa8c16' : '#52c41a',
                                  fontWeight: 'bold'
                                }}>
                                  {project?.balanceHours || 0} hrs
                                </span>
                              </td>
                              <td>
                                {getMyRoleFromProject(project, user?._id) || "Not assigned"}
                              </td>
                              <td>
                                <button
                                  onClick={() => handleProjectSelect(project)}
                                  className="primary-btn small-btn"
                                  style={{ padding: '4px 8px', fontSize: '12px' }}
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                              <p className="empty">No projects assigned to you yet.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SELECTED PROJECT DETAILS */}
                {selectedProject && (
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h2>Project: {selectedProject?.name} {selectedProject?.code && `(${selectedProject.code})`}</h2>
                      <ProjectStatusBadge status={selectedProject?.status} />
                    </div>

                    <BalanceDisplay
                      balance={selectedProject?.balanceHours || 0}
                      estimated={selectedProject?.totalEstimatedHours || 0}
                      consumed={selectedProject?.consumedHours || 0}
                    />

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '15px',
                      marginBottom: '20px'
                    }}>
                      <div style={{ padding: '10px', backgroundColor: '#f0f5ff', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Start Date</div>
                        <div style={{ fontWeight: 'bold' }}>
                          {selectedProject?.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : 'Not set'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', backgroundColor: '#f6ffed', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>End Date</div>
                        <div style={{ fontWeight: 'bold' }}>
                          {selectedProject?.endDate ? new Date(selectedProject.endDate).toLocaleDateString() : 'Not set'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', backgroundColor: '#fff7e6', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>My Role</div>
                        <div style={{ fontWeight: 'bold' }}>
                          {getMyRoleFromProject(selectedProject, user?._id) || "Not assigned"}
                        </div>
                      </div>
                    </div>

                    {/* PROJECT TASKS - UPDATED FIELD NAMES */}
                    <h3>Tasks in this Project</h3>
                    <div className="table-wrapper small-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Requirement</th>
                            <th>Status</th>
                            <th>Est. Hours</th>
                            <th>Priority</th>
                            <th>Created By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.isArray(projectTasks) && projectTasks.length > 0 ? (
                            projectTasks.map((task, index) => (
                              <tr key={task?._id || `project-task-${index}`}>
                                <td style={{ maxWidth: '300px', whiteSpace: 'pre-wrap' }}>
                                  {task?.requirement || task?.recentRequirement}
                                </td>
                                <td>{task?.status}</td>
                                <td>{task?.estHours || task?.estimateHours || 0} hrs</td>
                                <td>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    backgroundColor: priorityColors[task?.clientPriority]?.color || '#d9d9d9',
                                    color: '#fff'
                                  }}>
                                    {task?.clientPriority}
                                  </span>
                                </td>
                                <td>{task?.createdByUserId?.fullName || 'Unknown'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                                <p className="empty">No tasks created for this project yet.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {selectedProject?.balanceHours < 0 && (
                      <div style={{
                        marginTop: '15px',
                        padding: '10px',
                        backgroundColor: '#fff2f0',
                        border: '1px solid #ffccc7',
                        borderRadius: '6px',
                        color: '#ff4d4f'
                      }}>
                        ⚠️ <strong>Project Exceeded Estimated Hours</strong>
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
                          This project has exceeded its estimated hours by <strong>{Math.abs(selectedProject.balanceHours)} hours</strong>.
                          Manager must add delay reason before completing the project.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* TASK CREATION FORM - UPDATED WITH CORRECT FIELD NAMES */}
                <div className="card">
                  <h2>
                    {editingTaskId
                      ? "Update Task / Requirement"
                      : "Add Project Task / Requirement"}
                  </h2>
                  {taskError && (
                    <div className="error-message" style={{
                      backgroundColor: '#fff2f0',
                      border: '1px solid #ffccc7',
                      padding: '10px',
                      borderRadius: '4px',
                      marginBottom: '15px',
                      color: '#ff4d4f'
                    }}>
                      {taskError}
                    </div>
                  )}

                  {/* PROJECT SELECTION WARNING */}
                  {Array.isArray(projects) && projects.length === 0 && (
                    <div style={{
                      padding: '10px',
                      backgroundColor: '#fff7e6',
                      border: '1px solid #ffe58f',
                      borderRadius: '6px',
                      marginBottom: '15px',
                      color: '#d48806'
                    }}>
                      ⚠️ <strong>No Approved Projects Available</strong>
                      <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
                        You need at least one APPROVED project to create tasks.
                        Please contact your manager to approve your assigned projects.
                      </p>
                    </div>
                  )}

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
                        required
                        disabled={Array.isArray(projects) && projects.length === 0}
                      >
                        <option value="">-- Select project --</option>
                        {Array.isArray(projects) && projects
                          .map((p, index) => (
                            <option key={p?._id || `project-option-${index}`} value={p?._id}>
                              {p?.name} ({p?.status})
                            </option>
                          ))}
                      </select>
                      {Array.isArray(projects) && projects.length === 0 && (
                        <div style={{ fontSize: '12px', color: '#fa8c16', marginTop: '5px' }}>
                          No approved projects available for task creation
                        </div>
                      )}
                    </label>

                    {/* Check if user has role in selected project */}
                    {/* {taskForm.projectId && (
                      (() => {
                        const selectedProj = Array.isArray(projects) ? projects.find(p => p?._id === taskForm.projectId) : null;
                        const myRole = selectedProj ? getMyRoleFromProject(selectedProj, user?._id) : null;

                        if (selectedProj && !myRole) {
                          return (
                            <div className="full-row" style={{
                              padding: '10px',
                              backgroundColor: '#fff7e6',
                              border: '1px solid #ffe58f',
                              borderRadius: '6px',
                              marginBottom: '15px',
                              color: '#d48806'
                            }}>
                              ⚠️ <strong>No Role Assigned</strong>
                              <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
                                You are not assigned any role in project "{selectedProj.name}".
                                Please contact your manager to get assigned a role before creating tasks.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()
                    )} */}

                    <label className="full-row">
                      Requirement
                      <textarea
                        rows={3}
                        value={taskForm.requirement} // UPDATED: was recentRequirement
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            requirement: e.target.value // UPDATED: was recentRequirement
                          })
                        }
                        placeholder="Enter requirement details (supports long text)..."
                        required
                      />
                    </label>

                    <label>
                      Requirement Type
                      <select
                        value={taskForm.type} // UPDATED: was requirementType
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            type: e.target.value // UPDATED: was requirementType
                          })
                        }
                      >
                        <option value="NEW">New</option>
                        <option value="OLD">Old</option>
                        <option value="BUG">Bug</option>
                      </select>
                    </label>

                    <label>
                      Requirement Role
                      <select
                        value={taskForm.requirementRole}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            requirementRole: e.target.value
                          })
                        }
                        required
                      >
                        <option value="DEVELOPER">Developer</option>
                        <option value="DEVOPS">DevOps</option>
                        <option value="QA">QA/Tester</option>
                        <option value="TESTER">Tester</option>
                        <option value="PRODUCT_MANAGER">Product Manager</option>
                        <option value="TECH_LEAD">Tech Lead</option>
                        <option value="SUPPORT">Support</option>
                        <option value="OTHER">Other</option>
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
                        value={toInputDate(taskForm.startDate)} // UPDATED: was originalClosureDate
                        onChange={(e) => {
                          const value = fromInputDate(e.target.value);
                          setTaskForm((prev) => {
                            const workingDays =
                              computeWorkingDaysExcludingHolidays(
                                value,
                                prev.closeDate // UPDATED: was estimatedDate
                              );
                            return {
                              ...prev,
                              startDate: value, // UPDATED: was originalClosureDate
                              workingDays: workingDays // UPDATED: was noOfDays
                            };
                          });
                        }}
                      />
                    </label>

                    <label>
                      Close Date
                      <input
                        type="date"
                        value={toInputDate(taskForm.closeDate)} // UPDATED: was estimatedDate
                        onChange={(e) => {
                          const value = fromInputDate(e.target.value);
                          setTaskForm((prev) => {
                            const workingDays =
                              computeWorkingDaysExcludingHolidays(
                                prev.startDate, // UPDATED: was originalClosureDate
                                value
                              );
                            return {
                              ...prev,
                              closeDate: value, // UPDATED: was estimatedDate
                              workingDays: workingDays // UPDATED: was noOfDays
                            };
                          });
                        }}
                      />
                    </label>

                    <label>
                      Working Days
                      <input
                        type="number"
                        value={taskForm.workingDays} // UPDATED: was noOfDays
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            workingDays: Number(e.target.value) // UPDATED: was noOfDays
                          })
                        }
                        min="0"
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
                            estHours: // UPDATED: was hoursAllocated
                              PRIORITY_DEFAULT_HOURS[value] ??
                              prev.estHours
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
                        value={taskForm.estHours} // UPDATED: was hoursAllocated
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            estHours: Number(e.target.value) // UPDATED: was hoursAllocated
                          })
                        }
                        min="0"
                        step="0.5"
                        required
                      />
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                        Note: These hours will reduce the project balance when task is approved
                      </div>
                    </label>

                    <label>
                      Created By
                      <input
                        type="text"
                        value={user?.fullName || user?.email || ''}
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
                      <button
                        type="submit"
                        className="primary-btn"
                        disabled={Array.isArray(projects) && projects.length === 0}
                      >
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

                {/* ALL MY TASKS - UPDATED FIELD NAMES */}
                <div className="card">
                  <div className="card-header-row">
                    <h2>All My Tasks ({Array.isArray(filteredTasks) ? filteredTasks.length : 0} of {Array.isArray(tasks) ? tasks.length : 0})</h2>
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
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
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
                        onClick={() => {
                          setSearchTerm("");
                          setFilteredTasks(tasks);
                        }}
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
                    <ExportToExcel
                      data={getTasksExportData()}
                      filename={`My_Tasks_${new Date().toISOString().split('T')[0]}.xlsx`}
                      sheetName="Tasks"
                      buttonText="Export to Excel"
                    />
                  </div>

                  <div style={{
                    marginBottom: '15px',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center'
                  }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Search tasks by requirement, project, status..."
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 35px',
                          borderRadius: '4px',
                          border: '1px solid #d9d9d9',
                          fontSize: '14px'
                        }}
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                      />
                      <div style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#999'
                      }}>
                        🔍
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setFilteredTasks(Array.isArray(tasks) ? tasks : []);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: searchTerm ? '#ff4d4f' : '#d9d9d9',
                        color: searchTerm ? 'white' : '#666',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {searchTerm ? 'Clear Search' : 'Reset'}
                    </button>
                  </div>

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
                          <th>Est. Hrs</th>
                          <th>Client Priority</th>
                          <th>Given By</th>
                          <th>Created By</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(filteredTasks) &&
                          filteredTasks.map((t, index) => {
                            if (!t) return null;

                            const meta = priorityColors[t?.clientPriority] || null;
                            const givenBy =
                              (t?.givenBy || t?.prioritySource || "")
                                .replace(/_/g, " ")
                                .toLowerCase()
                                .replace(/\b\w/g, (c) => c.toUpperCase()) || "-";

                            const canEdit = (() => {
                              const userRole = user?.role;
                              const createdByRole = t?.createdByRole;
                              const createdById = t?.createdByUserId?._id || t?.createdByUserId;
                              const userId = user?._id || user?.id;

                              if (userRole === "admin") return false;
                              if (userRole === "employee") {
                                return createdByRole === "employee" && createdById === userId;
                              }
                              if (userRole === "manager" && createdByRole === "employee") {
                                return true;
                              }
                              if (userRole === "manager" && createdByRole === "manager") {
                                return createdById === userId;
                              }
                              return false;
                            })();

                            return (
                              <tr key={t?._id || `task-${index}`}>
                                <td>{index + 1}</td>
                                <td>{t?.projectId?.name || "-"}</td>
                                {/* <td>
                                  {t?.projectId?.status && (
                                    <ProjectStatusBadge status={t.projectId.status} />
                                  )}
                                </td> */}
                                <td style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                                  {t?.requirement || t?.recentRequirement || t?.title} {/* UPDATED: handle both old and new */}
                                </td>
                                <td>{t?.type || t?.requirementType || "NEW"}</td> {/* UPDATED: handle both old and new */}
                                <td>{t?.status}</td>
                                <td>{t?.scope || "-"}</td>
                                <td>{t?.discussedDate || "-"}</td>
                                <td>{Number(t?.estHours || t?.estimateHours || 0)}</td> {/* UPDATED: handle both old and new */}
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
                                    t?.clientPriority || "-"
                                  )}
                                </td>
                                <td>{givenBy}</td>
                                <td>{t?.createdByUserId?.fullName || "-"}</td>
                                
  <td style={{ textAlign: "center" }}>
  {canEdit && (
    <button
      type="button"
      onClick={() => startEditTask(t)}
      title="Edit Task"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#1890ff",
        fontSize: "16px",
        padding: 0
      }}
    >
      <FaEdit />
    </button>
  )}
</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                    {filteredTasks.length === 0 && (
                      <p className="empty">
                        {searchTerm
                          ? `No tasks found matching "${searchTerm}"`
                          : "No tasks yet. Manager can allocate tasks to you, and you can create your own above."}
                      </p>
                    )}
                    {searchTerm && filteredTasks.length > 0 && (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px',
                        backgroundColor: '#e6f7ff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center',
                        color: '#1890ff'
                      }}>
                        Found {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} matching "{searchTerm}"
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* PAYSLIPS TAB */}
          {activeTab === "payslips" && (
            <main className="layout single-column">
              <section className="full-width">
                <div className="card">
                  <h2>My Payslips</h2>

                  {payslips.length === 0 ? (
                    <p className="empty">No payslips generated yet.</p>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Month</th>
                            <th>Year</th>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payslips.map((p, index) => (
                            <tr key={p?._id || `payslip-${index}`}>
                              <td>{monthNames[p?.month - 1]}</td>
                              <td>{p?.year}</td>
                              <td>{p?.employeeId || user?.employeeId || "N/A"}</td>
                              <td>{user?.fullName}</td>
                              <td>
                                <span className="status-badge active">
                                  GENERATED
                                </span>
                              </td>
                              <td>
                                <button
                                  className="primary-btn small-btn"
                                  onClick={() => handleDownloadPayslip(p._id, p.month, p.year)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <FaDownload /> Download
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card" style={{ marginTop: '16px' }}>
                  <h3>Payslip Information</h3>
                  <div className="note">
                    <p>• Payslips are generated by Manager at the end of each month</p>
                    <p>• Download the PDF to view complete salary details including Basic Pay, Allowances, Deductions, and Net Pay</p>
                    <p>• The PDF format matches the professional payslip shown to Manager</p>
                    <p>• Contact HR/Manager if you have any questions about your payslip</p>
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
                    {monthYearSelect}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: 12,
                      fontSize: 13
                    }}
                  >
                    <div className="mini-kpi">
                      <strong>Present Days</strong>
                      <div>{sharedMetrics.presentDays}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Half Days</strong>
                      <div>{sharedMetrics.halfDays}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Leaves Taken</strong>
                      <div>{sharedMetrics.leavesTaken}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Hours Worked</strong>
                      <div>{sharedMetrics.hoursWorked}</div>
                    </div>
                    <div className="mini-kpi">
                      <strong>Pending Requests</strong>
                      <div>{sharedMetrics.pendingRequests}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#fff3cd", borderColor: "#ffeaa7" }}>
                      <strong>Extra Hours</strong>
                      <div>{sharedMetrics.extraHours.toFixed(1)}</div>
                    </div>
                    <div className="mini-kpi" style={{ background: "#d4edda", borderColor: "#c3e6cb" }}>
                      <strong>Comp-off Balance</strong>
                      <div>{compOffBalance}</div>
                    </div>
                  </div>
                </div>

                <div className="card table-shadow-card">
                  <div className="card-header-row">
                    <h2>Attendance Report</h2>
                    <ExportToExcel
                      data={getAttendanceExportData()}
                      filename={`Dashboard_Attendance_${monthLabel.replace(', ', '_')}.xlsx`}
                      sheetName="Attendance"
                      buttonText="Export to Excel"
                    />
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
                          <th>Extra Hours</th>
                          <th>Manager Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timesheetRows.map((r, index) => (
                          <tr key={r?._id || `dashboard-attendance-${index}`}>
                            <td>{r?.date}</td>
                            <td>{r?.status}</td>
                            <td>{r?.workInTime}</td>
                            <td>{r?.workOutTime}</td>
                            <td>{r?.workedHours?.toFixed(1) || 0}</td>
                            <td>{r?.extraHours > 0 ? `${r.extraHours.toFixed(1)} hrs` : "-"}</td>
                            <td>{r?.managerDecision?.status || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {timesheetRows.length === 0 && (
                      <p className="empty">No data for {monthLabel}</p>
                    )}
                  </div>
                </div>

                <div className="card table-shadow-card">
                  <h2>Leave & Balance Summary</h2>
                  <table className="leave-summary-table-compact">
                    <tbody>
                      <tr>
                        <td>Total Leave Entitlement</td>
                        <td>{summary?.totalLeaveEntitlement || 0}</td>
                      </tr>
                      <tr>
                        <td>Public Holidays</td>
                        <td>{summary?.publicHolidays || 0}</td>
                      </tr>
                      <tr>
                        <td>Weekend Holidays</td>
                        <td>{summary?.weekendHolidays || 0}</td>
                      </tr>
                      <tr>
                        <td>2025 Carry Forward Leaves</td>
                        <td>{summary?.carryForward2025 || 0}</td>
                      </tr>
                      <tr>
                        <td>Leaves Taken</td>
                        <td>{summary?.leavesTaken || 0}</td>
                      </tr>
                      <tr className="highlight">
                        <td>Balance Leaves</td>
                        <td>{summary?.balanceLeaves || 0}</td>
                      </tr>
                      <tr>
                        <td>Total Half Days</td>
                        <td>{summary?.totalHalfDays || 0}</td>
                      </tr>
                      <tr>
                        <td>Balance After Half Days</td>
                        <td>{summary?.balanceAfterHalfDays || 0}</td>
                      </tr>
                      <tr style={{ background: "#fff3cd" }}>
                        <td><strong>Extra Hours Balance</strong></td>
                        <td><strong>{sharedMetrics.extraHours.toFixed(1)} hrs</strong></td>
                      </tr>
                      <tr style={{ background: "#d4edda" }}>
                        <td><strong>Comp-off Balance</strong></td>
                        <td><strong>{compOffBalance} days</strong></td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="note" style={{ marginTop: 12, fontSize: 12 }}>
                    This is a read-only report. Any change will be done by the Manager from their dashboard.
                  </p>
                </div>

                {/* PROJECT SUMMARY IN DASHBOARD */}
                <div className="card table-shadow-card">
                  <div className="card-header-row">
                    <h2>My Projects Summary</h2>
                    <ExportToExcel
                      data={getProjectsExportData().slice(0, 5)}
                      filename={`Dashboard_Projects_${new Date().toISOString().split('T')[0]}.xlsx`}
                      sheetName="Projects"
                      buttonText="Export to Excel"
                    />
                  </div>
                  <div className="table-wrapper small-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Status</th>
                          <th>Estimated Hours</th>
                          <th>Balance Hours</th>
                          <th>My Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(myProjects) && myProjects.length > 0 ? (
                          myProjects.slice(0, 5).map((project, index) => (
                            <tr key={project?._id || `dashboard-project-${index}`}>
                              <td>{project?.name}</td>
                              <td>
                                <ProjectStatusBadge status={project?.status} />
                              </td>
                              <td>{project?.totalEstimatedHours || 0} hrs</td>
                              <td>
                                <span style={{
                                  color: project?.balanceHours < 0 ? '#ff4d4f' :
                                    project?.balanceHours < (project?.totalEstimatedHours * 0.1) ? '#fa8c16' : '#52c41a',
                                  fontWeight: 'bold'
                                }}>
                                  {project?.balanceHours || 0} hrs
                                </span>
                              </td>
                              <td>{getMyRoleFromProject(project, user?._id) || "Not assigned"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                              <p className="empty">No projects assigned to you yet.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {Array.isArray(myProjects) && myProjects.length > 5 && (
                    <p className="note" style={{ marginTop: 10 }}>
                      Showing 5 of {myProjects.length} projects. Go to "Project Management" tab for complete view.
                    </p>
                  )}
                </div>
              </section>
            </main>
          )}
        </div>
      </div>

      {/* Add CSS for notifications and UI fixes */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .notification-center {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .notification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
            color: white;
            border-bottom: 1px solid #e8e8e8;
          }
          
          .notification-title {
            display: flex;
            align-items: center;
            font-size: 16px;
            font-weight: 600;
          }
          
          .notification-badge {
            background: #ff4d4f;
            color: white;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 10px;
            margin-left: 8px;
          }
          
          .notification-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .notification-action-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s;
          }
          
          .notification-action-btn:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          
          .notification-action-btn.delete {
            background: rgba(255, 77, 79, 0.3);
            border-color: rgba(255, 77, 79, 0.5);
          }
          
          .notification-action-btn.delete:hover {
            background: rgba(255, 77, 79, 0.5);
          }
          
          .notification-close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
          }
          
          .notification-close-btn:hover {
            background: rgba(255, 255, 255, 0.2);
          }
          
          .notification-list {
            max-height: 400px;
            overflow-y: auto;
            padding: 8px;
          }
          
          .notification-item {
            display: flex;
            align-items: flex-start;
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 8px;
            border: 1px solid #e8e8e8;
            transition: all 0.2s;
            animation: slideDown 0.3s ease-out;
          }
          
          .notification-item.unread {
            border-left: 3px solid #1890ff;
          }
          
          .notification-item:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
          }
          
          .notification-icon {
            margin-right: 12px;
            margin-top: 2px;
            font-size: 16px;
          }
          
          .notification-content {
            flex: 1;
            min-width: 0;
          }
          
          .notification-message {
            font-size: 13px;
            line-height: 1.4;
            color: #262626;
            margin-bottom: 4px;
          }
          
          .notification-meta {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: #8c8c8c;
          }
          
          .notification-category {
            background: #f5f5f5;
            padding: 1px 6px;
            border-radius: 10px;
            font-weight: 500;
          }
          
          .notification-item-actions {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-left: 8px;
          }
          
          .notification-item-btn {
            background: none;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            color: #8c8c8c;
          }
          
          .notification-item-btn:hover {
            background: #f5f5f5;
          }
          
          .notification-item-btn.view {
            color: #1890ff;
            border-color: #91d5ff;
          }
          
          .notification-item-btn.delete {
            color: #ff4d4f;
            border-color: #ffccc7;
          }
          
          .notification-footer {
            padding: 12px 20px;
            border-top: 1px solid #e8e8e8;
            text-align: center;
          }
          
          .notification-view-all-btn {
            background: #1890ff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          
          .notification-view-all-btn:hover {
            background: #096dd9;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
          }
          
          .no-notifications {
            text-align: center;
            padding: 40px 20px;
            color: #8c8c8c;
          }
          
          .no-notifications p {
            margin: 0;
          }
          
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #1890ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          
          /* Card Header Row with Export Button */
          .card-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
          }
          
          .card-header-row h2 {
            margin: 0;
          }
          
          /* Export Button Styles */
          .export-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background-color: #217346;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
          }
          
          .export-btn:hover {
            background-color: #1a5e38;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(33, 115, 70, 0.3);
          }
          
          /* Topbar Date/Time Display Fix */
          .topbar {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            height: 60px;
            background: white;
            border-bottom: 1px solid #e8e8e8;
            z-index: 100;
          }
          
          /* Table Responsive Fixes */
          .table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          .table-wrapper.small-table {
            max-height: 400px;
            overflow-y: auto;
          }
          
          table {
            min-width: 100%;
            border-collapse: collapse;
          }
          
          th {
            position: sticky;
            top: 0;
            background: #fafafa;
            z-index: 10;
          }
          
          /* Mini KPI Cards */
          .mini-kpi {
            background: #f5f5f5;
            border: 1px solid #e8e8e8;
            border-radius: 8px;
            padding: 12px 8px;
            text-align: center;
            transition: all 0.2s;
          }
          
          .mini-kpi:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          
          .mini-kpi strong {
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }
          
          .mini-kpi div {
            font-size: 18px;
            font-weight: 600;
            color: #262626;
          }
          
          /* Form Grid Improvements */
          .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
          }
          
          .full-row {
            grid-column: 1 / -1;
          }
          
          /* Badge Row */
          .badge-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
          }
          
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            background: #e6f7ff;
            color: #1890ff;
            font-size: 12px;
            font-weight: 500;
          }
          
          /* Date Input Wrapper */
          .date-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
          }
          
          .date-icon {
            position: absolute;
            left: 10px;
            color: #999;
          }
          
          .date-input-wrapper input {
            padding-left: 35px;
          }
          
          /* Comp-off Box */
          .compoff-box {
            background: #fff7e6;
            border: 1px solid #ffe58f;
            border-radius: 8px;
            padding: 16px;
          }
          
          .compoff-hint {
            font-size: 13px;
            font-weight: 600;
            color: #d48806;
            margin-bottom: 12px;
          }
          
          .compoff-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
          }
          
          /* Popup Overlay */
          .popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          
          .popup-content {
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          }
          
          /* Leave Summary Table */
          .leave-summary-table-compact {
            width: 100%;
            border-collapse: collapse;
          }
          
          .leave-summary-table-compact td {
            padding: 8px 12px;
            border-bottom: 1px solid #f0f0f0;
          }
          
          .leave-summary-table-compact tr.highlight {
            background: #f6ffed;
            font-weight: 600;
          }
          
          /* Holiday Calendar */
          .holiday-calendar {
            width: 100%;
            border-collapse: collapse;
          }
          
          .holiday-calendar th {
            background: #fafafa;
            padding: 8px;
            text-align: center;
            font-size: 12px;
          }
          
          .holiday-cell {
            padding: 8px;
            text-align: center;
            font-size: 13px;
            transition: all 0.2s;
          }
          
          .holiday-cell:hover {
            transform: scale(1.05);
            z-index: 5;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          .holiday-cell.empty {
            background: #fafafa;
          }
          
          /* Responsive Fixes */
          @media (max-width: 1200px) {
            .layout {
              flex-direction: column;
            }
            
            .left-column,
            .right-column {
              width: 100%;
            }
          }
          
          @media (max-width: 768px) {
            .topbar {
              flex-wrap: wrap;
              height: auto;
              padding: 10px;
            }
            
            .form-grid {
              grid-template-columns: 1fr;
            }
            
            .card-header-row {
              flex-direction: column;
              align-items: flex-start;
            }
          }
        `}
      </style>
    </div>
  );
}