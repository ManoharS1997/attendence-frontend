import React from "react";

export default function BankDetailsForm({ bankDetails, onChange }) {
  const update = (field, value) => {
    onChange({ ...bankDetails, [field]: value });
  };

  return (
    <div className="card">
      <h3>Bank Details</h3>

      <label>
        Bank Name
        <input
          value={bankDetails.bankName || ""}
          onChange={(e) => update("bankName", e.target.value)}
        />
      </label>

      <label>
        Account Number
        <input
          value={bankDetails.accountNumber || ""}
          onChange={(e) => update("accountNumber", e.target.value)}
        />
      </label>

      <label>
        IFSC Code
        <input
          value={bankDetails.ifscCode || ""}
          onChange={(e) => update("ifscCode", e.target.value)}
        />
      </label>

      <label>
        Branch
        <input
          value={bankDetails.branch || ""}
          onChange={(e) => update("branch", e.target.value)}
        />
      </label>
    </div>
  );
}
