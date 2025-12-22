// src/pages/ManagerPayslip.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../styles/managerPayslip.css';
import { 
  Calendar, 
  User, 
  Building, 
  DollarSign, 
  Eye, 
  EyeOff,
  FileText,
  Save,
  X,
  Layout,
  Printer,
  AlertCircle,
  ChevronDown,
  Check,
  Search,
  Download,
  Loader2,
  Send,
  Share2
} from 'lucide-react';

// Import company logo
import companyLogo from "../assets/Company Logo.PNG";

// Components
import BankDetailsForm from '../components/payslips/BankDetailsForm';
import SalaryBreakup from '../components/payslips/SalaryBreakup';

// API functions
import { 
  getEmployees, 
  generatePayslip
} from '../utils/api';

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
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(PAYSLIP_TEMPLATES[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);
  const [monthDetails, setMonthDetails] = useState({
    totalDays: 0,
    weekends: 0,
    mandatoryHolidays: 0,
    workingDays: 0
  });
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
  const [employeeLoading, setEmployeeLoading] = useState(true);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const previewRef = useRef(null);

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
      setEmployeeLoading(true);
      try {
        const data = await getEmployees();
        setEmployees(data || []);
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

  // Calculate weekends
  const calculateWeekendsForMonth = useCallback((yearNum, monthNum) => {
    const totalDays = new Date(yearNum, monthNum, 0).getDate();
    let weekends = 0;
    
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(yearNum, monthNum - 1, day);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 0) weekends++;
      else if (dayOfWeek === 6) {
        const weekOfMonth = Math.ceil(day / 7);
        if (weekOfMonth === 2) weekends++;
      }
    }
    
    return { weekends };
  }, []);

  // Get mandatory holidays
  const getMandatoryHolidaysForMonth = useCallback((monthNum) => {
    const holidaysList = [];
    if (monthNum === 1) holidaysList.push({ day: 26, name: 'Republic Day' });
    if (monthNum === 8) holidaysList.push({ day: 15, name: 'Independence Day' });
    if (monthNum === 10) holidaysList.push({ day: 2, name: 'Gandhi Jayanti' });
    return holidaysList;
  }, []);

  // Calculate month details
  const calculateMonthDetails = useCallback((yearNum, monthNum) => {
    const totalDays = new Date(yearNum, monthNum, 0).getDate();
    
    const weekendData = calculateWeekendsForMonth(yearNum, monthNum);
    const weekends = weekendData.weekends;
    
    const mandatoryHolidays = getMandatoryHolidaysForMonth(monthNum);
    const mandatoryHolidaysCount = mandatoryHolidays.length;
    
    let workingDaysCount = totalDays - weekends - mandatoryHolidaysCount;
    if (workingDaysCount < 0) workingDaysCount = 0;
    
    return {
      totalDays,
      weekends,
      mandatoryHolidays: mandatoryHolidaysCount,
      workingDays: workingDaysCount
    };
  }, [calculateWeekendsForMonth, getMandatoryHolidaysForMonth]);

  // Update month details when month/year changes
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      try {
        const yearNum = parseInt(selectedYear);
        const monthNum = parseInt(selectedMonth);
        const details = calculateMonthDetails(yearNum, monthNum);
        setMonthDetails(details);
        setWorkingDays(details.workingDays);
      } catch (err) {
        console.error('Failed to calculate month details:', err);
      }
    }
  }, [selectedMonth, selectedYear, calculateMonthDetails]);

  // Filter employees
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

  // Handle employee selection
  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    
    if (employee?._id) {
      setBankDetails({
        bankName: employee.bankName || '',
        accountNumber: employee.accountNumber || '',
        ifsc: employee.ifsc || '',
        branch: employee.branch || '',
        history: []
      });
    }
  };

  // Calculate salary - moved inside useEffect to avoid dependency warning
  useEffect(() => {
    const calculateSalary = () => {
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
    };

    calculateSalary();
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

  // Check if Generate Payslip button should be enabled
  const isGenerateButtonEnabled = () => {
    return selectedEmployee && 
           bankDetails.bankName && 
           bankDetails.accountNumber && 
           bankDetails.ifsc &&
           salaryStructure.basic > 0;
  };

  // Generate payslip
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
        workingDays: workingDays,
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
          allowances: salaryStructure.travelAllowance +
                     salaryStructure.medicalAllowance +
                     salaryStructure.specialAllowance
        }
      };

      console.log('Generating payslip with data:', payslipData);

      await generatePayslip(payslipData);
      
      toast.success('Payslip generated successfully!');
      
      // Enable preview
      setShowPreview(true);
      
    } catch (err) {
      console.error('Failed to generate payslip:', err);
      toast.error(err.message || 'Failed to generate payslip');
    } finally {
      setLoading(false);
    }
  };

  // ✅ ENHANCED PDF DOWNLOAD FUNCTION WITH COMPANY LOGO - SINGLE PAGE
  const handleDownloadPDF = () => {
    console.log('Download PDF clicked');
    
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }

    setGeneratingPDF(true);
    
    // Generate HTML content with company logo
    const htmlContent = generatePayslipHTML();
    
    // Open print dialog which allows saving as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load
    setTimeout(() => {
      printWindow.print();
      setGeneratingPDF(false);
      toast.success('PDF download started via print dialog');
    }, 1000);
  };

  // Generate HTML for PDF with company logo - SINGLE PAGE OPTIMIZED
  const generatePayslipHTML = () => {
    const monthName = months.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const logoUrl = companyLogo;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${selectedEmployee?.fullName}</title>
          <style>
            @page { 
              size: A4;
              margin: 10mm 15mm;
              size: portrait;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0;
              color: #333;
              background-color: #fff;
              font-size: 11px;
              line-height: 1.4;
            }
            .container { 
              width: 100%;
              max-height: 277mm;
              padding: 15px;
              background-color: #fff;
              box-sizing: border-box;
            }
            .company-header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1.5px solid ${selectedTemplate.colors.primary};
              position: relative;
              page-break-inside: avoid;
            }
            .company-logo-section {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .company-logo {
              height: 50px;
              width: auto;
              max-width: 120px;
              object-fit: contain;
            }
            .company-name { 
              font-size: 18px; 
              font-weight: bold; 
              color: ${selectedTemplate.colors.primary};
              margin: 0;
            }
            .payslip-title { 
              font-size: 16px; 
              font-weight: bold; 
              margin: 5px 0 3px 0;
              color: #374151;
            }
            .period { 
              font-size: 12px; 
              color: #666; 
              margin-bottom: 5px;
              font-weight: 500;
            }
            .template-badge {
              position: absolute;
              top: 0;
              right: 0;
              background-color: ${selectedTemplate.colors.accent};
              color: white;
              padding: 3px 8px;
              border-radius: 3px;
              font-size: 10px;
              font-weight: 500;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 10px;
              font-size: 10px;
              page-break-inside: avoid;
            }
            th, td { 
              border: 0.8px solid #cbd5e1; 
              padding: 8px; 
              text-align: left;
              vertical-align: top;
            }
            th { 
              background-color: #f1f5f9; 
              font-weight: 600;
              color: #374151;
              font-size: 10px;
            }
            .amount { 
              text-align: right; 
              font-weight: 500;
            }
            .total-row { 
              border-top: 1.5px solid #cbd5e1; 
              font-weight: bold;
              background-color: #f8fafc;
            }
            .net-pay-section {
              background: linear-gradient(135deg, ${selectedTemplate.colors.primary}, ${selectedTemplate.colors.secondary});
              color: white;
              padding: 15px;
              border-radius: 6px;
              text-align: center;
              margin: 15px 0;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              page-break-inside: avoid;
            }
            .net-pay-label { 
              font-size: 12px; 
              margin-bottom: 5px;
              opacity: 0.9;
            }
            .net-pay-amount { 
              font-size: 20px; 
              font-weight: bold; 
              margin-bottom: 5px;
              letter-spacing: 0.5px;
            }
            .net-pay-words {
              font-size: 10px;
              opacity: 0.9;
            }
            .footer { 
              margin-top: 15px; 
              padding-top: 10px; 
              border-top: 0.8px solid #e2e8f0; 
              text-align: center; 
              font-size: 9px; 
              color: #64748b;
              page-break-inside: avoid;
            }
            .salary-breakdown {
              display: flex;
              gap: 10px;
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .earnings-section, .deductions-section {
              flex: 1;
              min-width: 0;
            }
            .section-title {
              color: ${selectedTemplate.colors.primary};
              margin-bottom: 8px;
              padding-bottom: 4px;
              border-bottom: 1.5px solid ${selectedTemplate.colors.accent};
              font-size: 12px;
              font-weight: 600;
            }
            .employee-info-table {
              margin-bottom: 15px;
              background-color: #f8fafc;
              border-radius: 5px;
              overflow: hidden;
            }
            .employee-info-table th {
              background-color: ${selectedTemplate.colors.secondary}20;
              color: ${selectedTemplate.colors.primary};
            }
            .bank-info {
              margin-bottom: 15px;
              background-color: #f8fafc;
              border-radius: 5px;
              overflow: hidden;
            }
            .bank-info th {
              background-color: ${selectedTemplate.colors.secondary}20;
              color: ${selectedTemplate.colors.primary};
            }
            .company-footer {
              margin-top: 3px;
            }
            .company-address {
              font-size: 9px;
              color: #6b7280;
              margin: 3px 0;
            }
            .signature-section {
              margin-top: 15px;
              display: flex;
              justify-content: space-between;
              padding: 10px 20px;
              page-break-inside: avoid;
            }
            .signature-box {
              text-align: center;
              width: 45%;
            }
            .signature-line {
              border-top: 0.8px solid #374151;
              width: 80%;
              margin: 15px auto 5px;
            }
            .signature-label {
              font-size: 9px;
              color: #6b7280;
            }
            .generated-date {
              text-align: right;
              font-size: 9px;
              color: #9ca3af;
              margin-top: 5px;
            }
            /* Compact layout to fit on one page */
            .compact-table td, .compact-table th {
              padding: 6px 8px;
            }
            .compact-section {
              margin-bottom: 12px;
            }
            .no-break {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            @media print {
              body { 
                padding: 0;
                margin: 0;
                font-size: 10px;
              }
              .container {
                box-shadow: none;
                border: none;
                padding: 10px 15px;
                max-height: none;
              }
              .no-print {
                display: none;
              }
              /* Force single page */
              .container > * {
                page-break-inside: avoid;
              }
            }
            /* Ensure everything fits on one page */
            * {
              box-sizing: border-box;
            }
            .info-row {
              display: flex;
              margin-bottom: 2px;
            }
            .info-label {
              font-weight: 600;
              min-width: 120px;
              color: ${selectedTemplate.colors.primary};
            }
            .info-value {
              flex: 1;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Company Header with Logo -->
            <div class="company-header no-break">
              <div class="company-logo-section">
                <img src="${logoUrl}" alt="Company Logo" class="company-logo" />
              </div>
              <div class="company-name">NOW IT SERVICES PVT LTD</div>
              <div class="payslip-title">SALARY SLIP</div>
              <div class="period">For the month of ${monthName} ${selectedYear}</div>
              <div class="template-badge">${selectedTemplate.name}</div>
            </div>

            <!-- Employee Information - Compact -->
            <div class="employee-info-table compact-section no-break">
              <table class="compact-table">
                <tr>
                  <th width="20%">Employee ID</th>
                  <td width="30%">${selectedEmployee?.employeeId || 'EMP001'}</td>
                  <th width="20%">Employee Name</th>
                  <td width="30%">${selectedEmployee?.fullName || 'Employee'}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>${selectedEmployee?.email || 'N/A'}</td>
                  <th>Designation</th>
                  <td>${selectedEmployee?.designation || 'Employee'}</td>
                </tr>
                <tr>
                  <th>Working Days</th>
                  <td>${workingDays} days</td>
                  <th>Employee Type</th>
                  <td>${getEmployeeType(selectedEmployee?.employeeId)}</td>
                </tr>
              </table>
            </div>

            <!-- Bank Information - Compact -->
            <div class="bank-info compact-section no-break">
              <table class="compact-table">
                <tr>
                  <th width="20%">Bank Name</th>
                  <td width="30%">${bankDetails.bankName || 'State Bank of India'}</td>
                  <th width="20%">Account Number</th>
                  <td width="30%">****${bankDetails.accountNumber?.slice(-4) || 'XXXX'}</td>
                </tr>
                <tr>
                  <th>IFSC Code</th>
                  <td>${bankDetails.ifsc || 'SBIN0005943'}</td>
                  <th>Branch</th>
                  <td>${bankDetails.branch || 'SBI Main Branch, Bengaluru'}</td>
                </tr>
              </table>
            </div>

            <!-- Salary Breakdown -->
            <div class="salary-breakdown no-break">
              <div class="earnings-section">
                <div class="section-title">Earnings</div>
                <table class="compact-table">
                  <tbody>
                    <tr><td>Basic Pay</td><td class="amount">₹${salaryStructure.basic?.toLocaleString() || '0'}</td></tr>
                    <tr><td>House Rent Allowance (HRA)</td><td class="amount">₹${salaryStructure.hra?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Conveyance Allowance</td><td class="amount">₹${salaryStructure.conveyance?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Travel Allowance</td><td class="amount">₹${salaryStructure.travelAllowance?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Medical Allowance</td><td class="amount">₹${salaryStructure.medicalAllowance?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Special Allowance</td><td class="amount">₹${salaryStructure.specialAllowance?.toLocaleString() || '0'}</td></tr>
                    <tr class="total-row"><td><strong>Total Earnings</strong></td><td class="amount"><strong>₹${salaryStructure.gross?.toLocaleString() || '0'}</strong></td></tr>
                  </tbody>
                </table>
              </div>

              <div class="deductions-section">
                <div class="section-title">Deductions</div>
                <table class="compact-table">
                  <tbody>
                    <tr><td>Provident Fund (PF)</td><td class="amount">₹${salaryStructure.pf?.toLocaleString() || '0'}</td></tr>
                    <tr><td>ESI Contribution</td><td class="amount">₹${salaryStructure.esi?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Professional Tax</td><td class="amount">₹${salaryStructure.professionalTax?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Income Tax (TDS)</td><td class="amount">₹${salaryStructure.tds?.toLocaleString() || '0'}</td></tr>
                    <tr class="total-row"><td><strong>Total Deductions</strong></td><td class="amount"><strong>₹${salaryStructure.deductions?.toLocaleString() || '0'}</strong></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Net Pay Section -->
            <div class="net-pay-section no-break">
              <div class="net-pay-label">NET PAYABLE AMOUNT</div>
              <div class="net-pay-amount">₹${salaryStructure.netPay?.toLocaleString() || '0'}</div>
              <div class="net-pay-words">${formatCurrency(salaryStructure.netPay)} only</div>
            </div>

            <!-- Signatures - Compact -->
            <div class="signature-section no-break">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Employee Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Authorized Signatory</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer no-break">
              <div class="company-footer">
                <p><strong>NOW IT SERVICES PVT LTD</strong></p>
                <p class="company-address">6-284-1, Uma Shankar Nagar, Revenue Ward -17, YSR Tadigadapa, 520007</p>
                <p class="company-address">Phone: 7893536373 | Email: hr@nowitservices.com</p>
              </div>
              <div class="footer-notes">
                <p><em>This is a computer generated payslip and does not require signature.</em></p>
                <p class="generated-date">Generated on ${new Date().toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p>© ${new Date().getFullYear()} NOW IT SERVICES PVT LTD. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // ✅ SIMPLE PRINT FUNCTION
  const handlePrint = () => {
    console.log('Print clicked');
    
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }

    const htmlContent = generatePayslipHTML();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      toast.success('Print dialog opened');
    }, 500);
  };

  // ✅ SIMPLE SHARE FUNCTION
  const handleShare = () => {
    console.log('Share clicked');
    
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }

    const monthName = months.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const shareText = `Payslip for ${selectedEmployee.fullName}\nMonth: ${monthName} ${selectedYear}\nNet Pay: ₹${salaryStructure.netPay?.toLocaleString() || '0'}\nGenerated on ${new Date().toLocaleDateString()}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText)
        .then(() => toast.success('Payslip details copied to clipboard!'))
        .catch(() => toast.info('Could not copy to clipboard'));
    } else {
      toast.info('Share feature not available on this browser');
    }
  };

  // ✅ SIMPLE SEND FUNCTION
  const handleSendToEmployee = () => {
    console.log('Send clicked');
    
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }

    toast.success(`Payslip ready to send to ${selectedEmployee.email}`);
    // In a real app, you would call an API here to send email
  };

  // Clear form
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
    setIsTemplateDropdownOpen(false);
    setSearchTerm('');
  };

  // Months array
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

  // Years array
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString(), label: year.toString() };
  });

  // Get employee type
  const getEmployeeType = (employeeId) => {
    if (!employeeId) return 'Permanent';
    return employeeId.startsWith('TEMP') ? 'Temporary' : 'Permanent';
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Month calculation display
  const getMonthCalculationDisplay = () => {
    const nonWorkingDays = monthDetails.weekends + monthDetails.mandatoryHolidays;
    return `${monthDetails.totalDays} total days - ${nonWorkingDays} non-working days = ${monthDetails.workingDays} working days`;
  };

  // ✅ PREVIEW ACTION BUTTONS COMPONENT
  const PreviewActionButtons = () => (
    <div className="preview-action-buttons">
      <button 
        className="btn-action-download"
        onClick={handleDownloadPDF}
        disabled={generatingPDF || !selectedEmployee}
        title="Download PDF"
      >
        {generatingPDF ? (
          <>
            <Loader2 size={18} className="spinner" />
            <span>Preparing PDF...</span>
          </>
        ) : (
          <>
            <Download size={18} />
            <span>Download PDF</span>
          </>
        )}
      </button>
      
      <button 
        className="btn-action-print"
        onClick={handlePrint}
        disabled={!selectedEmployee}
        title="Print"
      >
        <Printer size={18} />
        <span>Print</span>
      </button>
      
      <button 
        className="btn-action-share"
        onClick={handleShare}
        disabled={!selectedEmployee}
        title="Share"
      >
        <Share2 size={18} />
        <span>Share</span>
      </button>
      
      <button 
        className="btn-action-send"
        onClick={handleSendToEmployee}
        disabled={!selectedEmployee}
        title="Send to Employee"
      >
        <Send size={18} />
        <span>Send</span>
      </button>
    </div>
  );

  // ✅ RENDER PREVIEW - UPDATED TO MATCH PDF
  const renderPreview = () => {
    if (!showPreview || !selectedEmployee) return null;

    return (
      <div className="payslip-full-preview">
        <div className="preview-header-section">
          <div className="preview-header-left">
            <h3>
              <FileText size={24} />
              Payslip Preview - {selectedTemplate.name}
            </h3>
            <div className="preview-subtitle">
              For {selectedEmployee.fullName} • {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </div>
          </div>
          
          <div className="preview-header-right">
            <PreviewActionButtons />
            <button 
              className="btn-close-preview" 
              onClick={() => setShowPreview(false)}
              title="Close Preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="preview-content-wrapper">
          <div 
            ref={previewRef} 
            className={`payslip-document ${selectedTemplate.className}`}
            id="payslip-preview-content"
            style={{
              // Single page A4 size preview
              width: '210mm',
              minHeight: '297mm',
              margin: '0 auto',
              padding: '15px',
              border: '1px solid #e2e8f0',
              borderRadius: '5px',
              backgroundColor: '#fff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '11px',
              lineHeight: '1.4'
            }}
          >
            {/* Company Header - Updated to match PDF */}
            <div style={{
              textAlign: 'center',
              marginBottom: '15px',
              paddingBottom: '10px',
              borderBottom: `1.5px solid ${selectedTemplate.colors.primary}`,
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '15px',
                marginBottom: '8px'
              }}>
                <img 
                  src={companyLogo} 
                  alt="Company Logo" 
                  style={{
                    height: '50px',
                    width: 'auto',
                    maxWidth: '120px',
                    objectFit: 'contain'
                  }}
                />
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: selectedTemplate.colors.primary,
                margin: '0'
              }}>NOW IT SERVICES PVT LTD</div>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                margin: '5px 0 3px 0',
                color: '#374151'
              }}>SALARY SLIP</div>
              <div style={{
                fontSize: '12px',
                color: '#666',
                marginBottom: '5px',
                fontWeight: '500'
              }}>
                For the month of {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </div>
              <div style={{
                position: 'absolute',
                top: '0',
                right: '0',
                backgroundColor: selectedTemplate.colors.accent,
                color: 'white',
                padding: '3px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: '500'
              }}>
                <Layout size={12} />
                {selectedTemplate.name}
              </div>
            </div>

            {/* Employee Info - Compact */}
            <div style={{
              marginBottom: '15px',
              backgroundColor: '#f8fafc',
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                  <tr>
                    <th style={{
                      width: '20%',
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Employee ID</th>
                    <td style={{
                      width: '30%',
                      padding: '8px',
                      border: '0.8px solid #cbd5e1'
                    }}>{selectedEmployee.employeeId || 'EMP001'}</td>
                    <th style={{
                      width: '20%',
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Employee Name</th>
                    <td style={{
                      width: '30%',
                      padding: '8px',
                      border: '0.8px solid #cbd5e1'
                    }}>{selectedEmployee.fullName}</td>
                  </tr>
                  <tr>
                    <th style={{
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Email</th>
                    <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>{selectedEmployee.email}</td>
                    <th style={{
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Designation</th>
                    <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>{selectedEmployee.designation || 'Software Engineer'}</td>
                  </tr>
                  <tr>
                    <th style={{
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Working Days</th>
                    <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>{workingDays} days</td>
                    <th style={{
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Employee Type</th>
                    <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>{getEmployeeType(selectedEmployee.employeeId)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bank Details - Compact */}
            <div style={{
              marginBottom: '15px',
              backgroundColor: '#f8fafc',
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                  <tr>
                    <th style={{
                      width: '20%',
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Bank Name</th>
                    <td style={{
                      width: '30%',
                      padding: '8px',
                      border: '0.8px solid #cbd5e1'
                    }}>{bankDetails.bankName || 'State Bank of India'}</td>
                    <th style={{
                      width: '20%',
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Account Number</th>
                    <td style={{
                      width: '30%',
                      padding: '8px',
                      border: '0.8px solid #cbd5e1'
                    }}>****{bankDetails.accountNumber?.slice(-4) || '1234'}</td>
                  </tr>
                  <tr>
                    <th style={{
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>IFSC Code</th>
                    <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>{bankDetails.ifsc || 'SBIN0005943'}</td>
                    <th style={{
                      padding: '8px',
                      backgroundColor: `${selectedTemplate.colors.secondary}20`,
                      color: selectedTemplate.colors.primary,
                      border: '0.8px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '10px'
                    }}>Branch</th>
                    <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>{bankDetails.branch || 'SBI Main Branch, Bengaluru'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Salary Breakdown - Updated to match PDF */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                  color: selectedTemplate.colors.primary,
                  marginBottom: '8px',
                  paddingBottom: '4px',
                  borderBottom: `1.5px solid ${selectedTemplate.colors.accent}`,
                  fontSize: '12px',
                  fontWeight: '600'
                }}>Earnings</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Basic Pay</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.basic)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>House Rent Allowance (HRA)</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.hra)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Conveyance Allowance</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.conveyance)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Travel Allowance</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.travelAllowance)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Medical Allowance</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.medicalAllowance)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Special Allowance</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.specialAllowance)}</td>
                    </tr>
                    <tr style={{ borderTop: '1.5px solid #cbd5e1', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}><strong>Total Earnings</strong></td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right' }}>
                        <strong>{formatCurrency(salaryStructure.gross)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                  color: selectedTemplate.colors.primary,
                  marginBottom: '8px',
                  paddingBottom: '4px',
                  borderBottom: `1.5px solid ${selectedTemplate.colors.accent}`,
                  fontSize: '12px',
                  fontWeight: '600'
                }}>Deductions</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Provident Fund (PF)</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.pf)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>ESI Contribution</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.esi)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Professional Tax</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.professionalTax)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}>Income Tax (TDS)</td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(salaryStructure.tds)}</td>
                    </tr>
                    <tr style={{ borderTop: '1.5px solid #cbd5e1', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1' }}><strong>Total Deductions</strong></td>
                      <td style={{ padding: '8px', border: '0.8px solid #cbd5e1', textAlign: 'right' }}>
                        <strong>{formatCurrency(salaryStructure.deductions)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Pay - Updated to match PDF */}
            <div style={{
              background: `linear-gradient(135deg, ${selectedTemplate.colors.primary}, ${selectedTemplate.colors.secondary})`,
              color: 'white',
              padding: '15px',
              borderRadius: '6px',
              textAlign: 'center',
              margin: '15px 0',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontSize: '12px', opacity: '0.9', display: 'block', marginBottom: '5px' }}>NET PAYABLE AMOUNT</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>{formatCurrency(salaryStructure.netPay)}</span>
              </div>
              <div style={{ fontSize: '10px', opacity: '0.9' }}>
                {formatCurrency(salaryStructure.netPay)} only
              </div>
            </div>

            {/* Signatures - Added to match PDF */}
            <div style={{
              marginTop: '15px',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 20px'
            }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ borderTop: '0.8px solid #374151', width: '80%', margin: '15px auto 5px' }}></div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Employee Signature</div>
              </div>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ borderTop: '0.8px solid #374151', width: '80%', margin: '15px auto 5px' }}></div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Authorized Signatory</div>
              </div>
            </div>

            {/* Footer - Updated to match PDF */}
            <div style={{
              marginTop: '15px',
              paddingTop: '10px',
              borderTop: '0.8px solid #e2e8f0',
              textAlign: 'center',
              fontSize: '9px',
              color: '#64748b'
            }}>
              <div>
                <p><strong>NOW IT SERVICES PVT LTD</strong></p>
                <p style={{ fontSize: '9px', color: '#6b7280', margin: '3px 0' }}>6-284-1, Uma Shankar Nagar, Revenue Ward -17, YSR Tadigadapa, 520007</p>
                <p style={{ fontSize: '9px', color: '#6b7280', margin: '3px 0' }}>Phone: 7893536373 | Email: hr@nowitservices.com</p>
              </div>
              <div>
                <p><em>This is a computer generated payslip and does not require signature.</em></p>
                <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '5px', textAlign: 'right' }}>
                  Generated on {new Date().toLocaleDateString('en-IN', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <p>© {new Date().getFullYear()} NOW IT SERVICES PVT LTD. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action buttons at bottom */}
        <div className="preview-footer-actions">
          <PreviewActionButtons />
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
            className={`btn-preview ${showPreview ? 'active' : ''}`}
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
            {/* Period Selection */}
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
                  </div>
                </div>
              </div>
              
              {/* Month Calculation Details */}
              {selectedMonth && selectedYear && (
                <div className="month-calculation-details">
                  <div className="calculation-title">Month Calculation:</div>
                  <div className="calculation-formula">
                    {getMonthCalculationDisplay()}
                  </div>
                  <div className="breakdown-grid">
                    <div className="breakdown-item">
                      <span className="breakdown-label">Total Days:</span>
                      <span className="breakdown-value">{monthDetails.totalDays}</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Weekends:</span>
                      <span className="breakdown-value">{monthDetails.weekends}</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Public Holidays:</span>
                      <span className="breakdown-value">{monthDetails.mandatoryHolidays}</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Working Days:</span>
                      <span className="breakdown-value highlight">{monthDetails.workingDays}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Template Selection */}
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Employee Selection */}
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
                  <p>No employees found.</p>
                </div>
              ) : (
                <>
                  <div className="employee-search-container">
                    <div className="search-input-wrapper">
                      <Search size={18} className="search-icon" />
                      <input
                        type="text"
                        className="employee-search-input"
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="employee-select-enhanced">
                    <label>Select Employee</label>
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
                  </div>
                </>
              )}
            </div>

            {/* Bank Details */}
            <div className="form-section card">
              <div className="section-header">
                <Building size={20} className="section-icon" />
                <h3>Bank Details</h3>
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
        </>
      )}
    </div>
  );
};

export default ManagerPayslip;