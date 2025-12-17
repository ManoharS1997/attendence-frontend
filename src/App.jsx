// attendance-frontend/src/App.jsx
import React from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import "./styles.css";

export default function App() {
  const { user } = useAuth();

  if (!user) return <LoginPage />;

  if (user.role === "employee") return <EmployeeDashboard />;
  if (user.role === "manager") return <ManagerDashboard />;
  if (user.role === "admin") return <AdminDashboard />;

  return <LoginPage />;
}
