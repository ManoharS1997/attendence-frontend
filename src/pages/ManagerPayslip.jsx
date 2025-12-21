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
  Layout,
  Printer,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Check,
  Mail,
  Phone,
  Briefcase,
  Clock,
  Globe,
  BanknoteIcon,
  Search
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
  getEmployeePayslips
} from '../utils/api';

// Get API URL from environment or use default
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : '/api';

// Payslip Templates Data
const PAYSLIP_TEMPLATES = [
  {
    id: 'template-1',
    name: 'Professional Blue',
    description: 'Modern blue design with clean layout',
    className: 'template-blue',
    colors: {
      primary: '#1e40af',
      secondary: '#3b82f6',
      accent: '#60a5fa'
    }
  },
  {
    id: 'template-2',
    name: 'Corporate Green',
    description: 'Corporate green theme with elegant typography',
    className: 'template-green',
    colors: {
      primary: '#065f46',
      secondary: '#10b981',
      accent: '#34d399'
    }
  },
  {
    id: 'template-3',
    name: 'Classic Gray',
    description: 'Classic professional design in gray tones',
    className: 'template-gray',
    colors: {
      primary: '#374151',
      secondary: '#6b7280',
      accent: '#9ca3af'
    }
  }
];

const ManagerPayslip = () => {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(PAYSLIP_TEMPLATES[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);
  const [totalDaysInMonth, setTotalDaysInMonth] = useState(0);
  const [weekendsCount, setWeekendsCount] = useState(0);
  const [mandatoryHolidaysCount, setMandatoryHolidaysCount] = useState(0);
  const [optionalHolidaysTaken, setOptionalHolidaysTaken] = useState(0);
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
  const [employeeLoading, setEmployeeLoading] = useState(true);
  const [lastGeneratedPayslip, setLastGeneratedPayslip] = useState(null);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get current month and year
  useEffect(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setSelectedMonth(month);
    setSelectedYear(year.toString());
  }, []);

  // Load employees with error handling
  useEffect(() => {
    const fetchEmployeesData = async () => {
      setEmployeeLoading(true);
      try {
        const data = await getEmployees();
        setEmployees(data || []);
        if (!data || data.length === 0) {
          console.warn('No employees found or empty response');
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
        toast.error('Failed to load employees. Please check connection.');
        setEmployees([]);
      } finally {
        setEmployeeLoading(false);
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
        if (weekOfMonth === 2) {
          weekends++;
        }
      }
    }
    
    return {
      weekends
    };
  }, []);

  // Predefined mandatory holidays for 2024-2025
  const getMandatoryHolidaysForMonth = useCallback((monthNum) => {
    const holidaysList = [];
    
    // Republic Day
    if (monthNum === 1) holidaysList.push({ day: 26, name: 'Republic Day' });
    
    // Independence Day
    if (monthNum === 8) holidaysList.push({ day: 15, name: 'Independence Day' });
    
    // Gandhi Jayanti
    if (monthNum === 10) holidaysList.push({ day: 2, name: 'Gandhi Jayanti' });
    
    return holidaysList;
  }, []);

  // Calculate working days
  const calculateMonthDetails = useCallback((yearNum, monthNum) => {
    // Get total days in month
    const totalDays = new Date(yearNum, monthNum, 0).getDate();
    setTotalDaysInMonth(totalDays);
    
    // Calculate weekends (Sundays + 2nd Saturdays)
    const weekendData = calculateWeekendsForMonth(yearNum, monthNum);
    setWeekendsCount(weekendData.weekends);
    
    // Get mandatory holidays for this month
    const mandatoryHolidays = getMandatoryHolidaysForMonth(monthNum);
    setMandatoryHolidaysCount(mandatoryHolidays.length);
    
    let workingDaysCount = totalDays - weekendData.weekends - mandatoryHolidays.length;
    
    // Ensure minimum 0 working days
    if (workingDaysCount < 0) workingDaysCount = 0;
    
    setOptionalHolidaysTaken(0); // Reset optional holidays for now
    
    console.log(`Month ${monthNum}/${yearNum}:`, {
      totalDays,
      weekends: weekendData.weekends,
      mandatoryHolidays: mandatoryHolidays.length,
      workingDays: workingDaysCount,
    });
    
    return {
      workingDays: workingDaysCount,
      weekends: weekendData.weekends,
      mandatoryHolidays: mandatoryHolidays.length,
      totalDays
    };
  }, [calculateWeekendsForMonth, getMandatoryHolidaysForMonth]);

  // Calculate working days when month/year changes
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      try {
        const yearNum = parseInt(selectedYear);
        const monthNum = parseInt(selectedMonth);
        const monthDetails = calculateMonthDetails(yearNum, monthNum);
        setWorkingDays(monthDetails.workingDays);
      } catch (err) {
        console.error('Failed to calculate working days:', err);
      }
    }
  }, [selectedMonth, selectedYear, calculateMonthDetails]);

  // Filter employees based on search term
  const filteredEmployees = employees.filter(employee => {
    if (!searchTerm.trim()) return true;
    
    const term = searchTerm.toLowerCase();
    return (
      employee.fullName?.toLowerCase().includes(term) ||
      employee.email?.toLowerCase().includes(term) ||
      employee.employeeId?.toLowerCase().includes(term) ||
      employee.designation?.toLowerCase().includes(term)
    );
  });

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    
    if (employee?._id) {
      const loadEmployeePayslipsData = async () => {
        try {
          const payslips = await getEmployeePayslips(employee._id);
          setGeneratedPayslips(payslips || []);
          
          // Find last generated payslip for the selected month/year
          const currentPayslip = payslips?.find(p => 
            p.month === parseInt(selectedMonth) && 
            p.year === parseInt(selectedYear)
          );
          setLastGeneratedPayslip(currentPayslip || null);
        } catch (err) {
          console.error('Failed to load payslips:', err);
          setGeneratedPayslips([]);
          setLastGeneratedPayslip(null);
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
        templateId: selectedTemplate.id,
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

      const response = await generatePayslip(payslipData);
      
      toast.success('Payslip generated successfully! Sent to employee and admin.');
      
      // Refresh payslip list
      const updatedPayslips = await getEmployeePayslips(selectedEmployee._id);
      setGeneratedPayslips(updatedPayslips || []);
      
      // Set last generated payslip
      const currentPayslip = updatedPayslips?.find(p => 
        p.month === parseInt(selectedMonth) && 
        p.year === parseInt(selectedYear)
      );
      setLastGeneratedPayslip(currentPayslip || response);
      
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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Use the API endpoint for downloading PDF
      const response = await fetch(`${API_URL}/payslips/${payslipId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to download PDF' }));
        throw new Error(errorData.message || 'Failed to download payslip');
      }

      // Get the blob data
      const blob = await response.blob();
      
      // Check if blob is valid
      if (!blob || blob.size === 0) {
        throw new Error('Empty PDF file received');
      }
      
      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Payslip_${selectedEmployee?.fullName?.replace(/\s+/g, '_')}_${selectedMonth}_${selectedYear}.pdf`;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      toast.success('Payslip downloaded successfully!');
      
    } catch (err) {
      console.error('Failed to download payslip:', err);
      toast.error(err.message || 'Failed to download payslip. Please try again.');
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
    setShowPreview(false);
    setLastGeneratedPayslip(null);
    setIsTemplateDropdownOpen(false);
    setSearchTerm('');
  };

  const handleSendToEmployee = () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    
    if (!lastGeneratedPayslip) {
      toast.info('Please generate payslip first before sending');
      return;
    }
    
    toast.success(`Payslip sent to ${selectedEmployee.email}`);
    // Here you would typically call an API to send email
  };

  const handleViewHistory = () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Render preview in new section
  const renderPreview = () => {
    if (!showPreview || !selectedEmployee) return null;

    return (
      <div className="payslip-full-preview">
        <div className="preview-header-section">
          <h3>Payslip Preview - {selectedTemplate.name}</h3>
          <div className="preview-actions">
            {lastGeneratedPayslip && (
              <button 
                className="btn-download-preview"
                onClick={() => handleDownloadPayslip(lastGeneratedPayslip._id)}
                disabled={downloading}
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
            )}
            <button 
              className="btn-print-preview"
              onClick={() => window.print()}
            >
              <Printer size={18} />
              Print
            </button>
            <button className="close-preview-btn" onClick={() => setShowPreview(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className={`payslip-document ${selectedTemplate.className}`}>
          <style>
            {`
              .payslip-document.template-blue .company-name-large,
              .payslip-document.template-blue .payslip-title-large,
              .payslip-document.template-blue .net-pay-label {
                color: ${selectedTemplate.colors.primary};
              }
              
              .payslip-document.template-green .company-name-large,
              .payslip-document.template-green .payslip-title-large,
              .payslip-document.template-green .net-pay-label {
                color: ${selectedTemplate.colors.primary};
              }
              
              .payslip-document.template-gray .company-name-large,
              .payslip-document.template-gray .payslip-title-large,
              .payslip-document.template-gray .net-pay-label {
                color: ${selectedTemplate.colors.primary};
              }
              
              .payslip-document.template-blue .net-pay-card {
                background: linear-gradient(135deg, ${selectedTemplate.colors.primary}, ${selectedTemplate.colors.secondary});
              }
              
              .payslip-document.template-green .net-pay-card {
                background: linear-gradient(135deg, ${selectedTemplate.colors.primary}, ${selectedTemplate.colors.secondary});
              }
              
              .payslip-document.template-gray .net-pay-card {
                background: linear-gradient(135deg, ${selectedTemplate.colors.primary}, ${selectedTemplate.colors.secondary});
              }
            `}
          </style>
          
          <div className="company-header-preview">
            <div className="company-logo-container">
              <img src={companyLogo} alt="Company Logo" className="company-logo-img" />
            </div>
            <div className="company-name-large">NOW IT SERVICES PVT LTD</div>
            <div className="payslip-title-large">SALARY SLIP</div>
            <div className="payslip-period-large">
              For the month of {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </div>
            <div className="template-badge">
              <Layout size={14} />
              {selectedTemplate.name}
            </div>
          </div>

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

          <div className="net-pay-section-preview">
            <div className="net-pay-card">
              <div className="net-pay-header">
                <span className="net-pay-label">NET PAYABLE</span>
                <span className="net-pay-amount">{formatCurrency(salaryStructure.netPay)}</span>
              </div>
              <div className="net-pay-footer">
                {formatCurrency(salaryStructure.netPay)} only
              </div>
            </div>
          </div>

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

  // Render month calculation formula
  const getMonthCalculationExample = () => {
    if (!selectedMonth || !selectedYear) return '';
    
    const nonWorkingDays = weekendsCount + mandatoryHolidaysCount + optionalHolidaysTaken;
    
    let calculation = `${totalDaysInMonth} total days - ${nonWorkingDays} non-working days`;
    
    return calculation;
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
          <button className="btn-clear" onClick={handleClearForm}>
            <X size={18} />
            Clear Form
          </button>
        </div>
      </div>

      {showPreview && renderPreview()}

      {!showPreview && (
        <>
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
                    <div className="days-count-highlight">{workingDays}</div>
                    <span className="days-label">working days</span>
                    <div className="days-calculation">
                      <span className="calculation-detail">
                        {getMonthCalculationExample()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Working Days Breakdown */}
              <div className="working-days-breakdown">
                <h4>Days Breakdown for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</h4>
                <div className="breakdown-cards-grid">
                  <div className="breakdown-card total-days">
                    <div className="card-icon">📅</div>
                    <div className="card-content">
                      <div className="card-label">Total Days</div>
                      <div className="card-value">{totalDaysInMonth}</div>
                    </div>
                  </div>
                  
                  <div className="breakdown-card weekends-card">
                    <div className="card-icon">🌙</div>
                    <div className="card-content">
                      <div className="card-label">Weekends</div>
                      <div className="card-value">{weekendsCount}</div>
                      <div className="card-detail">Sundays + 2nd Saturdays</div>
                    </div>
                  </div>
                  
                  {mandatoryHolidaysCount > 0 && (
                    <div className="breakdown-card holidays-card">
                      <div className="card-icon">🎉</div>
                      <div className="card-content">
                        <div className="card-label">Public Holidays</div>
                        <div className="card-value">{mandatoryHolidaysCount}</div>
                        <div className="card-detail">Mandatory</div>
                      </div>
                    </div>
                  )}
                  
                  {optionalHolidaysTaken > 0 && (
                    <div className="breakdown-card optional-card">
                      <div className="card-icon">🏖️</div>
                      <div className="card-content">
                        <div className="card-label">Optional Taken</div>
                        <div className="card-value">{optionalHolidaysTaken}</div>
                        <div className="card-detail">Marked as TAKEN</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="breakdown-card working-days-card">
                    <div className="card-icon">💼</div>
                    <div className="card-content">
                      <div className="card-label">Working Days</div>
                      <div className="card-value">{workingDays}</div>
                      <div className="card-detail">For salary calculation</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Selection - IMPROVED UI */}
            <div className="form-section card">
              <div className="section-header">
                <Layout size={20} className="section-icon" />
                <h3>Select Payslip Template</h3>
              </div>
              
              <div className="template-select-enhanced">
                <div className="template-select-header">
                  <label>Choose Template</label>
                  <div 
                    className="selected-template-info"
                    onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                  >
                    <div 
                      className="template-color-indicator" 
                      style={{ backgroundColor: selectedTemplate.colors.primary }}
                    />
                    <span className="selected-template-name">{selectedTemplate.name}</span>
                    <ChevronDown 
                      size={16} 
                      className={`dropdown-arrow ${isTemplateDropdownOpen ? 'open' : ''}`}
                    />
                  </div>
                </div>
                
                {isTemplateDropdownOpen && (
                  <div className="template-dropdown-panel">
                    <div className="dropdown-header">
                      <h4>Select Template</h4>
                      <button 
                        className="close-dropdown"
                        onClick={() => setIsTemplateDropdownOpen(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="template-options-grid">
                      {PAYSLIP_TEMPLATES.map(template => (
                        <div 
                          key={template.id}
                          className={`template-option ${selectedTemplate.id === template.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedTemplate(template);
                            setIsTemplateDropdownOpen(false);
                          }}
                        >
                          <div className="template-option-header">
                            <div 
                              className="template-color-preview"
                              style={{ backgroundColor: template.colors.primary }}
                            />
                            <div className="template-option-name">{template.name}</div>
                            {selectedTemplate.id === template.id && (
                              <Check size={16} className="selected-check" />
                            )}
                          </div>
                          <div className="template-option-description">{template.description}</div>
                          <div className="template-color-palette">
                            <div 
                              className="color-dot" 
                              style={{ backgroundColor: template.colors.primary }}
                              title="Primary Color"
                            />
                            <div 
                              className="color-dot" 
                              style={{ backgroundColor: template.colors.secondary }}
                              title="Secondary Color"
                            />
                            <div 
                              className="color-dot" 
                              style={{ backgroundColor: template.colors.accent }}
                              title="Accent Color"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="template-preview-enhanced">
                  <div className="template-preview-header">
                    <Layout size={18} />
                    <span>Template Preview</span>
                  </div>
                  <div className="template-preview-body">
                    <div 
                      className="preview-color-block primary" 
                      style={{ backgroundColor: selectedTemplate.colors.primary }}
                    >
                      <span>Primary</span>
                    </div>
                    <div 
                      className="preview-color-block secondary" 
                      style={{ backgroundColor: selectedTemplate.colors.secondary }}
                    >
                      <span>Secondary</span>
                    </div>
                    <div 
                      className="preview-color-block accent" 
                      style={{ backgroundColor: selectedTemplate.colors.accent }}
                    >
                      <span>Accent</span>
                    </div>
                  </div>
                  <div className="template-preview-footer">
                    <div className="template-name-display">
                      <strong>{selectedTemplate.name}</strong>
                    </div>
                    <div className="template-description-display">
                      {selectedTemplate.description}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Selection - IMPROVED UI */}
            <div className="form-section card">
              <div className="section-header">
                <User size={20} className="section-icon" />
                <h3>Employee Details</h3>
              </div>
              
              {employeeLoading ? (
                <div className="loading-employees">
                  <div className="spinner"></div>
                  <span>Loading employees...</span>
                </div>
              ) : employees.length === 0 ? (
                <div className="no-employees">
                  <AlertCircle size={20} />
                  <p>No employees found. Please add employees first.</p>
                </div>
              ) : (
                <>
                  <div className="employee-search-container">
                    <div className="search-input-wrapper">
                      <Search size={18} className="search-icon" />
                      <input
                        type="text"
                        className="employee-search-input"
                        placeholder="Search employees by name, email, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searchTerm && (
                        <button 
                          className="clear-search-btn"
                          onClick={() => setSearchTerm('')}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {searchTerm && filteredEmployees.length > 0 && (
                      <div className="search-results-info">
                        Found {filteredEmployees.length} employee(s)
                      </div>
                    )}
                    {searchTerm && filteredEmployees.length === 0 && (
                      <div className="no-results-info">
                        No employees found matching "{searchTerm}"
                      </div>
                    )}
                  </div>
                  
                  <div className="employee-select-enhanced">
                    <label>Select Employee</label>
                    <div className="employee-select-wrapper">
                      <select 
                        className="employee-select"
                        value={selectedEmployee?._id || ''}
                        onChange={(e) => {
                          const employee = employees.find(emp => emp._id === e.target.value);
                          if (employee) handleEmployeeSelect(employee);
                        }}
                      >
                        <option value="">-- Select Employee --</option>
                        {filteredEmployees.map(employee => (
                          <option key={employee._id} value={employee._id}>
                            {employee.fullName} ({employee.email})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-arrow" />
                    </div>
                  </div>
                  
                  {selectedEmployee && (
                    <div className="employee-profile-card">
                      <div className="profile-header">
                        <div className="profile-avatar">
                          <User size={32} />
                        </div>
                        <div className="profile-info">
                          <h4 className="employee-name">{selectedEmployee.fullName}</h4>
                          <div className="employee-meta">
                            <span className="badge employee-id">
                              <Briefcase size={12} />
                              {selectedEmployee.employeeId || 'EMP001'}
                            </span>
                            <span className="badge employee-type">
                              <Clock size={12} />
                              {getEmployeeType(selectedEmployee.employeeId)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="profile-details-grid">
                        <div className="detail-item">
                          <Mail size={16} className="detail-icon" />
                          <div className="detail-content">
                            <div className="detail-label">Email</div>
                            <div className="detail-value">{selectedEmployee.email}</div>
                          </div>
                        </div>
                        
                        <div className="detail-item">
                          <Briefcase size={16} className="detail-icon" />
                          <div className="detail-content">
                            <div className="detail-label">Designation</div>
                            <div className="detail-value">{selectedEmployee.designation || 'Employee'}</div>
                          </div>
                        </div>
                        
                        <div className="detail-item">
                          <Globe size={16} className="detail-icon" />
                          <div className="detail-content">
                            <div className="detail-label">Status</div>
                            <div className="detail-value status-active">
                              <div className="status-dot"></div>
                              Active
                            </div>
                          </div>
                        </div>
                        
                        <div className="detail-item">
                          <BanknoteIcon size={16} className="detail-icon" />
                          <div className="detail-content">
                            <div className="detail-label">Working Days</div>
                            <div className="detail-value days-count">
                              {workingDays} <span className="days-unit">days</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
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
                  disabled={!selectedEmployee}
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
                disabled={!lastGeneratedPayslip}
              >
                <Send size={18} />
                {lastGeneratedPayslip ? 'Send to Employee' : 'Generate First'}
              </button>
            </div>
          </div>

          {/* Generated Payslips List */}
          {generatedPayslips.length > 0 && (
            <div className="generated-payslips card">
              <div className="payslips-header">
                <h3>Generated Payslips</h3>
                <div className="download-status">
                  <CheckCircle size={16} className="check-icon" />
                  <span>PDF Download Available</span>
                </div>
              </div>
              <div className="payslips-list">
                {generatedPayslips.slice(0, 5).map(payslip => (
                  <div key={payslip._id} className="payslip-item">
                    <div className="payslip-info">
                      <div className="payslip-month">
                        {months.find(m => m.value === String(payslip.month).padStart(2, '0'))?.label} {payslip.year}
                        {payslip._id === lastGeneratedPayslip?._id && (
                          <span className="current-badge">Current</span>
                        )}
                      </div>
                      <div className="payslip-amount">
                        Net Pay: ₹{payslip.salary?.netPay?.toLocaleString() || '0'}
                      </div>
                      <div className="payslip-days">
                        {payslip.salary?.workingDays || 'N/A'} working days
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
                      Download PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManagerPayslip;