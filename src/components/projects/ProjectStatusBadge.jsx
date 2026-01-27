import React from 'react';

const ProjectStatusBadge = ({ status }) => {
  const getStatusConfig = () => {
    switch(status?.toUpperCase()) {
      case 'DRAFT':
        return { 
          label: 'Draft', 
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800'
        };
      case 'APPROVED':
        return { 
          label: 'Approved', 
          bgColor: 'bg-green-100',
          textColor: 'text-green-800'
        };
      case 'REJECTED':
        return { 
          label: 'Rejected', 
          bgColor: 'bg-red-100',
          textColor: 'text-red-800'
        };
      case 'COMPLETED':
        return { 
          label: 'Completed', 
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800'
        };
      case 'ARCHIVED':
        return { 
          label: 'Archived', 
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800'
        };
      default:
        return { 
          label: 'Unknown', 
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor}`}>
      <span className={`w-2 h-2 rounded-full mr-2 ${config.bgColor.replace('100', '500')}`}></span>
      {config.label}
    </span>
  );
};

export default ProjectStatusBadge;