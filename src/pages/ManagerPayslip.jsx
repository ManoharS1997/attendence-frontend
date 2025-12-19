import React, { useMemo, useState } from "react";
import companyLogo from "../assets/Company Logo.png";

/* ======================================================
   COMPANY DETAILS
====================================================== */
const COMPANY = {
  name: "NOWIT SERVICES INDIA PRIVATE LIMITED",
  address: `17-6-284-1, UMA SHANKAR NAGAR,
TADIGADAPA, KANURU,
VIJAYAWADA, KRISHNA,
ANDHRA PRADESH - 520007`,
};

/* ======================================================
   MANAGER PAYSLIP COMPONENT
====================================================== */
export default function ManagerPayslip() {
  /* ================= EMPLOYEES (mock – replace with API) ================= */
  const [employees] = useState([
    {
      _id: "1",
      fullName: "Manohar",
      email: "manohar142652@gmail.com",
      designation: "Software Engineer",
    },
  ]);

  /* ================= STATE ================= */
  const [template, setTemplate] = useState("corporate");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeType, setEmployeeType] = useState("REGULAR");

  const [bank, setBank] = useState({
    bankName: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
    edited: false,
  });

  const [salary, setSalary] = useState({
    basic: 15000,
    hra: 5000,
    conveyance: 0,
    allowances: 0,
    pf: 0,
    esi: 0,
    professionalTax: 0,
    tds: 0,
  });

  const [showPreview, setShowPreview] = useState(false);

  /* ================= DERIVED VALUES ================= */
  const employee = useMemo(
    () => employees.find((e) => e._id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

  const gross =
    salary.basic +
    salary.hra +
    salary.conveyance +
    salary.allowances;

  const deductions =
    salary.pf +
    salary.esi +
    salary.professionalTax +
    salary.tds;

  const netPay = gross - deductions;

  /* ================= ACTIONS ================= */
  const clearForm = () => {
    setSelectedEmployeeId("");
    setEmployeeType("REGULAR");
    setBank({
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
      edited: false,
    });
    setSalary({
      basic: 0,
      hra: 0,
      conveyance: 0,
      allowances: 0,
      pf: 0,
      esi: 0,
      professionalTax: 0,
      tds: 0,
    });
    setShowPreview(false);
  };

  const downloadPdf = () => {
    window.print();
  };

  /* ======================================================
     RENDER
  ====================================================== */
  return (
    <div className="page">
      <h2 style={{ marginBottom: 16 }}>Payslip Management</h2>

      {/* ================= TEMPLATE ================= */}
      <div className="card">
        <h3>Select Payslip Template</h3>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          {["classic", "modern", "corporate", "minimal"].map((t) => (
            <button
              key={t}
              className={`btn ${template === t ? "primary" : "secondary"}`}
              onClick={() => setTemplate(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ================= EMPLOYEE ================= */}
      <div className="card">
        <h3>Select Employee</h3>
        <div className="form-grid">
          <label>
            Employee
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="">-- Select --</option>
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
              onChange={(e) => setEmployeeType(e.target.value)}
            >
              <option value="REGULAR">Regular</option>
              <option value="INTERN">Intern</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </label>
        </div>
      </div>

      {/* ================= BANK ================= */}
      <div className="card">
        <h3>Bank Details (Payslip Only)</h3>
        <div className="form-grid">
          <input
            placeholder="Bank Name"
            value={bank.bankName}
            onChange={(e) =>
              setBank({ ...bank, bankName: e.target.value, edited: true })
            }
          />
          <input
            placeholder="Account Number"
            value={bank.accountNumber}
            onChange={(e) =>
              setBank({ ...bank, accountNumber: e.target.value, edited: true })
            }
          />
          <input
            placeholder="IFSC Code"
            value={bank.ifsc}
            onChange={(e) =>
              setBank({ ...bank, ifsc: e.target.value, edited: true })
            }
          />
          <input
            placeholder="Branch"
            value={bank.branch}
            onChange={(e) =>
              setBank({ ...bank, branch: e.target.value, edited: true })
            }
          />
        </div>

        {bank.edited && (
          <p className="helper">
            Changes apply only to this payslip. Employee master data remains unchanged.
          </p>
        )}
      </div>

      {/* ================= SALARY ================= */}
      <div className="card">
        <h3>Salary Structure</h3>
        <div className="form-grid">
          {Object.keys(salary).map((k) => (
            <label key={k}>
              {k.toUpperCase()}
              <input
                type="number"
                value={salary[k]}
                onChange={(e) =>
                  setSalary({ ...salary, [k]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </div>

      {/* ================= ACTION BAR ================= */}
      <div className="payslip-actions">
        <button className="btn secondary" onClick={clearForm}>
          Clear
        </button>
        <button
          className="btn primary"
          onClick={() => setShowPreview(true)}
          disabled={!employee}
        >
          Preview Payslip
        </button>
        <button className="btn success" onClick={downloadPdf}>
          Download PDF
        </button>
      </div>

      {/* ================= PREVIEW ================= */}
      {showPreview && employee && (
        <div className="payslip-overlay">
          <div className="payslip-sheet">
            <div className="payslip-header-doc">
              <img src={companyLogo} alt="Company Logo" height={42} />
              <h2>PAYSLIP</h2>
            </div>

            <p><strong>{COMPANY.name}</strong></p>
            <p style={{ fontSize: 12 }}>{COMPANY.address}</p>

            <hr />

            <div className="payslip-emp-grid">
              <p><strong>Name:</strong> {employee.fullName}</p>
              <p><strong>Email:</strong> {employee.email}</p>
              <p><strong>Designation:</strong> {employee.designation}</p>
              <p><strong>Employee Type:</strong> {employeeType}</p>
            </div>

            <div className="payslip-tables">
              <table>
                <thead>
                  <tr><th>Earnings</th><th>Amount (₹)</th></tr>
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
                  <tr><th>Deductions</th><th>Amount (₹)</th></tr>
                </thead>
                <tbody>
                  <tr><td>PF</td><td>{salary.pf}</td></tr>
                  <tr><td>ESI</td><td>{salary.esi}</td></tr>
                  <tr><td>Professional Tax</td><td>{salary.professionalTax}</td></tr>
                  <tr><td>TDS</td><td>{salary.tds}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="payslip-total">
              <p>Gross Earnings: ₹{gross}</p>
              <p>Total Deductions: ₹{deductions}</p>
              <p className="net-pay">Net Pay: ₹{netPay}</p>
            </div>

            <div className="payslip-footer">
              This is a system generated payslip. No signature required.
            </div>

            <div className="payslip-actions-doc">
              <button
                className="btn secondary"
                onClick={() => setShowPreview(false)}
              >
                Close
              </button>
              <button className="btn success" onClick={downloadPdf}>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
