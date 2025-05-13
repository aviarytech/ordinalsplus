import React from 'react';
import { CheckCircle, Circle, ArrowRight } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

export type StepStatus = 'completed' | 'current' | 'upcoming';

export interface StepIndicatorProps {
  steps: Step[];
  currentStepIndex: number;
  className?: string;
  onStepClick?: (index: number) => void;
  allowNavigation?: boolean;
}

/**
 * A horizontal step indicator component that visualizes progress through a multi-step workflow.
 * Shows completed steps, current step, and upcoming steps with appropriate styling.
 */
const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStepIndex,
  className = '',
  onStepClick,
  allowNavigation = false,
}) => {
  // Determine the status of a step based on the current index
  const getStepStatus = (index: number): StepStatus => {
    if (index < currentStepIndex) return 'completed';
    if (index === currentStepIndex) return 'current';
    return 'upcoming';
  };

  // Handle click on a step
  const handleStepClick = (index: number) => {
    // Only allow navigation if explicitly enabled and a click handler is provided
    // Also, prevent navigating to future steps
    if (allowNavigation && onStepClick && index <= currentStepIndex) {
      onStepClick(index);
    }
  };

  // Get appropriate icon for a step based on its status
  const StepIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'current':
        return <Circle className="h-6 w-6 text-indigo-600 dark:text-indigo-400 fill-current" />;
      case 'upcoming':
        return <Circle className="h-6 w-6 text-gray-300 dark:text-gray-600" />;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step item with icon and label */}
            <div 
              className={`flex flex-col items-center ${
                allowNavigation && index <= currentStepIndex 
                  ? 'cursor-pointer' 
                  : 'cursor-default'
              }`}
              onClick={() => handleStepClick(index)}
              aria-current={getStepStatus(index) === 'current' ? 'step' : undefined}
            >
              <div className="flex items-center justify-center">
                <StepIcon status={getStepStatus(index)} />
              </div>
              <div className="mt-2 text-center">
                <span 
                  className={`text-xs font-medium ${
                    getStepStatus(index) === 'completed' 
                      ? 'text-green-500'
                      : getStepStatus(index) === 'current'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {step.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[120px]">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
            
            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2">
                <div className="relative flex items-center">
                  <div 
                    className={`h-0.5 flex-1 ${
                      index < currentStepIndex 
                        ? 'bg-green-500' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                  {index < currentStepIndex && (
                    <ArrowRight className="absolute inset-0 mx-auto h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StepIndicator; 