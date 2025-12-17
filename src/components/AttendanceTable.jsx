export default function AttendanceTable({ records, title }) {
  return (
    <div className="card">
      <h2>{title || "My Attendance"}</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>In</th>
              <th>Out</th>
              <th>Manager</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r._id}>
                <td>{r.date}</td>
                <td>
                  <span className={`status-pill status-${r.status.replace(/\s/g, "-")}`}>
                    {r.status}
                  </span>
                </td>
                <td>{r.workInTime || "-"}</td>
                <td>{r.workOutTime || "-"}</td>
                <td>{r.managerDecision?.status || "-"}</td>
                <td>{r.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <p className="empty">No records</p>}
      </div>
    </div>
  );
}
