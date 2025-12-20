// src/pages/ManagerPayslip.jsx
import { useState, useEffect, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../styles/managerPayslip.css';
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
  History,
  Send,
  ChevronDown
} from 'lucide-react';

// Import company logo
import companyLogo from "../assets/Company Logo.PNG";

// Components
import BankDetailsForm from '../components/payslips/BankDetailsForm';
import SalaryBreakup from '../components/payslips/SalaryBreakup';

// API functions
import { 
  getEmployees, 
  generatePayslip, 
  getEmployeePayslips,
  getHolidays,
  updateHolidayTakenStatus
} from '../utils/api';

// Get API URL from environment or use default
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : '/api';

const ManagerPayslip = () => {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);
  const [nonWorkingDays, setNonWorkingDays] = useState(0);
  const [totalDaysInMonth, setTotalDaysInMonth] = useState(0);
  const [weekendsCount, setWeekendsCount] = useState(0);
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

  // Calculate weekends (Sundays + 2nd Saturdays) for any month
  const calculateWeekendsForMonth = useCallback((yearNum, monthNum) => {
    const totalDays = new Date(yearNum, monthNum, 0).getDate();
    let weekends = 0;
    
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(yearNum, monthNum - 1, day);
      const dayOfWeek = date.getDay();
      
      // Sunday - always holiday
      if (dayOfWeek === 0) {
        weekends++;
      }
      // Saturday - check if 2nd Saturday (always holiday)
      else if (dayOfWeek === 6) {
        const weekOfMonth = Math.ceil(day / 7);
        if (weekOfMonth === 2) { // 2nd Saturday
          weekends++;
        }
      }
    }
    
    return weekends;
  }, []);

  // Calculate working days and non-working days
  const calculateMonthDetails = useCallback((yearNum, monthNum, holidaysData) => {
    // Get total days in month
    const totalDays = new Date(yearNum, monthNum, 0).getDate();
    setTotalDaysInMonth(totalDays);
    
    // Calculate weekends (Sundays + 2nd Saturdays)
    const weekends = calculateWeekendsForMonth(yearNum, monthNum);
    setWeekendsCount(weekends);
    
    let workingDaysCount = totalDays - weekends;
    
    // Count TAKEN optional holidays and MANDATORY holidays
    let takenOptionalHolidays = 0;
    let mandatoryHolidays = 0;
    let optionalHolidaysList = [];
    
    holidaysData.forEach(holiday => {
      if (holiday.type === 'MANDATORY') {
        // Mandatory holidays always reduce working days
        workingDaysCount--;
        mandatoryHolidays++;
      } else if (holiday.type === 'OPTIONAL' && holiday.status === 'TAKEN') {
        // Optional holidays only reduce working days if TAKEN
        workingDaysCount--;
        takenOptionalHolidays++;
        optionalHolidaysList.push({
          date: holiday.date,
          occasion: holiday.occasion,
          type: holiday.type
        });
      }
    });
    
    // Ensure minimum 0 working days
    if (workingDaysCount < 0) workingDaysCount = 0;
    
    // Calculate non-working days
    const nonWorkingDaysCount = totalDays - workingDaysCount;
    
    return {
      workingDays: workingDaysCount,
      nonWorkingDays: nonWorkingDaysCount,
      weekends,
      takenOptionalHolidays,
      mandatoryHolidays,
      optionalHolidaysList,
      totalDays
    };
  }, [calculateWeekendsForMonth]);

  // Fetch holidays and calculate working days
  const fetchHolidaysAndWorkingDays = useCallback(async () => {
    if (selectedMonth && selectedYear) {
      try {
        // Fetch holidays for the selected month
        const holidaysData = await getHolidays(selectedMonth, selectedYear);
        setHolidays(holidaysData);
        
        // Calculate month details
        const yearNum = parseInt(selectedYear);
        const monthNum = parseInt(selectedMonth);
        
        const monthDetails = calculateMonthDetails(yearNum, monthNum, holidaysData);
        setWorkingDays(monthDetails.workingDays);
        setNonWorkingDays(monthDetails.nonWorkingDays);
        setWeekendsCount(monthDetails.weekends);
        
        // Log calculation for debugging
        console.log(`${selectedMonth}/${selectedYear}:`, {
          totalDays: monthDetails.totalDays,
          weekends: monthDetails.weekends,
          mandatoryHolidays: monthDetails.mandatoryHolidays,
          takenOptionalHolidays: monthDetails.takenOptionalHolidays,
          workingDays: monthDetails.workingDays
        });
        
      } catch (err) {
        console.error('Failed to fetch holidays:', err);
        // Calculate approximate working days
        const yearNum = parseInt(selectedYear);
        const monthNum = parseInt(selectedMonth);
        const totalDays = new Date(yearNum, monthNum, 0).getDate();
        const weekends = calculateWeekendsForMonth(yearNum, monthNum);
        const approximateWorkingDays = totalDays - weekends;
        
        setWorkingDays(approximateWorkingDays);
        setNonWorkingDays(totalDays - approximateWorkingDays);
        setWeekendsCount(weekends);
        setTotalDaysInMonth(totalDays);
      }
    }
  }, [selectedMonth, selectedYear, calculateMonthDetails, calculateWeekendsForMonth]);

  // Load holidays and working days when month/year changes
  useEffect(() => {
    fetchHolidaysAndWorkingDays();
  }, [fetchHolidaysAndWorkingDays]);

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

  // Handle holiday status change (TAKEN/NOT_TAKEN)
  const handleHolidayStatusChange = async (holidayId, newStatus) => {
    try {
      await updateHolidayTakenStatus(holidayId, newStatus);
      
      // Update local state
      const updatedHolidays = holidays.map(holiday => 
        holiday._id === holidayId ? { ...holiday, status: newStatus } : holiday
      );
      setHolidays(updatedHolidays);
      
      // Recalculate working days
      const yearNum = parseInt(selectedYear);
      const monthNum = parseInt(selectedMonth);
      const monthDetails = calculateMonthDetails(yearNum, monthNum, updatedHolidays);
      setWorkingDays(monthDetails.workingDays);
      setNonWorkingDays(monthDetails.nonWorkingDays);
      setWeekendsCount(monthDetails.weekends);
      
      toast.success(`Holiday status updated to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update holiday status:', err);
      toast.error('Failed to update holiday status');
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

  // Check if Download button should be enabled - SIMPLIFIED
  const isDownloadButtonEnabled = () => {
    // Check if any payslip exists for the selected employee
    if (generatedPayslips.length === 0) return false;
    
    // Find if there's a payslip for the selected month and year
    const hasPayslipForPeriod = generatedPayslips.some(payslip => 
      payslip.month === parseInt(selectedMonth) && 
      payslip.year === parseInt(selectedYear)
    );
    
    return hasPayslipForPeriod;
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

      await generatePayslip(payslipData);
      
      toast.success('Payslip generated successfully! Sent to employee and admin.');
      
      // Refresh payslip list
      const updatedPayslips = await getEmployeePayslips(selectedEmployee._id);
      setGeneratedPayslips(updatedPayslips);
      
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
    if (!payslipId) {
      toast.error('No payslip available to download');
      return;
    }

    setDownloading(true);
    
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Direct download without redirection
      const response = await fetch(`${API_URL}/payslips/${payslipId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download payslip');
      }

      // Get the blob data
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip-${selectedEmployee?.fullName}-${selectedMonth}-${selectedYear}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Payslip downloaded successfully');
      
    } catch (err) {
      console.error('Failed to download payslip:', err);
      toast.error('Failed to download payslip');
    } finally {
      setDownloading(false);
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
    const mandatoryHolidays = holidays.filter(h => h.type === 'MANDATORY');
    
    return {
      taken: takenHolidays.length,
      notTaken: notTakenHolidays.length,
      mandatory: mandatoryHolidays.length,
      total: holidays.length
    };
  };

  const holidayInfo = getHolidayInfo();

  // Get example calculation text based on selected month
  const getMonthCalculationExample = () => {
    if (!selectedMonth || !selectedYear) return '';
    
    const yearNum = parseInt(selectedYear);
    const monthNum = parseInt(selectedMonth);
    const totalDays = new Date(yearNum, monthNum, 0).getDate();
    const weekends = weekendsCount;
    const mandatoryHolidays = holidayInfo.mandatory || 0;
    const takenOptional = holidayInfo.taken || 0;
    
    return `${totalDays} total days - ${weekends} weekends - ${mandatoryHolidays} mandatory holidays - ${takenOptional} optional holidays taken = ${workingDays} working days`;
  };

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
          {/* Company Header with Logo */}
          <div className="company-header-preview">
            <div className="company-logo-container">
              <img src={companyLogo} alt="Company Logo" className="company-logo-img" />
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

          {/* Footer with Company Address */}
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
              if (isDownloadButtonEnabled()) {
                // Find the payslip for current month/year
                const currentPayslip = generatedPayslips.find(payslip => 
                  payslip.month === parseInt(selectedMonth) && 
                  payslip.year === parseInt(selectedYear)
                );
                if (currentPayslip) {
                  handleDownloadPayslip(currentPayslip._id);
                } else {
                  toast.info('No payslip found for selected period');
                }
              } else {
                toast.info('Please generate payslip first to download');
              }
            }}
            disabled={!selectedEmployee || !isDownloadButtonEnabled() || downloading}
          >
            {downloading ? (
              <>
                <div className="spinner small"></div>
                Downloading...
              </>
            ) : (
              <>
                <Download size={18} />
                Download PDF
              </>
            )}
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
                  <div className="days-breakdown">
                    <span className="breakdown-text">
                      ({totalDaysInMonth} total - {nonWorkingDays} non-working)
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Working Days Calculation */}
            <div className="calculation-display">
              <h4>Calculation:</h4>
              <div className="calculation-formula">
                {getMonthCalculationExample()}
              </div>
            </div>
            
            {/* Working Days Breakdown */}
            <div className="working-days-breakdown">
              <h4>Days Breakdown for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</h4>
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <span className="breakdown-label">Total Days:</span>
                  <span className="breakdown-value">{totalDaysInMonth}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Weekends (Sundays + 2nd Sat):</span>
                  <span className="breakdown-value blue">{weekendsCount}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Mandatory Holidays:</span>
                  <span className="breakdown-value purple">{holidayInfo.mandatory || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Optional Holidays Taken:</span>
                  <span className="breakdown-value orange">{holidayInfo.taken || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Working Days:</span>
                  <span className="breakdown-value green">{workingDays}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Non-Working Days:</span>
                  <span className="breakdown-value red">{nonWorkingDays}</span>
                </div>
              </div>
            </div>
            
            {/* Holidays List */}
            {holidays.length > 0 && (
              <div className="holidays-list">
                <h4>Holidays for {months.find(m => m.value === selectedMonth)?.label}</h4>
                <div className="holidays-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Occasion</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.map(holiday => (
                        <tr key={holiday._id}>
                          <td>{holiday.date}</td>
                          <td>{holiday.occasion}</td>
                          <td>
                            <span className={`holiday-type ${holiday.type?.toLowerCase()}`}>
                              {holiday.type}
                            </span>
                          </td>
                          <td>
                            <span className={`holiday-status ${holiday.status?.toLowerCase()}`}>
                              {holiday.status}
                            </span>
                          </td>
                          <td>
                            {holiday.type === 'OPTIONAL' && (
                              <select 
                                className="status-select"
                                value={holiday.status}
                                onChange={(e) => handleHolidayStatusChange(holiday._id, e.target.value)}
                              >
                                <option value="TAKEN">Mark as TAKEN</option>
                                <option value="NOT_TAKEN">Mark as NOT TAKEN</option>
                              </select>
                            )}
                            {holiday.type !== 'OPTIONAL' && (
                              <span className="fixed-status">Fixed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Month-specific examples */}
            {selectedMonth === '12' && (
              <div className="holiday-notice">
                <div className="holiday-notice-icon">🎄</div>
                <div className="holiday-notice-content">
                  <strong>December Example:</strong> 31 days - 5 weekends - 0 mandatory holidays - 1 optional (Christmas) = 25 working days
                </div>
              </div>
            )}
            
            {selectedMonth === '08' && (
              <div className="holiday-notice">
                <div className="holiday-notice-icon">🇮🇳</div>
                <div className="holiday-notice-content">
                  <strong>August Example:</strong> 31 days - 5 weekends - 1 mandatory holiday (Independence Day) - 0 optional = 25 working days
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
          <div className="payslips-header">
            <h3>Generated Payslips</h3>
            <div className="download-status">
              {isDownloadButtonEnabled() ? (
                <span className="download-available">✓ PDF Available for {selectedMonth}/{selectedYear}</span>
              ) : (
                <span className="download-unavailable">No PDF for {selectedMonth}/{selectedYear}</span>
              )}
            </div>
          </div>
          <div className="payslips-list">
            {generatedPayslips.map(payslip => (
              <div key={payslip._id} className="payslip-item">
                <div className="payslip-info">
                  <div className="payslip-month">
                    {months.find(m => m.value === String(payslip.month).padStart(2, '0'))?.label} {payslip.year}
                    {payslip.month === parseInt(selectedMonth) && payslip.year === parseInt(selectedYear) && (
                      <span className="current-period-badge">Current</span>
                    )}
                  </div>
                  <div className="payslip-employee">
                    {selectedEmployee?.fullName} • {selectedEmployee?.designation}
                  </div>
                  <div className="payslip-amount">
                    ₹{payslip.salary?.netPay?.toLocaleString() || '0'}
                  </div>
                  <div className="payslip-days">
                    {payslip.salary?.workingDays || workingDays} working days
                  </div>
                </div>
                <button 
                  className="btn-download-small"
                  onClick={() => handleDownloadPayslip(payslip._id)}
                  disabled={downloading}
                >
                  {downloading ? (
                    <div className="spinner tiny"></div>
                  ) : (
                    <Download size={16} />
                  )}
                  Download
                </button>
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