// src/utils/api.js
import axios from "axios";

/* =========================
   BASE URL
========================= */
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* =========================
   AXIOS INSTANCE
========================= */
const api = axios.create({
  baseURL: API_BASE_URL,
});

/* =========================
   TOKEN INTERCEPTOR
========================= */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================
   EMPLOYEES
========================= */
export const getEmployees = async () => {
  const res = await api.get("/employees");
  return res.data;
};

/* =========================
   PAYSLIPS
========================= */

// Check if payslip exists (employee + month + year)
export const checkExistingPayslip = async (employeeId, month, year) => {
  try {
    const res = await api.get(
      `/payslips/check/${employeeId}/${month}/${year}`
    );
    return res.data.exists;
  } catch (error) {
    if (error.response?.status === 404) {
      return false;
    }
    console.error("Error checking existing payslip:", error);
    return false;
  }
};

// Generate payslip (manager/admin)
export const generatePayslip = async (data) => {
  const res = await api.post("/payslips", data);
  return res.data;
};

// Get logged-in employee payslips
export const getEmployeePayslips = async () => {
  const res = await api.get("/payslips/my");
  return res.data;
};

// ✅ ONLY VALID DOWNLOAD METHOD (MATCHES BACKEND)
export const downloadPayslipById = async (payslipId) => {
  try {
    const res = await api.get(`/payslips/${payslipId}/download`, {
      responseType: "blob",
    });

    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Payslip_${payslipId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Error downloading payslip:", error);
    throw error;
  }
};

/* =========================
   BANK DETAILS APIs
========================= */

// Get employee bank details
export const getBankDetails = async (employeeId) => {
  try {
    const res = await api.get(`/bank/${employeeId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching bank details:", error);
    throw error;
  }
};

// Update bank details
export const updateBankDetails = async (employeeId, bankData) => {
  try {
    const res = await api.post(`/bank/${employeeId}`, bankData);
    return res.data;
  } catch (error) {
    console.error("Error updating bank details:", error);
    throw error;
  }
};

// Get bank history
export const getBankHistory = async (employeeId, page = 1, limit = 20) => {
  try {
    const res = await api.get(`/bank/${employeeId}/history`, {
      params: { page, limit }
    });
    return res.data;
  } catch (error) {
    console.error("Error fetching bank history:", error);
    throw error;
  }
};

// Verify bank details
export const verifyBankDetails = async (employeeId, notes) => {
  try {
    const res = await api.post(`/bank/${employeeId}/verify`, { notes });
    return res.data;
  } catch (error) {
    console.error("Error verifying bank details:", error);
    throw error;
  }
};

// List all employees with bank details
export const getEmployeesWithBankDetails = async () => {
  try {
    const res = await api.get("/bank/list/employees");
    return res.data;
  } catch (error) {
    console.error("Error fetching employees with bank details:", error);
    throw error;
  }
};

/* =========================
   JOB TITLES APIs
========================= */

// Get all available job titles (static for frontend)
export const getJobTitles = () => {
  return [
    // IT Job Titles
    "Software Engineer",
    "Senior Software Engineer",
    "Software Development Engineer",
    "Full Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "Web Developer",
    "Mobile App Developer",
    "Android Developer",
    "iOS Developer",
    "DevOps Engineer",
    "Cloud Engineer",
    "AWS Solutions Architect",
    "Azure Developer",
    "Google Cloud Engineer",
    "Site Reliability Engineer",
    "Systems Engineer",
    "Network Engineer",
    "Security Engineer",
    "Cybersecurity Analyst",
    "Penetration Tester",
    "Database Administrator",
    "SQL Developer",
    "Data Engineer",
    "Data Scientist",
    "Data Analyst",
    "Machine Learning Engineer",
    "AI Engineer",
    "Business Intelligence Analyst",
    "QA Engineer",
    "Test Engineer",
    "Automation Test Engineer",
    "Manual Test Engineer",
    "Performance Test Engineer",
    "UI/UX Designer",
    "Product Designer",
    "Graphic Designer",
    "Technical Writer",
    "Documentation Specialist",
    "IT Support Engineer",
    "Help Desk Technician",
    "IT Administrator",
    "System Administrator",
    "Network Administrator",
    "IT Manager",
    "Technical Lead",
    "Team Lead",
    "Project Manager",
    "Scrum Master",
    "Product Manager",
    "Product Owner",
    "Business Analyst",
    "Technical Business Analyst",
    "Solution Architect",
    "Enterprise Architect",
    "CTO",
    "IT Director",
    "VP of Engineering",
    "Software Architect",
    "Engineering Manager",
    
    // Non-IT Job Titles
    "HR Manager",
    "HR Executive",
    "Recruiter",
    "Talent Acquisition Specialist",
    "HR Business Partner",
    "Payroll Administrator",
    "HR Coordinator",
    "Training & Development Manager",
    "Compensation & Benefits Analyst",
    
    "Finance Manager",
    "Accountant",
    "Chartered Accountant",
    "Financial Analyst",
    "Accounts Executive",
    "Accounts Payable Specialist",
    "Accounts Receivable Specialist",
    "Treasury Analyst",
    "Tax Consultant",
    "Auditor",
    "Cost Accountant",
    "Financial Controller",
    "CFO",
    
    "Marketing Manager",
    "Digital Marketing Specialist",
    "SEO Specialist",
    "Social Media Manager",
    "Content Writer",
    "Content Marketer",
    "Brand Manager",
    "Marketing Executive",
    "Marketing Analyst",
    "Public Relations Officer",
    
    "Sales Manager",
    "Sales Executive",
    "Business Development Manager",
    "Account Manager",
    "Sales Representative",
    "Sales Consultant",
    "Customer Success Manager",
    "Inside Sales Representative",
    
    "Operations Manager",
    "Operations Executive",
    "Supply Chain Manager",
    "Logistics Manager",
    "Warehouse Manager",
    "Production Manager",
    "Quality Control Manager",
    
    "Administration Manager",
    "Administrative Assistant",
    "Executive Assistant",
    "Office Manager",
    "Receptionist",
    
    "Legal Counsel",
    "Legal Advisor",
    "Compliance Officer",
    "Company Secretary",
    
    "CEO",
    "Managing Director",
    "Director",
    "General Manager",
    "Assistant Manager",
    "Department Head",
    
    "Intern",
    "Trainee",
    "Fresher",
    "Junior Executive",
    "Senior Executive",
    "Associate",
    "Consultant",
    "Specialist",
    "Expert",
    "Advisor"
  ];
};

/* =========================
   PAYSLIP ENHANCED APIs
========================= */

// Check if payslip exists
export const checkPayslipExists = async (employeeId, month, year) => {
  try {
    const res = await api.get(`/payslips/check/${employeeId}/${month}/${year}`);
    return res.data;
  } catch (error) {
    console.error("Error checking payslip:", error);
    return { exists: false };
  }
};

// Send payslip to employee and admin
export const sendPayslip = async (payslipId) => {
  try {
    const res = await api.post(`/payslips/${payslipId}/send`);
    return res.data;
  } catch (error) {
    console.error("Error sending payslip:", error);
    throw error;
  }
};

// Get employee's own payslips
export const getMyPayslips = async () => {
  try {
    const res = await api.get("/payslips/my");
    return res.data;
  } catch (error) {
    console.error("Error fetching my payslips:", error);
    throw error;
  }
};

// Get all payslips (manager/admin)
export const getAllPayslips = async (params = {}) => {
  try {
    const res = await api.get("/payslips", { params });
    return res.data;
  } catch (error) {
    console.error("Error fetching all payslips:", error);
    throw error;
  }
};

// Mark payslip as viewed
export const markPayslipAsViewed = async (payslipId) => {
  try {
    const res = await api.patch(`/payslips/${payslipId}/view`);
    return res.data;
  } catch (error) {
    console.error("Error marking payslip as viewed:", error);
    throw error;
  }
};

// Get payslip by ID
export const getPayslipById = async (payslipId) => {
  try {
    const res = await api.get(`/payslips/${payslipId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching payslip:", error);
    throw error;
  }
};

export default api;