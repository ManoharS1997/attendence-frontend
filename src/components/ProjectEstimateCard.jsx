import React, { useState, useMemo } from "react";

const PANELS = [
  "Summary",
  "Role Breakdown",
  "Timeline",
  "Module Breakdown"
];

const MVP_TIMELINE = [
  {
    week: "Week 1",
    title: "Auth & Setup",
    hours: "65–80 hrs",
    focus:
      "Focus on Authentication, company setup, user management and basic dashboards.",
    tasks: [
      "Frontend (25–30 hrs): Login, signup, password reset, role-based UI, layout.",
      "Backend (35–40 hrs): Multi-tenant auth, JWT, user/company CRUD, RBAC.",
      "Design (5–10 hrs): Wireframes and style guide."
    ]
  },
  {
    week: "Week 2",
    title: "Projects & Time Tracking",
    hours: "85–95 hrs",
    focus: "Project management and time tracking features.",
    tasks: [
      "Frontend (40–45 hrs): Project list/creation, assignment UI, timer, time logging, attendance.",
      "Backend (40–45 hrs): Project APIs, assignment APIs, time entry, attendance APIs.",
      "Design (5 hrs): Project & timesheet screens."
    ]
  },
  {
    week: "Week 3",
    title: "Timesheet & Budgets",
    hours: "90–100 hrs",
    focus: "Timesheet workflow and budget tracking.",
    tasks: [
      "Frontend (40–45 hrs): Weekly timesheets, manager approvals, notifications, budget progress UI.",
      "Backend (45–50 hrs): Timesheet logic, approvals, cost calc, budget engine, summary APIs.",
      "QA (5 hrs): Role testing & edge cases."
    ]
  },
  {
    week: "Week 4",
    title: "Dashboards & Launch",
    hours: "80–90 hrs",
    focus: "Final features, testing, and deployment.",
    tasks: [
      "Frontend (25–30 hrs): Dashboards, exports, polish.",
      "Backend (30–35 hrs): Reporting APIs, dashboard endpoints, deployment setup.",
      "QA (25–30 hrs): Full test and regression."
    ]
  }
];

const MVP_MODULES = [
  { name: "Authentication & Multi-Tenancy", hours: 40 },
  { name: "Company & User Management", hours: 30 },
  { name: "Project Module (type + budgets)", hours: 50 },
  { name: "Resource Assignment", hours: 22 },
  { name: "Time Tracking (manual + timer)", hours: 40 },
  { name: "Attendance", hours: 22 },
  { name: "Timesheet submission", hours: 35 },
  { name: "Manager approval workflow", hours: 40 },
  { name: "Budget & cost tracking", hours: 45 },
  { name: "Dashboards", hours: 30 },
  { name: "Reports", hours: 22 },
  { name: "QA & Deployment", hours: 45 }
];

export default function ProjectEstimateCard({
  project,
  breakdown,
  showMVPDetails = false
}) {
  const [openPanel, setOpenPanel] = useState("Summary");

  // ✅ SAFE DEFAULTS (hooks must run even if project is null)
  const totalEstimate = project?.totalEstimatedHours || 0;
  const used = breakdown?.used || 0;
  const remaining = totalEstimate - used;

  // ✅ Hooks MUST be unconditionally called
  const roleRows = useMemo(() => {
    if (!breakdown?.byRole) return [];
    return Object.entries(breakdown.byRole).map(([role, hours]) => ({
      role,
      hours
    }));
  }, [breakdown]);

  const mvpRoleEstimate = useMemo(
    () => [
      { role: "Frontend Developer", hours: 120 },
      { role: "Backend Developer", hours: 140 },
      { role: "UI/UX Designer", hours: 35 },
      { role: "QA Tester", hours: 40 },
      { role: "Project Manager", hours: 20 }
    ],
    []
  );

  const modulesWithRemaining = useMemo(() => {
    return MVP_MODULES.map((m) => {
      const ratio = m.hours / 355;
      const spent = used * ratio;
      const remainingModule = Math.max(0, m.hours - spent);
      return { ...m, remaining: remainingModule.toFixed(1) };
    });
  }, [used]);

  // ✅ EARLY RETURN ONLY AFTER ALL HOOKS
  if (!project) {
    return null;
  }

  const renderSummary = () => (
    <div className="estimate-section">
      <table className="estimate-table">
        <tbody>
          <tr>
            <td>Project</td>
            <td>{project.name}</td>
          </tr>
          <tr>
            <td>Start Date</td>
            <td>{project.startDate || "-"}</td>
          </tr>
          <tr>
            <td>End Date</td>
            <td>{project.endDate || "-"}</td>
          </tr>
          <tr>
            <td>Duration</td>
            <td>{project.durationMonths || 0} months</td>
          </tr>
          <tr>
            <td>Total Estimated Hours</td>
            <td>{totalEstimate} hrs</td>
          </tr>
          <tr>
            <td>Approved Worked Hours</td>
            <td>{used} hrs</td>
          </tr>
          <tr>
            <td><strong>Remaining</strong></td>
            <td>
              <strong style={{ color: remaining < 0 ? "red" : "inherit" }}>
                {remaining} hrs
              </strong>
            </td>
          </tr>
        </tbody>
      </table>

      {remaining < 0 && (
        <p className="note danger" style={{ marginTop: 8 }}>
          ⚠ Project has exceeded estimated hours by{" "}
          <strong>{Math.abs(remaining)} hrs</strong>.
        </p>
      )}
    </div>
  );

  const renderRoleBreakdown = () => {
    const rolesToShow =
      showMVPDetails && totalEstimate === 355
        ? mvpRoleEstimate
        : roleRows;

    return (
      <div className="estimate-section">
        <h3>Role-wise Estimated Hours</h3>
        <table className="estimate-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Estimated Hours</th>
            </tr>
          </thead>
          <tbody>
            {rolesToShow.map((r) => (
              <tr key={r.role}>
                <td>{r.role}</td>
                <td>{r.hours} hrs</td>
              </tr>
            ))}

            {showMVPDetails && totalEstimate === 355 && (
              <tr>
                <td><strong>TOTAL</strong></td>
                <td><strong>{totalEstimate} hrs</strong></td>
              </tr>
            )}

            {rolesToShow.length === 0 && (
              <tr>
                <td colSpan={2} style={{ textAlign: "center" }}>
                  No role breakdown available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTimeline = () => (
    <div className="estimate-section">
      <h3>Project Timeline</h3>
      {showMVPDetails && totalEstimate === 355 ? (
        MVP_TIMELINE.map((week) => (
          <div key={week.week} className="timeline-week">
            <h4>
              {week.week} – {week.title} ({week.hours})
            </h4>
            <p>{week.focus}</p>
            <ul className="estimate-list">
              {week.tasks.map((task, index) => (
                <li key={index}>{task}</li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p>No timeline details available for this project.</p>
      )}
    </div>
  );

  const renderModuleBreakdown = () => (
    <div className="estimate-section">
      <h3>Module-wise Hours Breakdown</h3>
      {showMVPDetails && totalEstimate === 355 ? (
        <table className="estimate-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Planned Hours</th>
              <th>Remaining (auto)</th>
            </tr>
          </thead>
          <tbody>
            {modulesWithRemaining.map((m) => (
              <tr key={m.name}>
                <td>{m.name}</td>
                <td>{m.hours} hrs</td>
                <td>{m.remaining} hrs</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No module breakdown available for this project.</p>
      )}
    </div>
  );

  return (
    <div className="card estimate-card">
      <h2>
        Project Estimate – {project.name}
        {showMVPDetails && totalEstimate === 355 && " (MVP - 1 Month)"}
      </h2>

      <p className="estimate-subtitle">
        {showMVPDetails ? (
          "Click any section below to view details. Remaining hours update automatically based on approved work."
        ) : (
          <>
            Calculated only from <strong>manager-approved tasks</strong>.
            Attendance does <strong>not</strong> affect project hours.
          </>
        )}
      </p>

      <div className="estimate-summary">
        <div><strong>Total Estimate:</strong> {totalEstimate} hrs</div>
        <div><strong>Approved Work:</strong> {used} hrs</div>
        <div>
          <strong>Remaining:</strong>{" "}
          <span
            style={{
              color: remaining < 0 ? "red" : "inherit",
              fontWeight: 600
            }}
          >
            {remaining} hrs
          </span>
        </div>
      </div>

      <div className="estimate-panels">
        {PANELS.map((panel) => (
          <button
            key={panel}
            className={
              openPanel === panel
                ? "estimate-tab active"
                : "estimate-tab"
            }
            type="button"
            onClick={() => setOpenPanel(panel)}
          >
            {panel}
          </button>
        ))}
      </div>

      {openPanel === "Summary" && renderSummary()}
      {openPanel === "Role Breakdown" && renderRoleBreakdown()}
      {openPanel === "Timeline" && renderTimeline()}
      {openPanel === "Module Breakdown" && renderModuleBreakdown()}
    </div>
  );
}
