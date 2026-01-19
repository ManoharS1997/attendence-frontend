// src/components/layout/ResponsiveContainer.jsx
import React, { useState } from 'react';

const ResponsiveContainer = ({ children, title, user, logout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 px-4 py-3 flex items-center justify-between">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {isSidebarOpen ? '✕' : '☰'}
        </button>
        <div className="text-center">
          <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <button 
          onClick={logout}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Logout
        </button>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex pt-14 lg:pt-0">
        {/* Mobile Sidebar */}
        <div className={`
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:hidden fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-40
          transition-transform duration-300 ease-in-out
        `}>
          {/* Sidebar content here */}
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.fullName}</p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={logout}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Your existing dashboard content - UNTOUCHED */}
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveContainer;