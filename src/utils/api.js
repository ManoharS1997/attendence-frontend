// src/utils/api.js
import axios from 'axios';

// Use Vite environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Payslip Management APIs
export const getEmployees = async () => {
  try {
    const response = await api.get('/employees');
    return response.data;
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

export const getWorkingDays = async (month, year) => {
  try {
    const response = await api.get('/payslips/working-days', {
      params: { month, year }
    });
    return response.data.workingDays || 22;
  } catch (error) {
    console.error('Error fetching working days:', error);
    return 22;
  }
};

export const getHolidays = async (month, year) => {
  try {
    const response = await api.get('/holidays', {
      params: { month, year }
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
};

export const generatePayslip = async (payslipData) => {
  try {
    const response = await api.post('/payslips', payslipData);
    return response.data;
  } catch (error) {
    console.error('Error generating payslip:', error);
    throw error;
  }
};

export const downloadPayslipPDF = async (payslipId) => {
  try {
    const response = await api.get(`/payslips/${payslipId}/download`, {
      responseType: 'blob'
    });
    
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payslip-${payslipId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading payslip:', error);
    throw error;
  }
};

export const getEmployeePayslips = async (employeeId) => {
  try {
    const response = await api.get('/payslips/my', {
      params: { employeeId }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching employee payslips:', error);
    return [];
  }
};

export const getBankHistory = async (employeeId) => {
  try {
    const response = await api.get(`/payslips/${employeeId}/bank-history`);
    return response.data;
  } catch (error) {
    console.error('Error fetching bank history:', error);
    return [];
  }
};

export const updateBankDetails = async (employeeId, bankData) => {
  try {
    const response = await api.put(`/payslips/${employeeId}/bank`, bankData);
    return response.data;
  } catch (error) {
    console.error('Error updating bank details:', error);
    throw error;
  }
};

export const sendPayslipEmail = async (payslipId, emailData) => {
  try {
    const response = await api.post(`/payslips/${payslipId}/send-email`, emailData);
    return response.data;
  } catch (error) {
    console.error('Error sending payslip email:', error);
    throw error;
  }
};

export default api;