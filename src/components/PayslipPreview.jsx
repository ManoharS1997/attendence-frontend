import React from "react";
import "./payslipPreview.css";

export default function PayslipPreview({
  payslip,
  onClose,
  onDownload,
  onPrint,
  onShare,
  onSend
}) {
  if (!payslip) return null;

  return (
    <div className="preview-overlay">
      <div className="preview-container">
        {/* HEADER */}
        <div className="preview-header">
          <div>
            <h2>Payslip Preview – Professional Blue</h2>
            <p>
              For {payslip.employeeName} •{" "}
              {payslip.monthLabel}
            </p>
          </div>

          <div className="preview-actions">
            <button className="btn red" onClick={onDownload}>⬇ Download PDF</button>
            <button className="btn green" onClick={onPrint}>🖨 Print</button>
            <button className="btn purple" onClick={onShare}>🔗 Share</button>
            <button className="btn blue" onClick={onSend}>✈ Send</button>
            <button className="btn close" onClick={onClose}>✖</button>
          </div>
        </div>

        {/* PREVIEW BODY */}
        <div className="preview-body">
          <iframe
            title="Payslip PDF Preview"
            src={`/api/payslips/${payslip._id}/preview`}
            frameBorder="0"
          />
        </div>

        {/* FOOTER */}
        <div className="preview-footer">
          <button className="btn red" onClick={onDownload}>⬇ Download PDF</button>
          <button className="btn green" onClick={onPrint}>🖨 Print</button>
          <button className="btn purple" onClick={onShare}>🔗 Share</button>
          <button className="btn blue" onClick={onSend}>✈ Send</button>
        </div>
      </div>
    </div>
  );
}
