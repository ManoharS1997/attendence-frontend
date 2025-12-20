// src/pages/ManagerPayslip.jsx
import { useState, useEffect, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/managerPayslip.css';
import { 
  Calendar, 
  User, 
  Building, 
  DollarSign, 
  Download, 
  Eye, 
  EyeOff,
  FileText,
  Save,
  X,
  Edit2,
  History,
  Send,
  ChevronDown
} from 'lucide-react';

// Components
import BankDetailsForm from '../components/payslips/BankDetailsForm';
import SalaryBreakup from '../components/payslips/SalaryBreakup';

// API functions
import { 
  getEmployees, 
  generatePayslip, 
  downloadPayslipPDF,
  getEmployeePayslips,
  getHolidays
} from '../utils/api';

// Import company logo
import CompanyLogo from '../assets/CompanyLogo.png';

const ManagerPayslip = () => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    history: []
  });
  const [salaryStructure, setSalaryStructure] = useState({
    basic: 0,
    hra: 0,
    conveyance: 0,
    travelAllowance: 0,
    medicalAllowance: 0,
    specialAllowance: 0,
    pf: 0,
    esi: 0,
    professionalTax: 0,
    tds: 0,
    gross: 0,
    deductions: 0,
    netPay: 0
  });
  const [generatedPayslips, setGeneratedPayslips] = useState([]);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [holidays, setHolidays] = useState([]);

  // Get current month and year
  useEffect(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setSelectedMonth(month);
    setSelectedYear(year.toString());
    calculateWorkingDays(month, year);
  }, []);

  // Load employees
  useEffect(() => {
    const fetchEmployeesData = async () => {
      try {
        const data = await getEmployees();
        setEmployees(data);
      } catch (err) {
        console.error('Failed to load employees:', err);
        toast.error('Failed to load employees');
      }
    };
    fetchEmployeesData();
  }, []);

  // Calculate working days function
  const calculateWorkingDays = useCallback(async (month, year) => {
    if (!month || !year) return;
    
    try {
      // Fetch holidays
      const holidaysData = await getHolidays(month, year);
      setHolidays(holidaysData);
      
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const totalDaysInMonth = new Date(yearNum, monthNum, 0).getDate();
      
      let workingDaysCount = 0;
      
      // Count working days (Monday to Friday, excluding holidays)
      for (let day = 1; day <= totalDaysInMonth; day++) {
        const date = new Date(yearNum, monthNum - 1, day);
        const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, 6=Saturday
        
        // Skip Sundays
        if (dayOfWeek === 0) continue;
        
        // Check if Saturday (handle 2nd and 4th Saturday holidays)
        if (dayOfWeek === 6) {
          const weekOfMonth = Math.ceil(day / 7);
          // 2nd and 4th Saturdays are holidays
          if (weekOfMonth === 2 || weekOfMonth === 4) {
            continue;
          }
        }
        
        // Check if it's a holiday
        const dateStr = `${String(day).padStart(2, '0')}-${month}-${year}`;
        const isHoliday = holidaysData.some(h => 
          h.date === dateStr && h.status === 'TAKEN'
        );
        
        if (!isHoliday) {
          workingDaysCount++;
        }
      }
      
      setWorkingDays(workingDaysCount);
      
    } catch (err) {
      console.error('Failed to calculate working days:', err);
      // Fallback calculation
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const totalDaysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const approximateWorkingDays = Math.floor(totalDaysInMonth * 0.70);
      setWorkingDays(approximateWorkingDays);
    }
  }, []);

  // Load working days when month/year changes
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      calculateWorkingDays(selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear, calculateWorkingDays]);

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setIsEmployeeDropdownOpen(false);
    
    if (employee?._id) {
      const loadEmployeePayslipsData = async () => {
        try {
          const payslips = await getEmployeePayslips(employee._id);
          setGeneratedPayslips(payslips);
        } catch (err) {
          console.error('Failed to load payslips:', err);
        }
      };
      loadEmployeePayslipsData();
      
      // Pre-fill bank details
      setBankDetails({
        bankName: employee.bankName || '',
        accountNumber: employee.accountNumber || '',
        ifsc: employee.ifsc || '',
        branch: employee.branch || '',
        history: []
      });
    }
  };

  // Calculate salary callback
  const calculateSalary = useCallback(() => {
    const basic = salaryStructure.basic || 0;
    const hra = salaryStructure.hra || 0;
    const conveyance = salaryStructure.conveyance || 0;
    const travelAllowance = salaryStructure.travelAllowance || 0;
    const medicalAllowance = salaryStructure.medicalAllowance || 0;
    const specialAllowance = salaryStructure.specialAllowance || 0;
    
    const gross = basic + hra + conveyance + travelAllowance + medicalAllowance + specialAllowance;
    const deductions = (salaryStructure.pf || 0) + (salaryStructure.esi || 0) + 
                      (salaryStructure.professionalTax || 0) + (salaryStructure.tds || 0);
    const netPay = gross - deductions;

    setSalaryStructure(prev => ({
      ...prev,
      gross,
      deductions,
      netPay
    }));
  }, [
    salaryStructure.basic,
    salaryStructure.hra,
    salaryStructure.conveyance,
    salaryStructure.travelAllowance,
    salaryStructure.medicalAllowance,
    salaryStructure.specialAllowance,
    salaryStructure.pf,
    salaryStructure.esi,
    salaryStructure.professionalTax,
    salaryStructure.tds
  ]);

  // Auto-calculate salary when dependencies change
  useEffect(() => {
    calculateSalary();
  }, [calculateSalary]);

  // Check if Generate Payslip button should be enabled
  const isGenerateButtonEnabled = () => {
    return selectedEmployee && 
           bankDetails.bankName && 
           bankDetails.accountNumber && 
           bankDetails.ifsc &&
           salaryStructure.basic > 0;
  };

  const handleGeneratePayslip = async () => {
    if (!isGenerateButtonEnabled()) {
      toast.error('Please fill all required details including salary');
      return;
    }

    setLoading(true);
    
    try {
      const payslipData = {
        employeeId: selectedEmployee._id,
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        designation: selectedEmployee.designation || 'Employee',
        employeeType: selectedEmployee.employeeType || 'Permanent',
        bankDetails: {
          bankName: bankDetails.bankName,
          accountNumber: bankDetails.accountNumber,
          ifsc: bankDetails.ifsc,
          branch: bankDetails.branch
        },
        salary: {
          ...salaryStructure,
          workingDays,
          allowances: salaryStructure.travelAllowance + salaryStructure.medicalAllowance + salaryStructure.specialAllowance
        }
      };

      const newPayslip = await generatePayslip(payslipData);
      
      toast.success('Payslip generated successfully! Sent to employee and admin.');
      
      // Add to generated payslips list
      setGeneratedPayslips(prev => [
        {
          ...newPayslip,
          _id: newPayslip._id || Date.now().toString(),
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          salary: {
            ...salaryStructure,
            netPay: salaryStructure.netPay
          }
        },
        ...prev
      ]);
      
      // Enable preview
      setShowPreview(true);
      
    } catch (err) {
      console.error('Failed to generate payslip:', err);
      toast.error(err.message || 'Failed to generate payslip');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPayslip = async (payslipId) => {
    try {
      await downloadPayslipPDF(payslipId);
    } catch (err) {
      console.error('Failed to download payslip:', err);
      toast.error('Failed to download payslip');
    }
  };

  const handleClearForm = () => {
    setSelectedEmployee(null);
    setBankDetails({
      bankName: '',
      accountNumber: '',
      ifsc: '',
      branch: '',
      history: []
    });
    setSalaryStructure({
      basic: 0,
      hra: 0,
      conveyance: 0,
      travelAllowance: 0,
      medicalAllowance: 0,
      specialAllowance: 0,
      pf: 0,
      esi: 0,
      professionalTax: 0,
      tds: 0,
      gross: 0,
      deductions: 0,
      netPay: 0
    });
    setIsEmployeeDropdownOpen(false);
    setShowPreview(false);
  };

  const handleSendToEmployee = () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    toast.info(`Payslip will be sent to ${selectedEmployee.email} on generation`);
  };

  const handleViewHistory = () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    
    // Show bank history in a modal
    const historyModal = document.createElement('div');
    historyModal.className = 'bank-history-modal';
    historyModal.innerHTML = `
      <div class="history-modal-overlay">
        <div class="history-modal-content">
          <div class="history-modal-header">
            <h3>Bank Details History</h3>
            <button class="close-history-modal">&times;</button>
          </div>
          <div class="history-modal-body">
            ${bankDetails.history.length > 0 ? bankDetails.history.map((record) => `
              <div class="history-record">
                <div class="history-date">${record.date} ${record.time}</div>
                <div class="history-details">
                  <div><strong>Bank:</strong> ${record.bankName || 'N/A'}</div>
                  <div><strong>Account:</strong> ****${record.accountNumber?.slice(-4) || '****'}</div>
                  <div><strong>IFSC:</strong> ${record.ifsc || 'N/A'}</div>
                  <div><strong>Branch:</strong> ${record.branch || 'N/A'}</div>
                  <div><strong>Changed by:</strong> ${record.changedBy || 'Manager'}</div>
                </div>
              </div>
            `).join('') : '<p class="no-history">No bank history available</p>'}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(historyModal);
    
    // Add close functionality
    const closeBtn = historyModal.querySelector('.close-history-modal');
    const overlay = historyModal.querySelector('.history-modal-overlay');
    
    const closeModal = () => {
      document.body.removeChild(historyModal);
    };
    
    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };
  };

  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const getEmployeeType = (employeeId) => {
    if (!employeeId) return 'Permanent';
    return employeeId.startsWith('TEMP') ? 'Temporary' : 'Permanent';
  };

  // Get holiday info for display
  const getHolidayInfo = () => {
    const takenHolidays = holidays.filter(h => h.status === 'TAKEN');
    const notTakenHolidays = holidays.filter(h => h.status === 'NOT_TAKEN');
    
    if (takenHolidays.length === 0 && notTakenHolidays.length === 0) {
      return null;
    }
    
    return {
      taken: takenHolidays.length,
      notTaken: notTakenHolidays.length,
      total: holidays.length
    };
  };

  const holidayInfo = getHolidayInfo();

  // Render preview in new section
  const renderPreview = () => {
    if (!showPreview || !selectedEmployee) return null;

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount || 0);
    };

    return (
      <div className="payslip-full-preview">
        <div className="preview-header-section">
          <h3>Payslip Preview</h3>
          <button className="close-preview-btn" onClick={() => setShowPreview(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="payslip-document">
          {/* Company Header */}
          <div className="company-header-preview">
            <div className="company-logo-container">
              <img 
                src={CompanyLogo} 
                alt="Company Logo" 
                className="company-logo-img"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="company-logo-fallback">
                <span className="logo-text">NOW IT SERVICES</span>
              </div>
            </div>
            <div className="company-name-large">NOW IT SERVICES PVT LTD</div>
            <div className="payslip-title-large">SALARY SLIP</div>
            <div className="payslip-period-large">
              For the month of {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </div>
          </div>

          {/* Employee Information */}
          <div className="employee-info-preview">
            <table className="info-table">
              <tbody>
                <tr>
                  <td><strong>Employee ID:</strong></td>
                  <td>{selectedEmployee.employeeId || 'EMP001'}</td>
                  <td><strong>Name:</strong></td>
                  <td>{selectedEmployee.fullName}</td>
                </tr>
                <tr>
                  <td><strong>Email:</strong></td>
                  <td>{selectedEmployee.email}</td>
                  <td><strong>Designation:</strong></td>
                  <td>{selectedEmployee.designation || 'Software Engineer'}</td>
                </tr>
                <tr>
                  <td><strong>Employee Type:</strong></td>
                  <td>{getEmployeeType(selectedEmployee.employeeId)}</td>
                  <td><strong>Working Days:</strong></td>
                  <td>{workingDays} days</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bank Information */}
          <div className="bank-info-preview">
            <h4>Bank Details</h4>
            <table className="info-table">
              <tbody>
                <tr>
                  <td><strong>Bank Name:</strong></td>
                  <td>{bankDetails.bankName || 'State Bank of India'}</td>
                  <td><strong>Account Number:</strong></td>
                  <td>****{bankDetails.accountNumber?.slice(-4) || '1234'}</td>
                </tr>
                <tr>
                  <td><strong>IFSC Code:</strong></td>
                  <td>{bankDetails.ifsc || 'SBIN0005943'}</td>
                  <td><strong>Branch:</strong></td>
                  <td>{bankDetails.branch || 'SBI Main Branch, Bengaluru'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Salary Breakdown */}
          <div className="salary-breakdown-preview">
            <div className="earnings-section">
              <h4>Earnings</h4>
              <table className="salary-table">
                <tbody>
                  <tr>
                    <td>Basic Pay</td>
                    <td className="amount">{formatCurrency(salaryStructure.basic)}</td>
                  </tr>
                  <tr>
                    <td>House Rent Allowance (HRA)</td>
                    <td className="amount">{formatCurrency(salaryStructure.hra)}</td>
                  </tr>
                  <tr>
                    <td>Conveyance Allowance</td>
                    <td className="amount">{formatCurrency(salaryStructure.conveyance)}</td>
                  </tr>
                  <tr>
                    <td>Travel Allowance</td>
                    <td className="amount">{formatCurrency(salaryStructure.travelAllowance)}</td>
                  </tr>
                  <tr>
                    <td>Medical Allowance</td>
                    <td className="amount">{formatCurrency(salaryStructure.medicalAllowance)}</td>
                  </tr>
                  <tr>
                    <td>Special Allowance</td>
                    <td className="amount">{formatCurrency(salaryStructure.specialAllowance)}</td>
                  </tr>
                  <tr className="total-row">
                    <td><strong>Total Earnings</strong></td>
                    <td className="amount total">
                      <strong>{formatCurrency(salaryStructure.gross)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="deductions-section">
              <h4>Deductions</h4>
              <table className="salary-table">
                <tbody>
                  <tr>
                    <td>Provident Fund (PF)</td>
                    <td className="amount">{formatCurrency(salaryStructure.pf)}</td>
                  </tr>
                  <tr>
                    <td>ESI Contribution</td>
                    <td className="amount">{formatCurrency(salaryStructure.esi)}</td>
                  </tr>
                  <tr>
                    <td>Professional Tax</td>
                    <td className="amount">{formatCurrency(salaryStructure.professionalTax)}</td>
                  </tr>
                  <tr>
                    <td>Income Tax (TDS)</td>
                    <td className="amount">{formatCurrency(salaryStructure.tds)}</td>
                  </tr>
                  <tr className="total-row">
                    <td><strong>Total Deductions</strong></td>
                    <td className="amount total">
                      <strong>{formatCurrency(salaryStructure.deductions)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Pay */}
          <div className="net-pay-section-preview">
            <div className="net-pay-card">
              <div className="net-pay-header">
                <span className="net-pay-label">NET PAYABLE</span>
                <span className="net-pay-amount">{formatCurrency(salaryStructure.netPay)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="payslip-footer-preview">
            <div className="company-footer">
              <p><strong>NOW IT SERVICES PVT LTD</strong></p>
              <p>6-284-1, Uma Shankar Nagar, Revenue Ward -17, YSR Tadigadapa, 520007</p>
              <p>Phone: 7893536373 | Email: hr@nowitservices.com</p>
            </div>
            <div className="footer-notes">
              <p>This is a computer generated payslip and does not require signature.</p>
              <p className="footer-copyright">© {new Date().getFullYear()} NOW IT SERVICES PVT LTD. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="payslip-management-container">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="payslip-header">
        <div className="header-left">
          <FileText size={32} className="header-icon" />
          <div>
            <h1>Payslip Management</h1>
            <p className="subtitle">Generate and manage employee payslips</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn-preview"
            onClick={() => setShowPreview(!showPreview)}
            disabled={!selectedEmployee}
          >
            {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button 
            className="btn-download"
            onClick={() => {
              if (generatedPayslips.length > 0) {
                handleDownloadPayslip(generatedPayslips[0]._id);
              } else {
                toast.info('Please generate payslip first to download');
              }
            }}
            disabled={!selectedEmployee || generatedPayslips.length === 0}
          >
            <Download size={18} />
            Download PDF
          </button>
          <button className="btn-clear" onClick={handleClearForm}>
            <X size={18} />
            Clear Form
          </button>
        </div>
      </div>

      {showPreview && renderPreview()}

      {!showPreview && (
        <div className="payslip-form-section">
          {/* Month & Year Selection */}
          <div className="form-section card">
            <div className="section-header">
              <Calendar size={20} className="section-icon" />
              <h3>Select Period</h3>
            </div>
            <div className="period-selector">
              <div className="form-group">
                <label>Month</label>
                <select 
                  className="form-control"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="">Select Month</option>
                  {months.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Year</label>
                <select 
                  className="form-control"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option value="">Select Year</option>
                  {years.map(year => (
                    <option key={year.value} value={year.value}>
                      {year.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Working Days</label>
                <div className="working-days-display">
                  <span className="days-count">{workingDays}</span>
                  <span className="days-label">days</span>
                  {holidayInfo && (
                    <span className="holidays-info">
                      ({holidayInfo.taken} holidays taken)
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* December Holiday Notice */}
            {selectedMonth === '12' && (
              <div className="holiday-notice">
                <div className="holiday-notice-icon">🎄</div>
                <div className="holiday-notice-content">
                  <strong>December Calculation:</strong> Working days calculated based on actual calendar
                  {holidays.find(h => h.date?.includes('25-12')) && (
                    <div className="christmas-info">
                      Christmas (25th): {holidays.find(h => h.date?.includes('25-12'))?.status === 'TAKEN' ? 'TAKEN - Working day deducted' : 'NOT TAKEN - Working day not deducted'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Employee Selection */}
          <div className="form-section card">
            <div className="section-header">
              <User size={20} className="section-icon" />
              <h3>Employee Details</h3>
            </div>
            
            <div className="employee-dropdown-container">
              <div 
                className="employee-select-trigger"
                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
              >
                <div className="select-label">
                  <User size={16} />
                  <span>{selectedEmployee ? selectedEmployee.fullName : 'Select Employee'}</span>
                </div>
                <ChevronDown size={16} className={`dropdown-arrow ${isEmployeeDropdownOpen ? 'open' : ''}`} />
              </div>
              
              {isEmployeeDropdownOpen && (
                <div className="employee-dropdown-list">
                  {employees.map(employee => (
                    <div
                      key={employee._id}
                      className="employee-dropdown-item"
                      onClick={() => handleEmployeeSelect(employee)}
                    >
                      <div className="employee-dropdown-avatar">
                        <User size={16} />
                      </div>
                      <div className="employee-dropdown-info">
                        <div className="employee-name">{employee.fullName}</div>
                        <div className="employee-email">{employee.email}</div>
                        <div className="employee-id">{employee.employeeId || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {selectedEmployee && (
              <div className="employee-info-grid">
                <InfoField label="Employee ID" value={selectedEmployee.employeeId || 'EMP001'} />
                <InfoField label="Full Name" value={selectedEmployee.fullName} />
                <InfoField label="Email" value={selectedEmployee.email} />
                <InfoField label="Designation" value={selectedEmployee.designation || 'Software Engineer'} />
                <InfoField label="Employee Type" value={getEmployeeType(selectedEmployee.employeeId)} />
                <InfoField label="Working Days" value={`${workingDays} days`} />
              </div>
            )}
          </div>

          {/* Bank Details */}
          <div className="form-section card">
            <div className="section-header">
              <Building size={20} className="section-icon" />
              <h3>Bank Details</h3>
              <button 
                className="history-btn" 
                onClick={handleViewHistory}
              >
                <History size={16} />
                View History
              </button>
            </div>
            <BankDetailsForm
              bankDetails={bankDetails}
              onUpdate={setBankDetails}
              employeeId={selectedEmployee?._id}
            />
          </div>

          {/* Salary Structure */}
          <div className="form-section card">
            <div className="section-header">
              <DollarSign size={20} className="section-icon" />
              <h3>Salary Structure</h3>
            </div>
            <SalaryBreakup
              salary={salaryStructure}
              onChange={setSalaryStructure}
            />
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              className="btn-generate"
              onClick={handleGeneratePayslip}
              disabled={!isGenerateButtonEnabled() || loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Generate Payslip
                </>
              )}
            </button>
            <button 
              className="btn-send"
              onClick={handleSendToEmployee}
              disabled={!selectedEmployee}
            >
              <Send size={18} />
              Send to Employee
            </button>
          </div>
        </div>
      )}

      {/* Generated Payslips List */}
      {!showPreview && generatedPayslips.length > 0 && (
        <div className="generated-payslips card">
          <h3>Generated Payslips</h3>
          <div className="payslips-list">
            {generatedPayslips.map((payslip, index) => (
              <div key={payslip._id || index} className="payslip-item">
                <div className="payslip-info">
                  <div className="payslip-month">
                    {months.find(m => m.value === String(payslip.month).padStart(2, '0'))?.label} {payslip.year}
                  </div>
                  <div className="payslip-employee">
                    {selectedEmployee?.fullName} • {selectedEmployee?.designation}
                  </div>
                  <div className="payslip-amount">
                    ₹{payslip.salary?.netPay?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="payslip-actions">
                  <button 
                    className="btn-download-small"
                    onClick={() => handleDownloadPayslip(payslip._id || index)}
                  >
                    <Download size={16} />
                    Download
                  </button>
                  <div className="payslip-details">
                    <span className="employee-id">{selectedEmployee?.employeeId || 'EMP001'}</span>
                    <span className="employee-email">{selectedEmployee?.email}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const InfoField = ({ label, value }) => (
  <div className="info-field">
    <span className="info-label">{label}:</span>
    <span className="info-value">{value}</span>
  </div>
);

export default ManagerPayslip;