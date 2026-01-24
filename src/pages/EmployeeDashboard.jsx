import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import ChangePasswordCard from "../components/ChangePasswordCard";
import logo from "../assets/Company Logo.png";
import { buildHolidayCalendar } from "../utils/holidays";
import "../../styles/employeeDashboard.css";
import { FaEdit } from "react-icons/fa";
import { FaCalendarAlt } from "react-icons/fa";


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

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayInfo(getTodayInfo());
      setTagline(getTaglineOfTheDay());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [getTaglineOfTheDay]);

  const [activeTab, setActiveTab] = useState("timesheet");
  const [{ month, year }, setMonthYear] = useState(getCurrentMonth());

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
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [payslips, setPayslips] = useState([]);
  const [loadingSave, setLoadingSave] = useState(false);
  const [lastAlertAttendanceId, setLastAlertAttendanceId] = useState(null);
  const [taskError, setTaskError] = useState("");

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

  const loadDashboard = useCallback(async () => {
  const res = await api.get("/utils/dashboard");

  setSharedMetrics({
    presentDays: res.data.attendance.presentDays,
    halfDays: res.data.attendance.halfDays,
    leavesTaken: res.data.attendance.leaveDays,
    hoursWorked: res.data.timesheet.totalHoursWorked,
    pendingRequests: 0,
    extraHours: res.data.timesheet.totalExtraHours,
    compOffRequests: 0
  });

  setCompOffBalance(res.data.leaveBalance.compOff || 0);
}, []);


  const loadAttendance = useCallback(async (selectedMonth = month, selectedYear = year) => {
    const res = await api.get("/attendance/my", {
      params: { month: selectedMonth, year: selectedYear }
    });
    setAttendance([...(res.data || [])]);
  }, [month, year]);

  const loadSummary = useCallback(async (selectedMonth = month, selectedYear = year) => {
    const res = await api.get("/leave/summary/me", { params: { month: selectedMonth, year: selectedYear } });
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
      const tasksData = res.data || [];
      setTasks(tasksData);
      setFilteredTasks(tasksData);
      setSearchTerm("");
    } catch (error) {
      console.error("Error loading my tasks", error?.response || error);
      setTasks([]);
      setFilteredTasks([]);
    }
  }, []);

  const loadPayslips = useCallback(async () => {
    try {
      const res = await api.get("/payslips/my");
      setPayslips(res.data || []);
    } catch (error) {
      console.error("Failed to load payslips", error);
      setPayslips([]);
    }
  }, []);

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
  loadAttendance();
  loadSummary();
  loadDashboard();
}, [loadAttendance, loadSummary, loadDashboard]);


  useEffect(() => {
    const checkBirthday = async () => {
      try {
        const isTestMode = import.meta.env.VITE_BIRTHDAY_TEST_MODE === "true";

        if (isTestMode) {
          setShowBirthdayBanner(true);
          setBirthdayManagerMessage(
            getManagementBirthdayMessage(user.fullName || "Team Member")
          );
          return;
        }

        const dismissed = sessionStorage.getItem("birthdayDismissed");
        if (dismissed) return;

        const res = await api.get("/birthday/today");

        if (res.data?.isBirthday) {
          setShowBirthdayBanner(true);
          setBirthdayManagerMessage(
            getManagementBirthdayMessage(user.fullName || "Team Member")
          );
        }
      } catch (err) {
        console.error("Birthday check failed", err);
      }
    };

    checkBirthday();
  }, [user.fullName]);

  useEffect(() => {
    const id = setInterval(() => {
      loadAttendance();
    }, 30000);
    return () => clearInterval(id);
  }, [loadAttendance]);

  useEffect(() => {
    loadProjects();
    loadTasks();
  }, [loadProjects, loadTasks]);

  useEffect(() => {
    if (activeTab === "payslips") {
      loadPayslips();
    }
  }, [activeTab, loadPayslips]);

  useEffect(() => {
    if (attendance.length === 0) {
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

      const isPresentLike =
        a.status === "PRESENT FULL DAY" || HALF_DAY_STATUSES.includes(a.status);
      const factor = HALF_DAY_STATUSES.includes(a.status) ? 0.5 : 1;
      const baseHours = diffHours(a.workInTime, a.workOutTime);
      const effective = isPresentLike ? baseHours * factor : 0;

      hoursWorked += effective;

      if (a.status === "PRESENT FULL DAY" && baseHours > 8) {
        extraHours += (baseHours - 8);
      }
      if (a.extraHours && a.extraHours > 0) {
        extraHours += a.extraHours;
      }
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

    const [_, mm, yyyy] = latest.date.split("-");
    if (`${mm}-${yyyy}` === `${month}-${year}`) {
      setTimeout(() => {
        alert(message);
      }, 100);
    }

    setLastAlertAttendanceId(latest._id);
  }, [attendance, lastAlertAttendanceId, month, year]);

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

      if (status === "PRESENT FULL DAY") {
        const hours = diffHours(workInTime, workOutTime);
        if (hours > 8) {
          payload.extraHours = hours - 8;
        }
      }

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

      await forceRefreshAll();

      if (APPROVAL_STATUSES.includes(status)) {
        alert(
          "Attendance / leave change sent to Manager for approval. It will reflect in your dashboard and project views after Manager approval."
        );
      } else {
        alert("Attendance saved successfully!");
      }

      setDate(formatToday());
      setStatus("PRESENT FULL DAY");
      setWorkInTime("10:00");
      setWorkOutTime("18:00");
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

  const timesheetRows = attendance.map((a) => {
    const isPresentLike =
      a.status === "PRESENT FULL DAY" || HALF_DAY_STATUSES.includes(a.status);
    const factor = HALF_DAY_STATUSES.includes(a.status) ? 0.5 : 1;
    const baseHours = diffHours(a.workInTime, a.workOutTime);
    const workedHours = isPresentLike ? baseHours * factor : 0;

    const extraHours = a.extraHours || ((a.status === "PRESENT FULL DAY" && baseHours > 8) ? baseHours - 8 : 0);

    return {
      ...a,
      workedHours,
      extraHours
    };
  });

  const totalTimesheetHours = timesheetRows.reduce(
    (sum, r) => sum + r.workedHours,
    0
  );

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
    setTaskError("");
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    setTaskError("");

    if (!taskForm.projectId) {
      setTaskError("Please select a project");
      return;
    }

    if (!taskForm.recentRequirement || taskForm.recentRequirement.trim().length === 0) {
      setTaskError("Please enter a requirement description");
      return;
    }

    if (!taskForm.hoursAllocated || taskForm.hoursAllocated <= 0) {
      setTaskError("Please enter estimated hours greater than 0");
      return;
    }

    const finalDays = taskForm.noOfDays || 0;

    try {
      const payload = {
        ...taskForm,
        projectId: taskForm.projectId,
        noOfDays: finalDays,
        estimateHours:
          Number(taskForm.hoursAllocated) > 0
            ? Number(taskForm.hoursAllocated)
            : PRIORITY_DEFAULT_HOURS[taskForm.clientPriority] || 8,
        assignedUserId: user._id || user.id,
        createdBy: editingTaskId ? undefined : (user.fullName || user.email)
      };

      if (!editingTaskId) {
        await api.post("/tasks", payload);
        alert("Task / requirement added successfully");
      } else {
        console.log("UPDATE PAYLOAD →", payload);
        await api.patch(`/tasks/${editingTaskId}`, payload);
        alert("Task updated successfully");
      }

      resetTaskForm(true);
      await loadTasks();

    } catch (error) {
      console.error("Employee create/update task error", error?.response || error);
      setTaskError(error.response?.data?.message || "Error saving task. Please check your input.");
    }
  };

  const startEditTask = (t) => {
    const canEdit = (() => {
      const userRole = user.role;
      const createdByRole = t.createdByRole;
      const createdById = t.createdByUserId?._id || t.createdByUserId;
      const userId = user._id || user.id;

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
        t.estimateHours ||
        PRIORITY_DEFAULT_HOURS[t.clientPriority || "P3"] ||
        8
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

    const employeeName = (user.fullName || "Employee").replace(/\s+/g, "_");
    const monthName = monthNames[month - 1];

    const link = document.createElement("a");
    link.href = url;
    link.download = `${employeeName}_${monthName}_${year}.pdf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading payslip:", error);
    alert("Failed to download payslip.");
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
                    🎉 Happy Birthday, {user.fullName}! 🎂
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
                        getManagementBirthdayMessage(user.fullName)}
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
                right: 400,
                top: "4.5%",
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
                animation: "fadeSlideIn 0.6s ease-out"
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0050b3",
                  letterSpacing: "0.3px"
                }}
              >
                {todayInfo.day}, {todayInfo.date} {todayInfo.month} {todayInfo.year}
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

            <div>
              <strong>{user.fullName}</strong> (Employee) — {user.email}
            </div>
            <button
              onClick={logout}
              className="outline-btn"
              style={{ marginLeft: 24 }}
            >
              Logout
            </button>
          </header>

          <NextMonthPopup />

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
                          value={toInputDate(date)}          // yyyy-mm-dd for browser
                          onChange={(e) => setDate(fromInputDate(e.target.value))} // back to dd-mm-yyyy
                          disabled={isSystemHoliday}
                        />
                      </div>
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

                {/* <div className="card table-shadow-card">
                  <h2 style={{ color: '#ffffff' }}>Leave & Balance Summary</h2>
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
                        <td>Carry Forward (2025)</td>
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
                </div> */}

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

                <div className="card table-shadow-card">
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
                          <th>Extra Hours</th>
                          <th>Manager Decision</th>
                          <th>Note / Extra Work</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timesheetRows.map((a) => {
                          const rowExtraHours = a.extraHours || 0;

                          return (
                            <tr key={a._id}>
                              <td>{a.date}</td>
                              <td>{a.status}</td>
                              <td>{a.workInTime}</td>
                              <td>{a.workOutTime}</td>
                              <td>{a.workedHours.toFixed(1)}</td>
                              <td>
                                {rowExtraHours > 0 ? `${rowExtraHours.toFixed(1)} hrs` : "-"}
                              </td>
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
                        {timesheetRows.map((r) => (
                          <tr key={r._id}>
                            <td>{r.date}</td>
                            <td>{r.status}</td>
                            <td>{r.workInTime}</td>
                            <td>{r.workOutTime}</td>
                            <td>{r.workedHours.toFixed(1)}</td>
                            <td>{r.extraHours > 0 ? `${r.extraHours.toFixed(1)} hrs` : "-"}</td>
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
                        required
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
                        min="0"
                        step="0.5"
                        required
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
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => (
                          <tr key={p._id}>
                            <td>{p.name}</td>
                            <td>{p.code || "-"}</td>
                            <td>{p.description || "-"}</td>
                            <td>{p.totalEstimatedHours || 355}</td>
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
                  <h2>My Tasks ({filteredTasks.length} of {tasks.length})</h2>

                  {/* 🔍 SEARCH FUNCTIONALITY */}
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
                        onChange={(e) => {
                          const term = e.target.value;
                          setSearchTerm(term);

                          if (term.trim() === '') {
                            setFilteredTasks(tasks);
                          } else {
                            const searchLower = term.toLowerCase();
                            const filtered = tasks.filter(task => {
                              const requirement = (task.recentRequirement || '').toLowerCase();
                              const project = (task.projectId?.name || '').toLowerCase();
                              const status = (task.status || '').toLowerCase();
                              const createdBy = (task.createdByUserId?.fullName || '').toLowerCase();
                              const clientPriority = (task.clientPriority || '').toLowerCase();

                              return requirement.includes(searchLower) ||
                                project.includes(searchLower) ||
                                status.includes(searchLower) ||
                                createdBy.includes(searchLower) ||
                                clientPriority.includes(searchLower);
                            });
                            setFilteredTasks(filtered);
                          }
                        }}
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
                        setFilteredTasks(tasks);
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
                        {filteredTasks.map((t, index) => {
                          const meta = priorityColors[t.clientPriority] || null;
                          const givenBy =
                            (t.prioritySource || "")
                              .replace(/_/g, " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase()) || "-";

                          const canEdit = (() => {
                            const userRole = user.role;
                            const createdByRole = t.createdByRole;
                            const createdById = t.createdByUserId?._id || t.createdByUserId;
                            const userId = user._id || user.id;

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
                            <tr key={t._id}>
                              <td>{index + 1}</td>
                              <td>{t.projectId?.name || "-"}</td>
                              <td style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                                {t.recentRequirement}
                              </td>
                              <td>{t.requirementType || "NEW"}</td>
                              <td>{t.status}</td>
                              <td>{t.scope || "-"}</td>
                              <td>{t.discussedDate || "-"}</td>
                              <td>{t.originalClosureDate || "-"}</td>
                              <td>{t.estimatedDate || "-"}</td>
                              <td>{t.noOfDays || 0}</td>
                              <td>{Number(t.estimateHours || 0)}</td>
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
                              <td>{t.createdByUserId?.fullName || "-"}</td>
                              <td style={{ textAlign: "center" }}>
                                {canEdit ? (
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
                                ) : (
                                  "-"
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
                          {payslips.map((p) => (
                            <tr key={p._id}>
                              <td>{monthNames[p.month - 1]}</td>
                              <td>{p.year}</td>
                              <td>{p.employeeId || user.employeeId || "N/A"}</td>
                              <td>{user.fullName}</td>
                              <td>
                                <span className="status-badge active">
                                  GENERATED
                                </span>
                              </td>
                              <td>
                                <button
                                  className="primary-btn small-btn"
                                  onClick={() => handleDownloadPayslip(p._id, p.month, p.year)}

                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                >
                                  Download
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
                          <th>Extra Hours</th>
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
                            <td>{r.workedHours.toFixed(1)}</td>
                            <td>{r.extraHours > 0 ? `${r.extraHours.toFixed(1)} hrs` : "-"}</td>
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
              </section>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}