import React, { useEffect } from "react";

export default function SalaryBreakup({ salary, onChange }) {
  const update = (field, value) => {
    onChange({ ...salary, [field]: Number(value) || 0 });
  };

  const gross =
    salary.basic +
    salary.hra +
    salary.conveyance +
    salary.allowances;

  const deductions =
    salary.pf +
    salary.esi +
    salary.professionalTax +
    salary.tds +
    salary.otherDeductions;

  useEffect(() => {
    onChange({
      ...salary,
      grossEarnings: gross,
      totalDeductions: deductions,
      netPay: gross - deductions
    });
    // eslint-disable-next-line
  }, [gross, deductions]);

  return (
    <div className="card">
      <h3>Salary Structure</h3>

      <h4>Earnings</h4>
      <label>Basic <input type="number" value={salary.basic} onChange={(e) => update("basic", e.target.value)} /></label>
      <label>HRA <input type="number" value={salary.hra} onChange={(e) => update("hra", e.target.value)} /></label>
      <label>Conveyance <input type="number" value={salary.conveyance} onChange={(e) => update("conveyance", e.target.value)} /></label>
      <label>Allowances <input type="number" value={salary.allowances} onChange={(e) => update("allowances", e.target.value)} /></label>

      <h4>Deductions</h4>
      <label>PF <input type="number" value={salary.pf} onChange={(e) => update("pf", e.target.value)} /></label>
      <label>ESI <input type="number" value={salary.esi} onChange={(e) => update("esi", e.target.value)} /></label>
      <label>Professional Tax <input type="number" value={salary.professionalTax} onChange={(e) => update("professionalTax", e.target.value)} /></label>
      <label>TDS <input type="number" value={salary.tds} onChange={(e) => update("tds", e.target.value)} /></label>
      <label>Other Deductions <input type="number" value={salary.otherDeductions} onChange={(e) => update("otherDeductions", e.target.value)} /></label>

      <hr />

      <p><strong>Gross Earnings:</strong> {gross}</p>
      <p><strong>Total Deductions:</strong> {deductions}</p>
      <p><strong>Net Pay:</strong> {gross - deductions}</p>
    </div>
  );
}
