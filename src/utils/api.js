// src/utils/api.js
import axios from "axios";

/* =========================
   BASE URL
========================= */
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://44.217.109.241:5000/api";

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
export const generatePayslip = async (data) => {
  const res = await api.post("/payslips", data);
  return res.data;
};

export const getEmployeePayslips = async (employeeId) => {
  const res = await api.get("/payslips/my", {
    params: { employeeId },
  });
  return res.data;
};

export const downloadPayslipPDF = async (payslipId) => {
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
};

export default api;
