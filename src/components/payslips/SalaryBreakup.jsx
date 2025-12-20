import React from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

const SalaryBreakup = ({ salary, onChange }) => {
  const handleChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    onChange(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const calculatePercentage = (amount) => {
    if (!salary.basic || salary.basic === 0) return '0%';
    const percentage = ((amount / salary.basic) * 100).toFixed(1);
    return `${percentage}%`;
  };

  const fields = [
    { 
      key: 'basic', 
      label: 'Basic Pay', 
      icon: DollarSign,
      description: '40-50% of CTC',
      color: '#667eea'
    },
    { 
      key: 'hra', 
      label: 'House Rent Allowance', 
      icon: TrendingUp,
      description: '40-50% of Basic',
      color: '#48bb78'
    },
    { 
      key: 'conveyance', 
      label: 'Conveyance Allowance', 
      icon: TrendingUp,
      description: 'Fixed monthly',
      color: '#ed8936'
    },
    { 
      key: 'travelAllowance', 
      label: 'Travel Allowance', 
      icon: TrendingUp,
      description: 'As per policy',
      color: '#9f7aea'
    },
    { 
      key: 'medicalAllowance', 
      label: 'Medical Allowance', 
      icon: TrendingUp,
      description: 'Fixed monthly',
      color: '#4299e1'
    },
    { 
      key: 'specialAllowance', 
      label: 'Special Allowance', 
      icon: TrendingUp,
      description: 'Balance of CTC',
      color: '#f56565'
    },
  ];

  const deductions = [
    { 
      key: 'pf', 
      label: 'Provident Fund (PF)', 
      icon: TrendingDown,
      description: '12% of Basic',
      color: '#e53e3e'
    },
    { 
      key: 'esi', 
      label: 'ESI Contribution', 
      icon: TrendingDown,
      description: '0.75% of Gross',
      color: '#dd6b20'
    },
    { 
      key: 'professionalTax', 
      label: 'Professional Tax', 
      icon: TrendingDown,
      description: 'State specific',
      color: '#d69e2e'
    },
    { 
      key: 'tds', 
      label: 'Income Tax (TDS)', 
      icon: TrendingDown,
      description: 'As per IT slab',
      color: '#805ad5'
    },
  ];

  return (
    <div className="salary-breakup">
      {/* Earnings Section */}
      <div className="salary-section">
        <h4 className="section-title earnings-title">
          <TrendingUp size={18} />
          Earnings
        </h4>
        <div className="salary-grid">
          {fields.map(field => (
            <div key={field.key} className="salary-field">
              <div className="field-header">
                <field.icon size={16} color={field.color} />
                <label>{field.label}</label>
                <span className="percentage">{calculatePercentage(salary[field.key])}</span>
              </div>
              <div className="field-input-group">
                <span className="currency">₹</span>
                <input
                  type="number"
                  className="salary-input"
                  value={salary[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
              <div className="field-description">
                {field.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deductions Section */}
      <div className="salary-section">
        <h4 className="section-title deductions-title">
          <TrendingDown size={18} />
          Deductions
        </h4>
        <div className="salary-grid">
          {deductions.map(field => (
            <div key={field.key} className="salary-field">
              <div className="field-header">
                <field.icon size={16} color={field.color} />
                <label>{field.label}</label>
                <span className="percentage">{calculatePercentage(salary[field.key])}</span>
              </div>
              <div className="field-input-group">
                <span className="currency">₹</span>
                <input
                  type="number"
                  className="salary-input"
                  value={salary[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
              <div className="field-description">
                {field.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Section */}
      <div className="salary-summary">
        <div className="summary-item gross">
          <span className="summary-label">Gross Earnings</span>
          <span className="summary-value">₹{salary.gross?.toLocaleString() || '0'}</span>
        </div>
        <div className="summary-item deductions">
          <span className="summary-label">Total Deductions</span>
          <span className="summary-value">₹{salary.deductions?.toLocaleString() || '0'}</span>
        </div>
        <div className="summary-item netpay">
          <span className="summary-label">Net Payable</span>
          <span className="summary-value">₹{salary.netPay?.toLocaleString() || '0'}</span>
        </div>
      </div>
    </div>
  );
};

// Add these styles to your CSS
const styles = `
.salary-breakup {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.salary-section {
  background: #f8fafc;
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px;
  font-size: 16px;
  font-weight: 600;
}

.earnings-title {
  color: #48bb78;
}

.deductions-title {
  color: #e53e3e;
}

.salary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.salary-field {
  background: white;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s;
}

.salary-field:hover {
  border-color: #cbd5e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.field-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.field-header label {
  flex: 1;
  color: #2d3748;
  font-size: 14px;
  font-weight: 500;
}

.percentage {
  color: #718096;
  font-size: 12px;
  font-weight: 500;
  background: #edf2f7;
  padding: 2px 8px;
  border-radius: 12px;
}

.field-input-group {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.currency {
  color: #4a5568;
  font-weight: 600;
  margin-right: 8px;
}

.salary-input {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  transition: all 0.3s;
}

.salary-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.field-description {
  color: #718096;
  font-size: 12px;
  margin-top: 4px;
}

.salary-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  justify-content: space-between;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: white;
}

.summary-label {
  font-size: 14px;
  opacity: 0.9;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
}

.gross .summary-value {
  color: #48bb78;
}

.deductions .summary-value {
  color: #fed7d7;
}

.netpay .summary-value {
  color: #fefcbf;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default SalaryBreakup;