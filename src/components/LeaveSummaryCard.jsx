// attendance-frontend/src/components/LeaveSummaryCard.jsx
import React from "react";

export default function LeaveSummaryCard({ summary, loading }) {
  return (
    <div className="card leave-card">
      <h2>Leave Summary</h2>

      {loading && <p>Loading leave summary...</p>}

      {!loading && summary && (
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
            * These values are read-only; only Manager can update them in the
            system.
          </p>
        </>
      )}

      {!loading && !summary && <p>No summary available.</p>}
    </div>
  );
}
