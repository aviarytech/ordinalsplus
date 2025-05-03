import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  maxWidth?: string;
  showIcon?: boolean;
  delay?: number;
  /* If persistent, tooltip will stay open until manually closed */
  persistent?: boolean;
  /* If interactive, user can hover over the tooltip content without it closing */
  interactive?: boolean;
}

/**
 * A tooltip component that displays helpful information when hovering over an element.
 * Can be configured with different positions, behaviors, and appearances.
 */
const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
  maxWidth = '250px',
  showIcon = false,
  delay = 200,
  persistent = false,
  interactive = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Position calculation mapping
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  // Arrow position based on tooltip position
  const arrowClasses = {
    top: 'bottom-[-6px] left-1/2 transform -translate-x-1/2 rotate-45 border-r border-b',
    bottom: 'top-[-6px] left-1/2 transform -translate-x-1/2 rotate-45 border-l border-t',
    left: 'right-[-6px] top-1/2 transform -translate-y-1/2 rotate-45 border-r border-t',
    right: 'left-[-6px] top-1/2 transform -translate-y-1/2 rotate-45 border-l border-b',
  };

  // Handle mouse enter with delay
  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  // Handle mouse leave with delay for interactive tooltips
  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (persistent) return; // Don't hide if persistent
    
    if (interactive) {
      // For interactive tooltips, delay hiding to allow mouse to move to tooltip content
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    } else {
      setIsVisible(false);
    }
  };

  // Handle clicks outside to close persistent tooltips
  useEffect(() => {
    if (!persistent) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(event.target as Node) &&
        contentRef.current && 
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };
    
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, persistent]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Toggle tooltip for persistent tooltips
  const toggleTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (persistent) {
      setIsVisible(prev => !prev);
    }
  };

  return (
    <div 
      className={`inline-flex relative ${className}`}
      onMouseEnter={!persistent ? handleMouseEnter : undefined}
      onMouseLeave={!persistent ? handleMouseLeave : undefined}
      ref={tooltipRef}
    >
      {/* The trigger element */}
      <div 
        className={persistent ? 'cursor-pointer' : ''}
        onClick={persistent ? toggleTooltip : undefined}
      >
        {showIcon ? (
          <span className="inline-flex items-center">
            {children}
            <Info className="h-4 w-4 ml-1 text-gray-500 dark:text-gray-400" />
          </span>
        ) : (
          children
        )}
      </div>
      
      {/* The tooltip content */}
      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]}`}
          style={{ maxWidth }}
          onMouseEnter={interactive ? handleMouseEnter : undefined}
          onMouseLeave={interactive ? handleMouseLeave : undefined}
          ref={contentRef}
        >
          <div 
            className="relative bg-gray-900 dark:bg-gray-800 text-white text-sm px-3 py-2 rounded-md shadow-lg"
          >
            {/* Content */}
            <div className="relative z-10">
              {content}
            </div>
            
            {/* Arrow */}
            <div 
              className={`absolute w-3 h-3 bg-gray-900 dark:bg-gray-800 ${arrowClasses[position]}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Tooltip; 