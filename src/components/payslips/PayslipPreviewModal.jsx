// src/components/payslips/PayslipPreviewModal.jsx
import { useRef } from 'react';
import { Download, Printer, Mail } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const PayslipPreviewModal = ({ employee, month, year, bankDetails, salary, workingDays, onDownload }) => {
  const componentRef = useRef();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `payslip-${employee?.employeeId}-${month}-${year}`,
  });

  if (!employee) {
    return (
      <div className="payslip-preview-placeholder">
        <div className="placeholder-content">
          <h3>No Employee Selected</h3>
          <p>Select an employee and fill details to preview payslip</p>
        </div>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Convert number to words
  const convertNumberToWords = (num) => {
    if (num === 0) return 'Zero Rupees';
    
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = Math.floor((num % 1000) / 100);
    const tens = num % 100;

    let words = '';

    if (crore > 0) {
      words += convertNumberToWords(crore) + ' Crore ';
    }
    if (lakh > 0) {
      words += convertNumberToWords(lakh) + ' Lakh ';
    }
    if (thousand > 0) {
      words += convertNumberToWords(thousand) + ' Thousand ';
    }
    if (hundred > 0) {
      words += a[hundred] + ' Hundred ';
    }
    if (tens > 0) {
      if (tens < 20) {
        words += a[tens];
      } else {
        words += b[Math.floor(tens / 10)] + ' ' + a[tens % 10];
      }
    }

    return words.trim() + ' Rupees Only';
  };

  return (
    <div className="payslip-preview-modal">
      <div className="preview-header">
        <h3>Payslip Preview</h3>
        <div className="preview-actions">
          <button className="action-btn print-btn" onClick={handlePrint}>
            <Printer size={18} />
            Print
          </button>
          <button className="action-btn download-btn" onClick={onDownload}>
            <Download size={18} />
            Download PDF
          </button>
          <button className="action-btn email-btn">
            <Mail size={18} />
            Email
          </button>
        </div>
      </div>

      <div className="payslip-preview-content" ref={componentRef}>
        {/* Company Header */}
        <div className="company-header">
          <div className="company-logo-section">
            <div className="logo-placeholder">
              <div className="company-logo">🏢</div>
              <div className="logo-text">NOW IT SERVICES</div>
            </div>
            <div className="company-info">
              <h1 className="company-name">NOW IT SERVICES PVT LTD</h1>
              <p className="company-address">123 Tech Park, Innovation Road, Bengaluru - 560001</p>
              <p className="company-contact">Phone: 7893536373 | Email: hr@nowitservices.com</p>
            </div>
          </div>
          
          <div className="payslip-title-section">
            <h2 className="payslip-title">SALARY SLIP</h2>
            <div className="payslip-period">
              For the month of {months[parseInt(month) - 1]} {year}
            </div>
          </div>
        </div>

        {/* Employee Information */}
        <div className="employee-section">
          <div className="section-title">Employee Information</div>
          <div className="employee-details-grid">
            <div className="employee-detail">
              <span className="detail-label">Employee ID:</span>
              <span className="detail-value">{employee.employeeId || 'EMP001'}</span>
            </div>
            <div className="employee-detail">
              <span className="detail-label">Name:</span>
              <span className="detail-value">{employee.fullName}</span>
            </div>
            <div className="employee-detail">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{employee.email}</span>
            </div>
            <div className="employee-detail">
              <span className="detail-label">Designation:</span>
              <span className="detail-value">{employee.designation || 'Software Engineer'}</span>
            </div>
            <div className="employee-detail">
              <span className="detail-label">Employee Type:</span>
              <span className="detail-value">Permanent</span>
            </div>
            <div className="employee-detail">
              <span className="detail-label">Working Days:</span>
              <span className="detail-value">{workingDays} days</span>
            </div>
          </div>
        </div>

        {/* Bank Information */}
        <div className="bank-section">
          <div className="section-title">Bank Details</div>
          <div className="bank-details-grid">
            <div className="bank-detail">
              <span className="detail-label">Bank Name:</span>
              <span className="detail-value">{bankDetails.bankName || 'State Bank of India'}</span>
            </div>
            <div className="bank-detail">
              <span className="detail-label">Account Number:</span>
              <span className="detail-value">****{bankDetails.accountNumber?.slice(-4) || '1234'}</span>
            </div>
            <div className="bank-detail">
              <span className="detail-label">IFSC Code:</span>
              <span className="detail-value">{bankDetails.ifsc || 'SBIN0005943'}</span>
            </div>
            <div className="bank-detail">
              <span className="detail-label">Branch:</span>
              <span className="detail-value">{bankDetails.branch || 'SBI Main Branch, Bengaluru'}</span>
            </div>
          </div>
        </div>

        {/* Salary Breakdown */}
        <div className="salary-section">
          <div className="section-title">Salary Details</div>
          <div className="salary-breakdown">
            {/* Earnings */}
            <div className="earnings-table">
              <div className="table-header">
                <div className="table-title">Earnings</div>
              </div>
              <div className="table-body">
                <div className="table-row">
                  <div className="table-cell">Basic Pay</div>
                  <div className="table-cell amount">{formatCurrency(salary.basic)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">House Rent Allowance (HRA)</div>
                  <div className="table-cell amount">{formatCurrency(salary.hra)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">Conveyance Allowance</div>
                  <div className="table-cell amount">{formatCurrency(salary.conveyance)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">Travel Allowance</div>
                  <div className="table-cell amount">{formatCurrency(salary.travelAllowance)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">Medical Allowance</div>
                  <div className="table-cell amount">{formatCurrency(salary.medicalAllowance)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">Special Allowance</div>
                  <div className="table-cell amount">{formatCurrency(salary.specialAllowance)}</div>
                </div>
                <div className="table-row total">
                  <div className="table-cell"><strong>Total Earnings</strong></div>
                  <div className="table-cell amount"><strong>{formatCurrency(salary.gross)}</strong></div>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="deductions-table">
              <div className="table-header">
                <div className="table-title">Deductions</div>
              </div>
              <div className="table-body">
                <div className="table-row">
                  <div className="table-cell">Provident Fund (PF)</div>
                  <div className="table-cell amount">{formatCurrency(salary.pf)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">ESI Contribution</div>
                  <div className="table-cell amount">{formatCurrency(salary.esi)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">Professional Tax</div>
                  <div className="table-cell amount">{formatCurrency(salary.professionalTax)}</div>
                </div>
                <div className="table-row">
                  <div className="table-cell">Income Tax (TDS)</div>
                  <div className="table-cell amount">{formatCurrency(salary.tds)}</div>
                </div>
                <div className="table-row total">
                  <div className="table-cell"><strong>Total Deductions</strong></div>
                  <div className="table-cell amount"><strong>{formatCurrency(salary.deductions)}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Net Pay */}
        <div className="net-pay-section">
          <div className="net-pay-card">
            <div className="net-pay-header">
              <span className="net-pay-label">NET PAYABLE</span>
              <span className="net-pay-amount">{formatCurrency(salary.netPay)}</span>
            </div>
            <div className="net-pay-words">
              <strong>Amount in Words:</strong> {convertNumberToWords(salary.netPay)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="payslip-footer">
          <div className="footer-content">
            <div className="signature-section">
              <div className="signature-box">
                <div className="signature-line"></div>
                <div className="signature-label">Authorized Signature</div>
              </div>
              <div className="signature-box">
                <div className="signature-line"></div>
                <div className="signature-label">Employee Signature</div>
              </div>
            </div>
            <div className="footer-notes">
              <p>This is a computer generated payslip and does not require signature.</p>
              <p>Generated by Attendance & Payroll Management System</p>
              <p className="footer-copyright">© {new Date().getFullYear()} NOW IT SERVICES PVT LTD. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayslipPreviewModal;