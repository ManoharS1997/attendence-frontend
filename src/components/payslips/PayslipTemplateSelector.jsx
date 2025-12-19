import React from "react";

const templates = [
  { id: "template1", name: "Classic Payslip" },
  { id: "template2", name: "Modern Payslip" },
  { id: "template3", name: "Corporate Payslip" }
];

export default function PayslipTemplateSelector({ value, onChange }) {
  return (
    <div className="card">
      <h3>Select Payslip Template</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {templates.map((t) => (
          <label
            key={t.id}
            style={{
              border: value === t.id ? "2px solid #40a9ff" : "1px solid #ccc",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "pointer",
              minWidth: 160
            }}
          >
            <input
              type="radio"
              name="template"
              value={t.id}
              checked={value === t.id}
              onChange={() => onChange(t.id)}
              style={{ marginRight: 6 }}
            />
            {t.name}
          </label>
        ))}
      </div>
    </div>
  );
}
