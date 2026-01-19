// src/components/layout/BaseLayout.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const BaseLayout = ({ children, userRole, navItems = [] }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { logout } = useAuth();
  const navigate = useNavigate();
  //const location = useLocation();

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isSidebarOpen && window.innerWidth < 1024) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !sidebar.contains(event.target)) {
          setIsSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarOpen]);

  // Get role-specific colors
  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'employee': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Default navigation items if none provided
  const defaultNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
    { id: 'attendance', label: 'Attendance', icon: '🕒', path: '/attendance' },
    { id: 'tasks', label: 'Tasks', icon: '✅', path: '/tasks' },
    { id: 'leaves', label: 'Leaves', icon: '🍃', path: '/leaves' },
    { id: 'payslip', label: 'Payslip', icon: '💰', path: '/payslip' },
    { id: 'reports', label: 'Reports', icon: '📈', path: '/reports' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
  ];

  const itemsToUse = navItems.length > 0 ? navItems : defaultNavItems;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? '✕' : '☰'}
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">
                {userRole} Dashboard
              </span>
              <span className="text-xs text-gray-500">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex pt-14 lg:pt-0">
        {/* Sidebar */}
        <aside className={`
          sidebar fixed lg:static top-0 left-0 h-full
          w-64 lg:w-56 xl:w-64 bg-gray-900 text-white z-40
          transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 transition-transform duration-300 ease-in-out
          flex flex-col shadow-xl
        `}>
          <div className="p-5 border-b border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="font-bold">NIT</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">NowIT Services</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(userRole)}`}>
                  {userRole}
                </span>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {itemsToUse.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                  if (item.path) navigate(item.path);
                }}
                className={`
                  w-full text-left px-4 py-3 rounded-lg transition-all
                  flex items-center space-x-3
                  ${activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <div className="bg-gray-800 rounded-lg p-3 mb-3">
              <div className="text-xs text-gray-400 mb-1">Quick Stats</div>
              <div className="text-sm">Active: 8h 30m</div>
            </div>
            <button
              onClick={logout}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <span>🚪</span>
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          {/* Desktop Header */}
          <header className="hidden lg:block bg-white border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h1 className="text-xl font-semibold text-gray-900">
                    {itemsToUse.find(item => item.id === activeTab)?.label || 'Dashboard'}
                  </h1>
                  <span className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <span className="text-xl">🔔</span>
                  </button>
                  <button
                    onClick={logout}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
            <div className="flex justify-around items-center h-16">
              {itemsToUse.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.path) navigate(item.path);
                  }}
                  className={`
                    flex flex-col items-center justify-center p-2 flex-1
                    ${activeTab === item.id 
                      ? 'text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs mt-1 truncate max-w-[60px]">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BaseLayout;