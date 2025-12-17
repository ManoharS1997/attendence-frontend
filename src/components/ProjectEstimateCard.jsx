// attendance-frontend/src/components/ProjectEstimateCard.jsx
import React, { useState } from "react";

const TOTAL_ESTIMATE = 355;

// Module-wise hours from your text
const MODULES = [
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

const PANELS = [
  "Total Effort",
  "Week 1",
  "Week 2",
  "Week 3",
  "Week 4",
  "Module Breakdown"
];

export default function ProjectEstimateCard({ usedHours = 0 }) {
  const [openPanel, setOpenPanel] = useState("Total Effort");

  const remaining = Math.max(0, TOTAL_ESTIMATE - usedHours);

  const modulesWithRemaining = MODULES.map((m) => {
    const ratio = m.hours / TOTAL_ESTIMATE;
    const spent = usedHours * ratio;
    const remainingModule = Math.max(0, m.hours - spent);
    return { ...m, remaining: remainingModule.toFixed(1) };
  });

  return (
    <div className="card estimate-card">
      <h2>Project Estimate – MVP (1 Month)</h2>
      <p className="estimate-subtitle">
        Click any section below to view details. Remaining hours update
        automatically based on attendance.
      </p>

      <div className="estimate-summary">
        <div>
          <strong>Total Estimate:</strong> {TOTAL_ESTIMATE} hrs
        </div>
        <div>
          <strong>Used from Attendance:</strong> {usedHours} hrs
        </div>
        <div>
          <strong>Remaining:</strong> {remaining} hrs
        </div>
      </div>

      <div className="estimate-panels">
        {PANELS.map((panel) => (
          <button
            key={panel}
            className={
              openPanel === panel ? "estimate-tab active" : "estimate-tab"
            }
            type="button"
            onClick={() => setOpenPanel(panel)}
          >
            {panel}
          </button>
        ))}
      </div>

      {/* Panel content */}
      {openPanel === "Total Effort" && (
        <div className="estimate-section">
          <h3>1. Total Effort Estimate</h3>
          <table className="estimate-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Estimated Hours</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Frontend Developer</td>
                <td>120 hrs</td>
              </tr>
              <tr>
                <td>Backend Developer</td>
                <td>140 hrs</td>
              </tr>
              <tr>
                <td>UI/UX Designer</td>
                <td>35 hrs</td>
              </tr>
              <tr>
                <td>QA Tester</td>
                <td>40 hrs</td>
              </tr>
              <tr>
                <td>Project Manager</td>
                <td>20 hrs</td>
              </tr>
              <tr>
                <td>
                  <strong>TOTAL</strong>
                </td>
                <td>
                  <strong>355 hrs</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {openPanel === "Week 1" && (
        <div className="estimate-section">
          <h3>2. Week 1 – Auth & Setup (65–80 hrs)</h3>
          <p>
            Focus on Authentication, company setup, user management and the
            basic dashboards.
          </p>
          <ul className="estimate-list">
            <li>
              <strong>Frontend (25–30 hrs):</strong> Login, signup, password
              reset, role-based UI, layout.
            </li>
            <li>
              <strong>Backend (35–40 hrs):</strong> Multi-tenant auth, JWT,
              user/company CRUD, RBAC.
            </li>
            <li>
              <strong>Design (5–10 hrs):</strong> Wireframes and style guide.
            </li>
          </ul>
        </div>
      )}

      {openPanel === "Week 2" && (
        <div className="estimate-section">
          <h3>3. Week 2 – Projects & Time Tracking (85–95 hrs)</h3>
          <ul className="estimate-list">
            <li>
              <strong>Frontend (40–45 hrs):</strong> Project list/creation,
              assignment UI, timer, time logging, attendance.
            </li>
            <li>
              <strong>Backend (40–45 hrs):</strong> Project APIs, assignment
              APIs, time entry, attendance APIs.
            </li>
            <li>
              <strong>Design (5 hrs):</strong> Project & timesheet screens.
            </li>
          </ul>
        </div>
      )}

      {openPanel === "Week 3" && (
        <div className="estimate-section">
          <h3>4. Week 3 – Timesheet & Budgets (90–100 hrs)</h3>
          <ul className="estimate-list">
            <li>
              <strong>Frontend (40–45 hrs):</strong> Weekly timesheets, manager
              approvals, notifications, budget progress UI.
            </li>
            <li>
              <strong>Backend (45–50 hrs):</strong> Timesheet logic, approvals,
              cost calc, budget engine, summary APIs.
            </li>
            <li>
              <strong>QA (5 hrs):</strong> Role testing & edge cases.
            </li>
          </ul>
        </div>
      )}

      {openPanel === "Week 4" && (
        <div className="estimate-section">
          <h3>5. Week 4 – Dashboards & Launch (80–90 hrs)</h3>
          <ul className="estimate-list">
            <li>
              <strong>Frontend (25–30 hrs):</strong> Dashboards, exports, polish.
            </li>
            <li>
              <strong>Backend (30–35 hrs):</strong> Reporting APIs, dashboard
              endpoints, deployment setup.
            </li>
            <li>
              <strong>QA (25–30 hrs):</strong> Full test and regression.
            </li>
          </ul>
        </div>
      )}

      {openPanel === "Module Breakdown" && (
        <div className="estimate-section">
          <h3>6. Module-wise Hours Breakdown</h3>
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
                  <td>{m.hours}</td>
                  <td>{m.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
