// src/components/payslips/BankDetailsForm.jsx
import React, { useState, useEffect, useCallback  } from 'react';
import { Building, CreditCard, Lock, MapPin, Edit2, Save, X, History, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { updateBankDetails, getBankDetails, getBankHistory, verifyBankDetails } from '../../utils/api';

const BankDetailsForm = ({ employeeId, onUpdateSuccess }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [verifying, setVerifying] = useState(false);
  
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    accountType: 'Savings',
    verified: false,
    verifiedBy: null,
    verifiedAt: null,
    notes: ''
  });

  const [editData, setEditData] = useState({ ...bankDetails });

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

  const accountTypeOptions = ['Savings', 'Current', 'Salary'];




 const loadBankDetails = useCallback(async () => {
  if (!employeeId) return;

  try {
    setLoading(true);
    const data = await getBankDetails(employeeId);
    setBankDetails(data);
    setEditData(data);
  } catch (error) {
    console.error('Error loading bank details:', error);
  } finally {
    setLoading(false);
  }
}, [employeeId]);

useEffect(() => {
  loadBankDetails();
}, [loadBankDetails]);


  const loadBankHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await getBankHistory(employeeId);
      setHistoryData(data.history || []);
    } catch (error) {
      console.error('Error loading bank history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { bankName, accountNumber, ifsc, branch, accountType } = editData;
      
      const bankData = {
        bankName,
        accountNumber,
        ifsc,
        branch,
        accountType,
        reason: 'Bank details updated by manager'
      };

      await updateBankDetails(employeeId, bankData);
      
      // Reload bank details
      await loadBankDetails();
      
      setIsEditing(false);
      
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
      
      // Show success message
      alert('Bank details updated successfully!');
    } catch (error) {
      console.error('Error saving bank details:', error);
      alert('Failed to update bank details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      await verifyBankDetails(employeeId, 'Bank details verified');
      
      // Reload bank details
      await loadBankDetails();
      
      alert('Bank details verified successfully!');
    } catch (error) {
      console.error('Error verifying bank details:', error);
      alert('Failed to verify bank details.');
    } finally {
      setVerifying(false);
    }
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

  const handleHistoryClick = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      loadBankHistory();
    }
  };

  if (loading && !bankDetails.bankName) {
    return (
      <div className="bank-details-loading">
        <div className="spinner"></div>
        <span>Loading bank details...</span>
      </div>
    );
  }

  return (
    <div className="bank-details-form">
      <div className="bank-details-header">
        <div className="header-left">
          <h4>Bank Account Details</h4>
          {bankDetails.verified && (
            <div className="verified-badge">
              <CheckCircle size={14} />
              <span>Verified</span>
            </div>
          )}
        </div>
        
        <div className="header-right">
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
                onClick={handleHistoryClick}
              >
                <History size={16} />
                Bank History
              </button>
              {!bankDetails.verified && (
                <button
                  className="verify-btn"
                  onClick={handleVerify}
                  disabled={verifying}
                >
                  <Shield size={16} />
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              )}
            </>
          ) : (
            <div className="edit-actions">
              <button 
                className="save-btn" 
                onClick={handleSave}
                disabled={loading}
              >
                <Save size={16} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="cancel-btn" onClick={handleCancel}>
                <X size={16} />
                Cancel
              </button>
            </div>
          )}
        </div>
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
            />
          ) : (
            <div className="field-value ifsc-value">
              {bankDetails.ifsc || 'Not specified'}
            </div>
          )}
        </div>

        {/* Account Type */}
        <div className="bank-field">
          <div className="field-label">
            <Building size={16} />
            <span>Account Type</span>
          </div>
          {isEditing ? (
            <select
              className="bank-select"
              value={editData.accountType}
              onChange={(e) => handleInputChange('accountType', e.target.value)}
              disabled={loading}
            >
              {accountTypeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          ) : (
            <div className="field-value account-type-value">
              {bankDetails.accountType || 'Savings'}
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
              disabled={loading}
            />
          ) : (
            <div className="field-value branch-value">
              {bankDetails.branch || 'Not specified'}
            </div>
          )}
        </div>
      </div>

      {/* Verification Status */}
      {bankDetails.verified && (
        <div className="verification-info">
          <div className="verification-header">
            <CheckCircle size={18} color="#10b981" />
            <span>Verified Details</span>
          </div>
          <div className="verification-details">
            <div>Verified by: {bankDetails.verifiedBy?.fullName || 'Manager'}</div>
            <div>Verified on: {new Date(bankDetails.verifiedAt).toLocaleDateString()}</div>
            {bankDetails.notes && <div>Notes: {bankDetails.notes}</div>}
          </div>
        </div>
      )}

      {/* Example Note */}
      <div className="example-note">
        <div className="example-title">Example Format:</div>
        <div className="example-content">
          <div>Bank: State Bank of India</div>
          <div>Account: 123456789012</div>
          <div>IFSC: SBIN0005943</div>
          <div>Account Type: Savings</div>
          <div>Branch: SBI Main Branch, 123 MG Road, Bengaluru - 560001</div>
        </div>
      </div>

      {/* Bank History */}
      {showHistory && (
        <div className="bank-history">
          <div className="history-header">
            <h5>Bank Details History</h5>
            <button 
              className="close-history" 
              onClick={() => setShowHistory(false)}
            >
              <X size={16} />
            </button>
          </div>
          
          {historyLoading ? (
            <div className="history-loading">
              <div className="spinner small"></div>
              <span>Loading history...</span>
            </div>
          ) : historyData.length === 0 ? (
            <div className="no-history">
              <History size={24} />
              <p>No history found</p>
            </div>
          ) : (
            <div className="history-list">
              {historyData.map((record, index) => (
                <div key={index} className="history-item">
                  <div className="history-date">
                    {new Date(record.createdAt).toLocaleDateString()} at {new Date(record.createdAt).toLocaleTimeString()}
                  </div>
                  <div className="history-details">
                    <div className="change-type">
                      <strong>{record.changeType}</strong> by {record.changedByName} ({record.changedByRole})
                    </div>
                    {record.previousBankName && (
                      <div className="change-detail">
                        <span className="label">Previous Bank:</span>
                        <span className="value">{record.previousBankName}</span>
                      </div>
                    )}
                    {record.newBankName && (
                      <div className="change-detail">
                        <span className="label">New Bank:</span>
                        <span className="value">{record.newBankName}</span>
                      </div>
                    )}
                    {record.newAccountNumber && (
                      <div className="change-detail">
                        <span className="label">Account:</span>
                        <span className="value">****{record.newAccountNumber?.slice(-4)}</span>
                      </div>
                    )}
                    {record.reason && (
                      <div className="change-detail">
                        <span className="label">Reason:</span>
                        <span className="value">{record.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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

.bank-details-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: #4a5568;
}

.bank-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f7fafc;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h4 {
  margin: 0;
  color: #2d3748;
  font-size: 18px;
}

.verified-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #d1fae5;
  color: #065f46;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.header-right {
  display: flex;
  gap: 10px;
}

.edit-btn, .history-btn, .verify-btn, .save-btn, .cancel-btn {
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

.edit-btn:hover:not(:disabled) {
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

.verify-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.verify-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.verify-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-actions {
  display: flex;
  gap: 12px;
}

.save-btn {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.account-type-value {
  font-weight: 500;
  color: #5a67d8;
}

.branch-value {
  line-height: 1.5;
}

.verification-info {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border-radius: 8px;
  padding: 16px;
  margin: 20px 0;
  border-left: 4px solid #10b981;
}

.verification-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #065f46;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}

.verification-details {
  color: #047857;
  font-size: 13px;
  line-height: 1.6;
}

.verification-details div {
  margin-bottom: 4px;
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

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.history-header h5 {
  color: #2d3748;
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.close-history {
  background: none;
  border: none;
  color: #718096;
  cursor: pointer;
  padding: 4px;
}

.close-history:hover {
  color: #4a5568;
}

.history-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: #4a5568;
  justify-content: center;
}

.no-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 20px;
  color: #718096;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
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

.change-type {
  color: #2d3748;
  font-size: 13px;
  margin-bottom: 8px;
}

.change-detail {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}

.change-detail .label {
  color: #4a5568;
  font-weight: 500;
  min-width: 80px;
}

.change-detail .value {
  color: #2d3748;
  flex: 1;
}

.spinner {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

.spinner.small {
  width: 16px;
  height: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default BankDetailsForm;