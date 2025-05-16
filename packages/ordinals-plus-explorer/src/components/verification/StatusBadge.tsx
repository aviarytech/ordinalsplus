/**
 * Verification Status Badge Component
 * 
 * This component displays the verification status with appropriate icons and colors.
 */
import React from 'react';
import { VerificationStatus } from '../../types/verification';

interface StatusBadgeProps {
  /** The verification status to display */
  status: VerificationStatus;
  /** Optional custom message to display */
  message?: string;
  /** Custom class name */
  className?: string;
  /** Whether to show the status text */
  showText?: boolean;
  /** Size of the badge: 'sm', 'md', or 'lg' */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Component for displaying verification status
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  message,
  className = '',
  showText = true,
  size = 'md'
}) => {
  // Define status configurations
  const statusConfig = {
    [VerificationStatus.VALID]: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      label: 'Verified',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-200'
    },
    [VerificationStatus.INVALID]: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      label: 'Invalid',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-200'
    },
    [VerificationStatus.NO_METADATA]: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'No Metadata',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      borderColor: 'border-gray-200'
    },
    [VerificationStatus.ERROR]: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      label: 'Error',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200'
    },
    [VerificationStatus.LOADING]: {
      icon: (
        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ),
      label: 'Verifying',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-200'
    }
  };

  const config = statusConfig[status];
  
  // Determine size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }[size];

  return (
    <div 
      className={`
        inline-flex items-center rounded-full
        border ${config.borderColor} ${config.bgColor} ${config.textColor}
        ${sizeClasses}
        ${className}
      `}
      role="status"
      aria-label={`Verification status: ${config.label}`}
    >
      <span className="flex-shrink-0">
        {config.icon}
      </span>
      
      {showText && (
        <span className="ml-1.5 font-medium">
          {message || config.label}
        </span>
      )}
    </div>
  );
};

export default StatusBadge;
