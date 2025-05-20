import React from 'react';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

export type TransactionStatus = 
  | 'not_started'
  | 'preparing'
  | 'signing'
  | 'broadcasting'
  | 'confirming'
  | 'completed'
  | 'failed';

export interface TransactionStatusIndicatorProps {
  status: TransactionStatus;
  className?: string;
}

/**
 * A component for displaying transaction status in the inscription workflow
 */
const TransactionStatusIndicator: React.FC<TransactionStatusIndicatorProps> = ({
  status,
  className = '',
}) => {
  // Get status label based on current status
  const getStatusLabel = (): string => {
    switch (status) {
      case 'not_started':
        return 'Not Started';
      case 'preparing':
        return 'Preparing Transaction';
      case 'signing':
        return 'Ready for Signing';
      case 'broadcasting':
        return 'Broadcasting Transaction';
      case 'confirming':
        return 'Waiting for Confirmation';
      case 'completed':
        return 'Transaction Confirmed';
      case 'failed':
        return 'Transaction Failed';
      default:
        return 'Unknown Status';
    }
  };

  // Get status icon based on current status
  const StatusIcon = (): JSX.Element => {
    switch (status) {
      case 'not_started':
        return <Clock className="h-6 w-6 text-gray-400" />;
      case 'preparing':
      case 'signing':
      case 'broadcasting':
      case 'confirming':
        return <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Clock className="h-6 w-6 text-gray-400" />;
    }
  };

  // Get status color based on current status
  const getStatusColor = (): string => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 dark:bg-gray-800';
      case 'preparing':
      case 'signing':
      case 'broadcasting':
      case 'confirming':
        return 'bg-indigo-50 dark:bg-indigo-900/20';
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'failed':
        return 'bg-red-50 dark:bg-red-900/20';
      default:
        return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  // Get progress percentage based on current status
  const getProgressPercentage = (): number => {
    switch (status) {
      case 'not_started':
        return 0;
      case 'preparing':
        return 20;
      case 'signing':
        return 40;
      case 'broadcasting':
        return 60;
      case 'confirming':
        return 80;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  };

  return (
    <div className={`transaction-status-indicator ${className}`}>
      <div className={`p-4 rounded-md ${getStatusColor()}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            <StatusIcon />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              {getStatusLabel()}
            </h3>
            <div className="mt-2">
              <div className="relative h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="absolute h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-500 ease-in-out"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionStatusIndicator;
