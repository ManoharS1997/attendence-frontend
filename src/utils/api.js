// src/utils/api.js
import axios from "axios";

/* =========================
   BASE URL & AXIOS INSTANCE
========================= */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://44.217.109.241/:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/* =========================
   REQUEST/RESPONSE INTERCEPTORS
========================= */

// Request interceptor for adding auth token
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

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("401 detected – token invalid or expired");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // DO NOT redirect here
    }
    return Promise.reject(error);
  }
);


/* =========================
   API METHODS
========================= */

/* =========================
   PROJECT MANAGEMENT
========================= */
const ProjectAPI = {
  create: async (projectData) => {
    const res = await api.post("/projects", projectData);
    return res.data;
  },

  getAll: async () => {
    const res = await api.get("/projects");
    return res.data;
  },

  getMyProjects: async () => {
    const res = await api.get("/projects/my");
    return res.data;
  },

  getById: async (projectId) => {
    const res = await api.get(`/projects/${projectId}`);
    return res.data;
  },

  update: async (projectId, updates) => {
    const res = await api.patch(`/projects/${projectId}`, updates);
    return res.data;
  },

  approve: async (projectId) => {
    const res = await api.patch(`/projects/${projectId}/approve`);
    return res.data;
  },

  reject: async (projectId) => {
    const res = await api.patch(`/projects/${projectId}/reject`);
    return res.data;
  },

  complete: async (projectId) => {
    const res = await api.patch(`/projects/${projectId}/complete`);
    return res.data;
  },

  assignEmployee: async (projectId, userId, role) => {
    const res = await api.post(`/projects/${projectId}/assign`, { userId, role });
    return res.data;
  },

  unassignEmployee: async (projectId, userId) => {
    const res = await api.delete(`/projects/${projectId}/assign/${userId}`);
    return res.data;
  },

  archive: async (projectId) => {
    const res = await api.post(`/projects/${projectId}/archive`);
    return res.data;
  },

  unarchive: async (projectId) => {
    const res = await api.post(`/projects/${projectId}/unarchive`);
    return res.data;
  },
};

/* =========================
   TASK MANAGEMENT
========================= */
const TaskAPI = {
  create: async (taskData) => {
    const res = await api.post("/tasks", taskData);
    return res.data;
  },

  getMyTasks: async () => {
    const res = await api.get("/tasks/my");
    return res.data;
  },

  getProjectTasks: async (projectId) => {
    const res = await api.get(`/tasks/project/${projectId}`);
    return res.data;
  },

  getById: async (taskId) => {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data;
  },

  update: async (taskId, updates) => {
    const res = await api.patch(`/tasks/${taskId}`, updates);
    return res.data;
  },

  approve: async (taskId) => {
    const res = await api.patch(`/tasks/${taskId}/approve`);
    return res.data;
  },

  unapprove: async (taskId) => {
    const res = await api.patch(`/tasks/${taskId}/unapprove`);
    return res.data;
  },

  getStats: async () => {
    const res = await api.get("/tasks/stats/overview");
    return res.data;
  },
};

/* =========================
   EMPLOYEE MANAGEMENT
========================= */
const EmployeeAPI = {
  getAll: async () => {
    const res = await api.get("/employees");
    return res.data;
  },

  getDesignations: async () => {
    try {
      const res = await api.get("/employees/designations");
      return res.data;
    } catch {
      try {
        const employees = await EmployeeAPI.getAll();
        const designationsSet = new Set();
        
        employees.forEach(employee => {
          if (employee.designation) {
            designationsSet.add(employee.designation);
          }
        });
        
        return Array.from(designationsSet).map(designation => ({
          value: designation,
          label: designation
        }));
      } catch {
        return [
          { value: "Software Engineer", label: "Software Engineer" },
          { value: "Senior Software Engineer", label: "Senior Software Engineer" },
          { value: "Project Manager", label: "Project Manager" },
          { value: "HR Manager", label: "HR Manager" },
          { value: "Accountant", label: "Accountant" },
        ];
      }
    }
  },

  updateBankDetails: async (employeeId, bankDetails) => {
    try {
      const res = await api.put(`/employees/${employeeId}/bank-details`, bankDetails);
      return res.data;
    } catch (error) {
      console.error("Error updating bank details:", error);
      throw error;
    }
  },
};

/* =========================
   PAYSLIP MANAGEMENT
========================= */
const PayslipAPI = {
  checkExists: async (employeeId, month, year) => {
    try {
      const res = await api.get(`/payslips/check/${employeeId}/${month}/${year}`);
      return res.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      console.error("Error checking existing payslip:", error);
      return false;
    }
  },

  generate: async (data) => {
    const res = await api.post("/payslips", data);
    return res.data;
  },

  getMyPayslips: async () => {
    const res = await api.get("/payslips/my");
    return res.data;
  },

  getAll: async (params = {}) => {
    try {
      const res = await api.get("/payslips", { params });
      return res.data;
    } catch (error) {
      console.error("Error fetching all payslips:", error);
      throw error;
    }
  },

  getById: async (payslipId) => {
    try {
      const res = await api.get(`/payslips/${payslipId}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching payslip:", error);
      throw error;
    }
  },

  download: async (payslipId) => {
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
  },

  send: async (payslipId) => {
    try {
      const res = await api.post(`/payslips/${payslipId}/send`);
      return res.data;
    } catch (error) {
      console.error("Error sending payslip:", error);
      throw error;
    }
  },

  markAsViewed: async (payslipId) => {
    try {
      const res = await api.patch(`/payslips/${payslipId}/view`);
      return res.data;
    } catch (error) {
      console.error("Error marking payslip as viewed:", error);
      throw error;
    }
  },
};

/* =========================
   BANK DETAILS
========================= */
const BankAPI = {
  getDetails: async (employeeId) => {
    try {
      const res = await api.get(`/bank/${employeeId}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching bank details:", error);
      throw error;
    }
  },

  updateDetails: async (employeeId, bankData) => {
    try {
      const res = await api.post(`/bank/${employeeId}`, bankData);
      return res.data;
    } catch (error) {
      console.error("Error updating bank details:", error);
      throw error;
    }
  },

  getHistory: async (employeeId, page = 1, limit = 20) => {
    try {
      const res = await api.get(`/bank/${employeeId}/history`, {
        params: { page, limit }
      });
      return res.data;
    } catch (error) {
      console.error("Error fetching bank history:", error);
      throw error;
    }
  },

  verify: async (employeeId, notes) => {
    try {
      const res = await api.post(`/bank/${employeeId}/verify`, { notes });
      return res.data;
    } catch (error) {
      console.error("Error verifying bank details:", error);
      throw error;
    }
  },

  getEmployeesWithDetails: async () => {
    try {
      const res = await api.get("/bank/list/employees");
      return res.data;
    } catch (error) {
      console.error("Error fetching employees with bank details:", error);
      throw error;
    }
  },
};

/* =========================
   UTILITIES
========================= */
const UtilsAPI = {
  getJobTitles: () => {
    return [
      "Software Engineer",
      "Senior Software Engineer",
      "Project Manager",
      "HR Manager",
      "Accountant",
      // ... (keep your existing list)
    ];
  },
};

/* =========================
   EXPORT ALL APIs
========================= */
export {
  ProjectAPI,
  TaskAPI,
  EmployeeAPI,
  PayslipAPI,
  BankAPI,
  UtilsAPI,
  api
};

// For backward compatibility - export individual functions
export const {
  // Project APIs
  createProject,
  getAllProjects,
  getMyProjects,
  getProject,
  updateProject,
  approveProject,
  rejectProject,
  completeProject,
  assignEmployeeToProject,
  unassignEmployeeFromProject,
  archiveProject,
  unarchiveProject,
  
  // Task APIs
  createTask,
  getMyTasks,
  getProjectTasks,
  getTask,
  updateTask,
  approveTask,
  unapproveTask,
  getTaskStats,
  
  // Employee APIs
  getEmployees,
  getDesignations,
  updateEmployeeBankDetails,
  
  // Payslip APIs
  checkExistingPayslip,
  generatePayslip,
  getEmployeePayslips,
  downloadPayslipById,
  sendPayslipToEmployee,
  checkPayslipExists,
  sendPayslip,
  getMyPayslips,
  getAllPayslips,
  markPayslipAsViewed,
  getPayslipById,
  
  // Bank APIs
  getBankDetails,
  updateBankDetails,
  getBankHistory,
  verifyBankDetails,
  getEmployeesWithBankDetails,
  
  // Utils
  getJobTitles
} = {
  // Project APIs
  createProject: ProjectAPI.create,
  getAllProjects: ProjectAPI.getAll,
  getMyProjects: ProjectAPI.getMyProjects,
  getProject: ProjectAPI.getById,
  updateProject: ProjectAPI.update,
  approveProject: ProjectAPI.approve,
  rejectProject: ProjectAPI.reject,
  completeProject: ProjectAPI.complete,
  assignEmployeeToProject: ProjectAPI.assignEmployee,
  unassignEmployeeFromProject: ProjectAPI.unassignEmployee,
  archiveProject: ProjectAPI.archive,
  unarchiveProject: ProjectAPI.unarchive,
  
  // Task APIs
  createTask: TaskAPI.create,
  getMyTasks: TaskAPI.getMyTasks,
  getProjectTasks: TaskAPI.getProjectTasks,
  getTask: TaskAPI.getById,
  updateTask: TaskAPI.update,
  approveTask: TaskAPI.approve,
  unapproveTask: TaskAPI.unapprove,
  getTaskStats: TaskAPI.getStats,
  
  // Employee APIs
  getEmployees: EmployeeAPI.getAll,
  getDesignations: EmployeeAPI.getDesignations,
  updateEmployeeBankDetails: EmployeeAPI.updateBankDetails,
  
  // Payslip APIs
  checkExistingPayslip: PayslipAPI.checkExists,
  generatePayslip: PayslipAPI.generate,
  getEmployeePayslips: PayslipAPI.getMyPayslips,
  downloadPayslipById: PayslipAPI.download,
  sendPayslipToEmployee: PayslipAPI.send,
  checkPayslipExists: PayslipAPI.checkExists,
  sendPayslip: PayslipAPI.send,
  getMyPayslips: PayslipAPI.getMyPayslips,
  getAllPayslips: PayslipAPI.getAll,
  markPayslipAsViewed: PayslipAPI.markAsViewed,
  getPayslipById: PayslipAPI.getById,
  
  // Bank APIs
  getBankDetails: BankAPI.getDetails,
  updateBankDetails: BankAPI.updateDetails,
  getBankHistory: BankAPI.getHistory,
  verifyBankDetails: BankAPI.verify,
  getEmployeesWithBankDetails: BankAPI.getEmployeesWithDetails,
  
  // Utils
  getJobTitles: UtilsAPI.getJobTitles
};

export default api;