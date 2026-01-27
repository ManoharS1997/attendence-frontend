import React from 'react';

const BalanceDisplay = ({ 
  totalEstimatedHours = 0, 
  consumedHours = 0, 
  balanceHours = 0, 
  consumptionByRole = [] 
}) => {
  const isNegative = balanceHours < 0;
  const percentage = totalEstimatedHours > 0 ? (consumedHours / totalEstimatedHours) * 100 : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Project Balance</h3>
          <div className={`text-xl font-bold px-3 py-1 rounded ${
            isNegative 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {balanceHours.toFixed(1)} hours {isNegative ? '❌' : '✅'}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Consumed: <strong>{consumedHours.toFixed(1)}h</strong></span>
            <span>Total: <strong>{totalEstimatedHours.toFixed(1)}h</strong></span>
          </div>
        </div>
        
        {isNegative && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 font-medium">
            ⚠️ Project exceeded by <strong>{Math.abs(balanceHours).toFixed(1)} hours</strong>
          </div>
        )}
      </div>
      
      {consumptionByRole.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-700 mb-3">Hours by Role</h4>
          <div className="space-y-2">
            {consumptionByRole.map((role, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100">
                <div className="font-medium text-gray-800">{role.role}</div>
                <div className="font-bold text-blue-600">{role.consumedHours.toFixed(1)}h</div>
                <div className="text-sm text-gray-500">
                  {totalEstimatedHours > 0 
                    ? `${((role.consumedHours / totalEstimatedHours) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BalanceDisplay;