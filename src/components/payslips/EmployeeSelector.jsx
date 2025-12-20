import { useState } from 'react';
import { Search, User, Mail, Briefcase, Hash } from 'lucide-react';

const EmployeeSelector = ({ employees, selectedEmployee, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="employee-selector">
      <div className="selector-input-container">
        <div className="selector-input">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search employee by name, email or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            className="employee-search-input"
          />
          {selectedEmployee && (
            <div className="selected-employee-tag">
              <User size={14} />
              <span>{selectedEmployee.fullName}</span>
              <button
                onClick={() => {
                  onSelect(null);
                  setSearchTerm('');
                }}
                className="clear-selection"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {isDropdownOpen && searchTerm && filteredEmployees.length > 0 && (
        <div className="employee-dropdown">
          {filteredEmployees.map(employee => (
            <div
              key={employee._id}
              className="employee-option"
              onClick={() => {
                onSelect(employee);
                setSearchTerm('');
                setIsDropdownOpen(false);
              }}
            >
              <div className="employee-avatar">
                <User size={20} />
              </div>
              <div className="employee-details">
                <div className="employee-name">
                  {employee.fullName}
                  {employee.designation && (
                    <span className="employee-designation">
                      <Briefcase size={12} />
                      {employee.designation}
                    </span>
                  )}
                </div>
                <div className="employee-info">
                  <span className="info-item">
                    <Mail size={12} />
                    {employee.email}
                  </span>
                  {employee.employeeId && (
                    <span className="info-item">
                      <Hash size={12} />
                      {employee.employeeId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isDropdownOpen && searchTerm && filteredEmployees.length === 0 && (
        <div className="no-results">
          <User size={24} />
          <p>No employees found</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeSelector;