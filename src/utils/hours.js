// attendance-frontend/src/utils/hours.js

// Calculate hours from attendance records
// Full day = 8 hours, half day = 4 hours, others = 0.
const HALF_DAY_STATUSES = [
  "PRESENT HALF DAY",
  "Half Day - Fun Thursday",
  "Half Day- Development"
];

export function calculateProjectHours(records = []) {
  let totalHours = 0;
  const daily = records.map((r) => {
    let hours = 0;

    if (r.status === "PRESENT FULL DAY" || r.status === "COMPOFF") {
      hours = 8;
    } else if (HALF_DAY_STATUSES.includes(r.status)) {
      hours = 4;
    } else {
      hours = 0; // leaves / holidays don't change estimate
    }

    totalHours += hours;
    return { ...r, projectHours: hours };
  });

  return { totalHours, daily };
}
