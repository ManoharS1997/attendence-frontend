import React from "react";

const EMPLOYEE_TYPES = ["REGULAR", "INTERN", "CONTRACT"];

export default function EmployeeSelector({
  employees,
  employeeId,
  employeeType,
  onEmployeeChange,
  onTypeChange
}) {
  return (
    <div className="card">
      <h3>Select Employee</h3>

      <label>
        Employee
        <select
          value={employeeId}
          onChange={(e) => onEmployeeChange(e.target.value)}
          required
        >
          <option value="">-- Select employee --</option>
          {employees.map((e) => (
            <option key={e._id} value={e._id}>
              {e.fullName} ({e.email})
            </option>
          ))}
        </select>
      </label>

      <label>
        Employee Type
        <select
          value={employeeType}
          onChange={(e) => onTypeChange(e.target.value)}
          required
        >
          {EMPLOYEE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
