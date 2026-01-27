import React, { useState } from 'react';
import api from '../../utils/api';

const ProjectActions = ({ projectId, currentStatus, onStatusChange, balanceHours }) => {
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const handleAction = async (action) => {
    setLoading(action);
    setError('');
    
    try {
      let endpoint = '';
      
      switch(action) {
        case 'approve':
          endpoint = `/projects/${projectId}/approve`;
          break;
        case 'reject':
          endpoint = `/projects/${projectId}/reject`;
          break;
        case 'complete':
          endpoint = `/projects/${projectId}/complete`;
          break;
        default:
          return;
      }

      const response = await api.patch(endpoint);
      
      if (response.data) {
        onStatusChange(response.data.project?.status || response.data.status);
      }
      
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} project`);
    } finally {
      setLoading('');
    }
  };

  const canApprove = currentStatus === 'DRAFT';
  const canReject = currentStatus === 'DRAFT';
  const canComplete = currentStatus === 'APPROVED';
  
  const showNegativeBalanceWarning = canComplete && balanceHours < 0;

  if (!canApprove && !canReject && !canComplete) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex flex-wrap gap-3 items-center">
        {canApprove && (
          <button
            onClick={() => handleAction('approve')}
            disabled={loading === 'approve'}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading === 'approve' ? 'Approving...' : 'Approve Project'}
          </button>
        )}
        
        {canReject && (
          <button
            onClick={() => handleAction('reject')}
            disabled={loading === 'reject'}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading === 'reject' ? 'Rejecting...' : 'Reject Project'}
          </button>
        )}
        
        {canComplete && (
          <div className="flex flex-col gap-2">
            {showNegativeBalanceWarning && (
              <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                ⚠️ Negative balance: {balanceHours} hours - Cannot complete
              </div>
            )}
            
            <button
              onClick={() => handleAction('complete')}
              disabled={loading === 'complete' || showNegativeBalanceWarning}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                showNegativeBalanceWarning 
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } ${loading === 'complete' ? 'opacity-60 cursor-not-allowed' : ''}`}
              title={showNegativeBalanceWarning ? "Fix negative balance first" : ""}
            >
              {loading === 'complete' ? 'Completing...' : 'Complete Project'}
            </button>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default ProjectActions;