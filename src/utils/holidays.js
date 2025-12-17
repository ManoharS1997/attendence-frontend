// attendance-frontend/src/utils/holidays.js

const MONTH_NAMES = [
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

// Static public holidays (example based on your sheet + main Indian ones)
const STATIC_PUBLIC_HOLIDAYS = [
  // ---- JAN ----
  { month: 1, day: 14, name: "Pongal", mandatory: false },
  { month: 1, day: 26, name: "Republic Day", mandatory: true },

  // ---- FEB ----
  { month: 2, day: 16, name: "Maha Shivaratri", mandatory: false },

  // ---- MAR ----
  { month: 3, day: 19, name: "Ugadi", mandatory: false },
  { month: 3, day: 21, name: "Ramzan", mandatory: false },

  // ---- AUG ----
  { month: 8, day: 15, name: "Independence Day", mandatory: true },
  { month: 8, day: 16, name: "Janmashtami", mandatory: false },
  { month: 8, day: 26, name: "Sri Rama Navami", mandatory: false },
  { month: 8, day: 27, name: "Ganesh Chaturthi", mandatory: false },

  // ---- OCT ----
  { month: 10, day: 2, name: "Gandhi Jayanti / Vijaya Dashami", mandatory: true },
  { month: 10, day: 20, name: "Diwali", mandatory: false },

  // ---- DEC ----
  { month: 12, day: 25, name: "Christmas Day", mandatory: false }
];

/**
 * Build a holiday calendar for a month/year.
 * settings = [{ dateKey: "YYYY-MM-DD", status: "TAKEN" | "NOT_TAKEN" }]
 */
export function buildHolidayCalendar(month, year, settings = []) {
  const y = Number(year);
  const m = Number(month); // 1-12
  const daysInMonth = new Date(y, m, 0).getDate();

  const map = {};

  // 1) Weekend holidays: all Sundays + 2nd Saturday
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(y, m - 1, d);
    const weekday = date.getDay(); // 0 Sun..6 Sat
    const weekIndex = Math.floor((d - 1) / 7);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;

    let isWeekend = false;
    let name = "";

    if (weekday === 0) {
      isWeekend = true;
      name = "Sunday";
    } else if (weekday === 6 && weekIndex === 1) {
      isWeekend = true;
      name = "2nd Saturday";
    }

    if (isWeekend) {
      map[dateKey] = {
        date,
        dateKey,
        year: yyyy,
        month: date.getMonth() + 1,
        day: date.getDate(),
        name,
        type: "WEEKEND",
        kind: "WEEKEND",
        isMandatory: false,
        isOptional: false,
        dateLabel: `${dd} ${MONTH_NAMES[m - 1]} ${yyyy}`
      };
    }
  }

  // 2) Static public holidays for that month
  STATIC_PUBLIC_HOLIDAYS.filter((h) => h.month === m).forEach((h) => {
    const date = new Date(y, m - 1, h.day);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const isMandatory = !!h.mandatory;
    const type = isMandatory ? "MANDATORY_PUBLIC" : "OPTIONAL_PUBLIC";

    map[dateKey] = {
      ...(map[dateKey] || {}),
      date,
      dateKey,
      year: yyyy,
      month: date.getMonth() + 1,
      day: date.getDate(),
      name: h.name,
      type,
      kind: isMandatory ? "MANDATORY" : "OPTIONAL",
      isMandatory,
      isOptional: !isMandatory,
      dateLabel: `${dd} ${MONTH_NAMES[m - 1]} ${yyyy}`,
      defaultTaken: false
    };
  });

  // 3) Merge settings (TAKEN / NOT_TAKEN) for OPTIONAL_PUBLIC
  const settingsMap = settings.reduce((acc, s) => {
    if (s.dateKey) acc[s.dateKey] = s.status;
    return acc;
  }, {});

  Object.values(map).forEach((h) => {
    if (
      h.type === "OPTIONAL_PUBLIC" ||
      h.isOptional ||
      h.kind === "OPTIONAL"
    ) {
      h.taken = settingsMap[h.dateKey] || "NOT_TAKEN";
    } else {
      h.taken = "TAKEN"; // weekends + mandatory considered taken by definition
    }
  });

  // 4) Return sorted list
  const list = Object.values(map).sort((a, b) => a.date - b.date);
  return list;
}
