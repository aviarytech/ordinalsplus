/**
 * Verification Button Component
 * 
 * This component provides a button to initiate the verification process
 * for an inscription or credential.
 */
import React, { useState } from 'react';
import { VerificationStatus } from '../../types/verification';

interface VerifyButtonProps {
  /** The ID of the inscription to verify */
  inscriptionId: string;
  /** Callback function when verification is triggered */
  onVerify: (inscriptionId: string) => Promise<void>;
  /** Current verification status */
  status?: VerificationStatus;
  /** Custom class name */
  className?: string;
  /** Button size: 'sm', 'md', or 'lg' */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Button component for initiating verification
 */
export const VerifyButton: React.FC<VerifyButtonProps> = ({
  inscriptionId,
  onVerify,
  status,
  className = '',
  size = 'md',
  disabled = false
}) => {
  const [isVerifying, setIsVerifying] = useState(false);

  // Determine if the button should be in loading state
  const isLoading = isVerifying || status === VerificationStatus.LOADING;

  // Handle verification click
  const handleVerify = async () => {
    if (isLoading || disabled) return;
    
    setIsVerifying(true);
    try {
      await onVerify(inscriptionId);
    } catch (error) {
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Determine button size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }[size];

  // Determine button state classes
  const stateClasses = disabled || isLoading
    ? 'opacity-70 cursor-not-allowed'
    : 'hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';

  return (
    <button
      type="button"
      onClick={handleVerify}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center
        font-medium rounded-md
        text-white bg-indigo-600
        transition-colors duration-200
        focus:outline-none
        ${sizeClasses}
        ${stateClasses}
        ${className}
      `}
      aria-label="Verify inscription"
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {isLoading ? 'Verifying...' : 'Verify'}
    </button>
  );
};

export default VerifyButton;
