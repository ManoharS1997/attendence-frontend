// attendance-frontend/src/components/EmployeeTimesheetCard.jsx
import React from "react";
import { calculateProjectHours } from "../utils/hours";

export default function EmployeeTimesheetCard({ records, project }) {
  const { totalHours, daily } = calculateProjectHours(records);
  const totalEstimate = project?.totalEstimatedHours || 355;
  const remaining = Math.max(0, totalEstimate - totalHours);

  return (
    <div className="card">
      <h2>Timesheet – Project Hours</h2>
      {project ? (
        <p style={{ fontSize: 12, marginBottom: 8 }}>
          Project: <strong>{project.name}</strong>{" "}
          {project.code ? `(${project.code})` : ""} – Estimate:{" "}
          {totalEstimate} hrs
        </p>
      ) : (
        <p style={{ fontSize: 12, marginBottom: 8 }}>
          No project assigned yet. Ask your manager.
        </p>
      )}

      <div className="estimate-summary">
        <div>
          <strong>Total Worked from Attendance:</strong> {totalHours} hrs
        </div>
        <div>
          <strong>Remaining Estimate:</strong> {remaining} hrs
        </div>
      </div>

      <div className="table-wrapper small-table" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>In</th>
              <th>Out</th>
              <th>Hours Applied to Project</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d._id}>
                <td>{d.date}</td>
                <td>{d.status}</td>
                <td>{d.workInTime}</td>
                <td>{d.workOutTime}</td>
                <td>{d.projectHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {daily.length === 0 && (
          <p className="empty">No attendance for this month.</p>
        )}
      </div>
    </div>
  );
}
