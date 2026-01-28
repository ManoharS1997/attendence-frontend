import React, { useState } from 'react';
import api from '../../utils/api';

const TaskApproval = ({ taskId, isApproved, projectStatus, onApprovalChange }) => {
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

 const handleApproval = async (approve) => {
  setLoading(approve ? 'approve' : 'unapprove');
  setError('');
  
  try {
    const endpoint = `/tasks/${taskId}/${approve ? 'approve' : 'unapprove'}`;
    // Remove the variable assignment since we don't use the response
    await api.patch(endpoint);
    
    // ✅ FIX: Only pass the approval status, NOT the balance
    // Backend will handle balance calculation
    onApprovalChange(!isApproved);
    
  } catch (err) {
    setError(err.response?.data?.message || `Failed to ${approve ? 'approve' : 'unapprove'} task`);
  } finally {
    setLoading('');
  }
};

  // Don't show approval buttons if project is not approved
  if (projectStatus !== 'APPROVED') {
    return (
      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-gray-600 text-sm text-center">
        ⏳ Project must be approved before task approval
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-700">Status:</span>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          isApproved 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
        }`}>
          {isApproved ? '✓ Approved' : '⏳ Pending'}
        </span>
      </div>
      
      <div>
        {!isApproved ? (
          <button
            onClick={() => handleApproval(true)}
            disabled={loading === 'approve'}
            className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading === 'approve' ? 'Approving...' : '✓ Approve Task'}
          </button>
        ) : (
          <button
            onClick={() => handleApproval(false)}
            disabled={loading === 'unapprove'}
            className="w-full px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading === 'unapprove' ? 'Unapproving...' : '↺ Unapprove Task'}
          </button>
        )}
      </div>
      
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default TaskApproval;