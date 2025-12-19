import React from "react";

export default function PayslipPreviewModal({ open, onClose, data }) {
  if (!open) return null;

  const {
    employee,
    salary,
    month,
    year,
    workingDays = 26
  } = data;

  return (
    <div className="payslip-overlay">
      <div className="payslip-sheet">

        {/* HEADER */}
        <div className="payslip-header-doc">
          <div>
            <h2>NOWIT SERVICES</h2>
            <p>Salary Slip for {month}/{year}</p>
          </div>
          <div className="payslip-logo">PAYSLIP</div>
        </div>

        {/* EMPLOYEE INFO */}
        <div className="payslip-emp-grid">
          <div><strong>Name:</strong> {employee.fullName}</div>
          <div><strong>Email:</strong> {employee.email}</div>
          <div><strong>Designation:</strong> {employee.designation || "-"}</div>
          <div><strong>Employee Type:</strong> {employee.role}</div>
          <div><strong>Working Days:</strong> {workingDays}</div>
        </div>

        {/* SALARY TABLE */}
        <div className="payslip-tables">
          <table>
            <thead>
              <tr>
                <th>Earnings</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Basic</td><td>{salary.basic}</td></tr>
              <tr><td>HRA</td><td>{salary.hra}</td></tr>
              <tr><td>Conveyance</td><td>{salary.conveyance}</td></tr>
              <tr><td>Allowances</td><td>{salary.allowances}</td></tr>
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <th>Deductions</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>PF</td><td>{salary.pf}</td></tr>
              <tr><td>ESI</td><td>{salary.esi}</td></tr>
              <tr><td>Professional Tax</td><td>{salary.professionalTax}</td></tr>
              <tr><td>TDS</td><td>{salary.tds}</td></tr>
            </tbody>
          </table>
        </div>

        {/* TOTALS */}
        <div className="payslip-total">
          <div>Gross Earnings: ₹{salary.grossEarnings}</div>
          <div>Total Deductions: ₹{salary.totalDeductions}</div>
          <div className="net-pay">
            Net Pay: ₹{salary.netPay}
          </div>
        </div>

        {/* FOOTER */}
        <div className="payslip-footer">
          This is a system generated payslip. No signature required.
        </div>

        <div className="payslip-actions-doc">
          <button onClick={onClose}>Close</button>
          <button onClick={() => window.print()}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
