/**
 * LoadingSpinner Component
 * 
 * Simple loading indicator for async operations
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  message,
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg'
  };
  
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <span className={`loading loading-spinner text-primary ${sizeClasses[size]}`}></span>
      {message && (
        <p className="text-sm text-base-content/70">{message}</p>
      )}
    </div>
  );
}

export default LoadingSpinner;
