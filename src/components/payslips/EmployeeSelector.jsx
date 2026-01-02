// src/components/payslips/EmployeeSelector.jsx
import { useState, useEffect, useRef } from 'react';
import { Search, User, Mail, Briefcase, Hash, Building, CreditCard, CheckCircle } from 'lucide-react';
import { getEmployeesWithBankDetails } from '../../utils/api';

const EmployeeSelector = ({ employees, selectedEmployee, onSelect, showBankInfo = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [employeesWithBankDetails, setEmployeesWithBankDetails] = useState([]);
  const hasFetchedRef = useRef(false);

  // Separate function to filter employees
  const filterEmployees = (employeesList, term) => {
    return employeesList.filter(emp =>
      emp.fullName?.toLowerCase().includes(term.toLowerCase()) ||
      emp.email?.toLowerCase().includes(term.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(term.toLowerCase()) ||
      emp.jobTitle?.toLowerCase().includes(term.toLowerCase())
    );
  };

  const getBankStatus = (employee) => {
    if (!employee.bankDetails) return 'no-bank';
    if (!employee.bankDetails.hasBankDetails) return 'no-bank';
    if (employee.bankDetails.verified) return 'verified';
    return 'unverified';
  };

  // Use a more efficient approach without cascading effects
  useEffect(() => {
    if (showBankInfo && !hasFetchedRef.current) {
      const fetchEmployeesWithBankDetails = async () => {
        try {
          const data = await getEmployeesWithBankDetails();
          setEmployeesWithBankDetails(data);
          hasFetchedRef.current = true;
        } catch (error) {
          console.error('Error loading employees with bank details:', error);
          // Fallback to basic employees list
          setEmployeesWithBankDetails(employees.map(emp => ({
            ...emp,
            bankDetails: { hasBankDetails: false }
          })));
        }
      };

      fetchEmployeesWithBankDetails();
    }
  }, [showBankInfo, employees]); // Add employees to dependencies

  // Get the appropriate employee list based on showBankInfo flag
  const getEmployeeList = () => {
    return showBankInfo ? employeesWithBankDetails : employees;
  };

  // Memoize filtered employees to prevent unnecessary recalculations
  const filteredEmployees = filterEmployees(getEmployeeList(), searchTerm);

  return (
    <div className="employee-selector">
      <div className="selector-input-container">
        <div className="selector-input">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search employee by name, email, ID, or job title..."
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
          {filteredEmployees.map(employee => {
            const bankStatus = getBankStatus(employee);
            
            return (
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
                    {employee.jobTitle && (
                      <span className="employee-jobtitle">
                        <Briefcase size={12} />
                        {employee.jobTitle}
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
                  
                  {/* Bank Details Status */}
                  {showBankInfo && (
                    <div className="bank-status">
                      {bankStatus === 'verified' && (
                        <span className="bank-status-verified">
                          <CheckCircle size={12} />
                          Bank Verified
                        </span>
                      )}
                      {bankStatus === 'unverified' && (
                        <span className="bank-status-unverified">
                          <Building size={12} />
                          Bank Details Added
                        </span>
                      )}
                      {bankStatus === 'no-bank' && (
                        <span className="bank-status-none">
                          <CreditCard size={12} />
                          No Bank Details
                        </span>
                      )}
                      
                      {employee.bankDetails?.hasBankDetails && employee.bankDetails.bankName && (
                        <span className="bank-name">
                          {employee.bankDetails.bankName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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

// Add these styles to your CSS
const styles = `
.employee-selector {
  position: relative;
  width: 100%;
}

.selector-input-container {
  margin-bottom: 10px;
}

.selector-input {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
}

.search-icon {
  color: #a0aec0;
  margin-right: 8px;
}

.employee-search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #2d3748;
  background: transparent;
}

.employee-search-input::placeholder {
  color: #a0aec0;
}

.selected-employee-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ebf4ff;
  color: #4c51bf;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.clear-selection {
  background: none;
  border: none;
  color: #718096;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.clear-selection:hover {
  color: #4a5568;
}

.employee-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 4px;
}

.employee-option {
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid #f7fafc;
  transition: background 0.2s;
}

.employee-option:hover {
  background: #f7fafc;
}

.employee-option:last-child {
  border-bottom: none;
}

.employee-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #ebf4ff;
  border-radius: 50%;
  color: #4c51bf;
  margin-right: 12px;
  flex-shrink: 0;
}

.employee-details {
  flex: 1;
  min-width: 0;
}

.employee-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-weight: 600;
  color: #2d3748;
  font-size: 14px;
}

.employee-jobtitle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f0fff4;
  color: #276749;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.employee-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 6px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #718096;
  font-size: 12px;
}

.bank-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.bank-status-verified {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #d1fae5;
  color: #065f46;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.bank-status-unverified {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fef3c7;
  color: #92400e;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.bank-status-none {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f3f4f6;
  color: #6b7280;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.bank-name {
  color: #4b5563;
  font-size: 11px;
  font-style: italic;
}

.no-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #718096;
  margin-top: 4px;
}

.no-results p {
  margin: 0;
  font-size: 14px;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default EmployeeSelector;