import React from 'react';
import { Button } from '../ui';

export interface NavigationControlsProps {
  onNext?: () => void;
  onBack?: () => void;
  disableNext?: boolean;
  disableBack?: boolean;
  showNext?: boolean;
  showBack?: boolean;
  nextLabel?: string;
  backLabel?: string;
  className?: string;
}

/**
 * A reusable component for navigation controls in multi-step flows
 */
const NavigationControls: React.FC<NavigationControlsProps> = ({
  onNext,
  onBack,
  disableNext = false,
  disableBack = false,
  showNext = true,
  showBack = true,
  nextLabel = 'Continue',
  backLabel = 'Back',
  className = '',
}) => {
  return (
    <div className={`flex justify-between mt-6 ${className}`}>
      {showBack && (
        <Button
          onClick={onBack}
          disabled={disableBack}
          variant="outline"
          className="px-4 py-2"
        >
          {backLabel}
        </Button>
      )}
      
      {/* Spacer when only showing next button */}
      {showNext && !showBack && <div />}
      
      {showNext && (
        <Button
          onClick={onNext}
          disabled={disableNext}
          className="px-4 py-2"
        >
          {nextLabel}
        </Button>
      )}
      
      {/* Spacer when only showing back button */}
      {!showNext && showBack && <div />}
    </div>
  );
};

export default NavigationControls;
