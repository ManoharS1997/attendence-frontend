import React from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles.css";

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {/* Toast mounted ONCE for entire app */}
      <ToastContainer position="top-right" autoClose={3000} />

      {!user && <LoginPage />}
      {user?.role === "employee" && <EmployeeDashboard />}
      {user?.role === "manager" && <ManagerDashboard />}
      {user?.role === "admin" && <AdminDashboard />}
    </>
  );
}
