import React, { useState } from 'react';
import { Building, CreditCard, Lock, MapPin, Edit2, Save, X, History } from 'lucide-react';

const BankDetailsForm = ({ bankDetails, onUpdate }) => {

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...bankDetails });
  const [showHistory, setShowHistory] = useState(false);

  const bankOptions = [
   'State Bank of India',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'Punjab National Bank',
    'Bank of Baroda',
    'Canara Bank',
    'Union Bank of India',
    'Indian Bank',
    'Bank of India',
    'Central Bank of India',
    'Indian Overseas Bank',
    'UCO Bank',
    'Punjab & Sind Bank',
    'Bank of Maharashtra',
    'Andhra Pradesh Grameena Vikas Bank',
    'Andhra Pragathi Grameena Bank',
    'Saptagiri Grameena Bank',
    'Chaitanya Godavari Grameena Bank',
    'Andhra Pradesh Grameena Bank',
    'Telangana Grameena Bank',
    'Karnataka Gramin Bank',
    'Kerala Gramin Bank',
    'Tamil Nadu Grama Bank',
    'Madhya Pradesh Gramin Bank',
    'Rajasthan Marudhara Gramin Bank',
    'Uttar Pradesh Gramin Bank',
    'Bihar Gramin Bank',
    'West Bengal Gramin Bank',
    'Yes Bank',
    'IndusInd Bank',
    'IDBI Bank',
    'IDFC First Bank',
    'Bandhan Bank',
    'Federal Bank',
    'South Indian Bank',
    'Karnataka Bank',
    'Karur Vysya Bank',
    'City Union Bank',
    'DCB Bank',
    'RBL Bank',
    'Other Bank'
  ];

  const handleSave = () => {
    // Add to history before updating
    const updatedHistory = [
      {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        ifsc: bankDetails.ifsc,
        branch: bankDetails.branch,
        changedBy: 'Manager'
      },
      ...bankDetails.history.slice(0, 4) // Keep only last 5 entries
    ];

    onUpdate({
      ...editData,
      history: updatedHistory
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({ ...bankDetails });
    setIsEditing(false);
  };

  const handleInputChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatAccountNumber = (number) => {
    if (!number) return '';
    const last4 = number.slice(-4);
    return `****${last4}`;
  };

  return (
    <div className="bank-details-form">
      <div className="bank-details-header">
        {!isEditing ? (
          <>
            <button
              className="edit-btn"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 size={16} />
              Edit Bank Details
            </button>
            <button
              className="history-btn"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History size={16} />
              Bank History
            </button>
          </>
        ) : (
          <div className="edit-actions">
            <button className="save-btn" onClick={handleSave}>
              <Save size={16} />
              Save Changes
            </button>
            <button className="cancel-btn" onClick={handleCancel}>
              <X size={16} />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="bank-fields-grid">
        {/* Bank Name */}
        <div className="bank-field">
          <div className="field-label">
            <Building size={16} />
            <span>Bank Name</span>
          </div>
          {isEditing ? (
            <select
              className="bank-select"
              value={editData.bankName}
              onChange={(e) => handleInputChange('bankName', e.target.value)}
            >
              <option value="">Select Bank</option>
              {bankOptions.map(bank => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          ) : (
            <div className="field-value bank-name-value">
              {bankDetails.bankName || 'Not specified'}
            </div>
          )}
        </div>

        {/* Account Number */}
        <div className="bank-field">
          <div className="field-label">
            <CreditCard size={16} />
            <span>Account Number</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              className="bank-input"
              value={editData.accountNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 18) {
                  handleInputChange('accountNumber', value);
                }
              }}
              placeholder="Enter 9-18 digit account number"
              maxLength={18}
            />
          ) : (
            <div className="field-value account-number-value">
              {formatAccountNumber(bankDetails.accountNumber) || '****'}
            </div>
          )}
        </div>

        {/* IFSC Code */}
        <div className="bank-field">
          <div className="field-label">
            <Lock size={16} />
            <span>IFSC Code</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              className="bank-input"
              value={editData.ifsc}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                handleInputChange('ifsc', value);
              }}
              placeholder="e.g., SBIN0005943"
              maxLength={11}
              style={{ textTransform: 'uppercase' }}
            />
          ) : (
            <div className="field-value ifsc-value">
              {bankDetails.ifsc || 'Not specified'}
            </div>
          )}
        </div>

        {/* Branch Address */}
        <div className="bank-field full-width">
          <div className="field-label">
            <MapPin size={16} />
            <span>Branch Address</span>
          </div>
          {isEditing ? (
            <textarea
              className="branch-textarea"
              value={editData.branch}
              onChange={(e) => handleInputChange('branch', e.target.value)}
              placeholder="Enter complete branch address"
              rows={3}
            />
          ) : (
            <div className="field-value branch-value">
              {bankDetails.branch || 'Not specified'}
            </div>
          )}
        </div>
      </div>

      {/* Example Note */}
      <div className="example-note">
        <div className="example-title">Example Format:</div>
        <div className="example-content">
          <div>Bank: State Bank of India</div>
          <div>Account: 123456789012</div>
          <div>IFSC: SBIN0005943</div>
          <div>Branch: SBI Main Branch, 123 MG Road, Bengaluru - 560001</div>
        </div>
      </div>

      {/* Bank History */}
      {showHistory && bankDetails.history && bankDetails.history.length > 0 && (
        <div className="bank-history">
          <h5>Bank Details History</h5>
          <div className="history-list">
            {bankDetails.history.map((record, index) => (
              <div key={index} className="history-item">
                <div className="history-date">
                  {record.date} at {record.time}
                </div>
                <div className="history-details">
                  <div>Bank: {record.bankName}</div>
                  <div>Account: ****{record.accountNumber?.slice(-4)}</div>
                  <div>IFSC: {record.ifsc}</div>
                  <div>Branch: {record.branch}</div>
                </div>
                <div className="history-changed">
                  Changed by: {record.changedBy}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Add these styles to your CSS
const styles = `
.bank-details-form {
  background: white;
  border-radius: 12px;
  padding: 20px;
}

.bank-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f7fafc;
}

.edit-btn, .history-btn, .save-btn, .cancel-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
}

.edit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.edit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.history-btn {
  background: #edf2f7;
  color: #4a5568;
}

.history-btn:hover {
  background: #e2e8f0;
}

.edit-actions {
  display: flex;
  gap: 12px;
}

.save-btn {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
}

.save-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
}

.cancel-btn {
  background: #fed7d7;
  color: #c53030;
}

.cancel-btn:hover {
  background: #feb2b2;
}

.bank-fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.bank-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bank-field.full-width {
  grid-column: 1 / -1;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4a5568;
  font-size: 14px;
  font-weight: 500;
}

.bank-select, .bank-input, .branch-textarea {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s;
  background: white;
}

.bank-select:focus, .bank-input:focus, .branch-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.branch-textarea {
  resize: vertical;
  min-height: 80px;
}

.field-value {
  padding: 12px 16px;
  background: #f7fafc;
  border-radius: 8px;
  font-size: 14px;
  color: #2d3748;
  border-left: 4px solid #48bb78;
}

.bank-name-value {
  font-weight: 600;
  color: #2d3748;
}

.account-number-value {
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
  color: #4a5568;
}

.ifsc-value {
  font-weight: 600;
  color: #667eea;
}

.branch-value {
  line-height: 1.5;
}

.example-note {
  background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
  border-radius: 8px;
  padding: 16px;
  margin-top: 20px;
  border-left: 4px solid #f56565;
}

.example-title {
  color: #c53030;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}

.example-content {
  color: #718096;
  font-size: 13px;
  line-height: 1.6;
}

.example-content div {
  margin-bottom: 2px;
}

.bank-history {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid #f7fafc;
}

.bank-history h5 {
  color: #2d3748;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  background: #f7fafc;
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid #4299e1;
}

.history-date {
  color: #718096;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
}

.history-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 8px;
}

.history-changed {
  color: #667eea;
  font-size: 12px;
  font-weight: 500;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default BankDetailsForm;