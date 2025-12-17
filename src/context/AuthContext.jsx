/* eslint-disable react-refresh/only-export-components */
// attendance-frontend/src/context/AuthContext.jsx

import React, {
  createContext,
  useContext,
  useState
} from "react";
import api from "../api";

// Create the auth context
const AuthContext = createContext(null);

// Provider component wrapping the whole app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  // Login function used by all three logins
  const login = async ({ email, password, role, auto = false }) => {
    try {
      setLoading(true);

      const res = await api.post("/auth/login", {
        email,
        password,
        role
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);

      return { ok: true };
    } catch (err) {
      console.error("LOGIN ERROR:", err?.response?.data || err.message);
      if (!auto) {
        alert(err?.response?.data?.message || "Login failed");
      }
      return { ok: false };
    } finally {
      setLoading(false);
    }
  };

  // Logout clears storage + state
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to consume the auth context
export const useAuth = () => useContext(AuthContext);
