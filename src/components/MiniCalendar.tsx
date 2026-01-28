/**
 * MiniCalendar Component
 * 
 * 7-day forecast showing confidence scores for a species
 * Horizontal layout with day labels and confidence rings
 */

import React from 'react';
import { ConfidenceRing } from './ConfidenceRing';

interface DayForecast {
  date: Date;
  confidenceScore: number;
  dayLabel: string;           // "Mon", "Tue", etc.
  dateLabel: string;          // "12", "13", etc.
}

interface MiniCalendarProps {
  forecasts: DayForecast[];   // Should be 7 items
  className?: string;
}

export function MiniCalendar({ forecasts, className = '' }: MiniCalendarProps) {
  // Ensure we have exactly 7 days
  const days = forecasts.slice(0, 7);
  
  if (days.length === 0) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-sm text-base-content/50">No forecast data available</p>
      </div>
    );
  }
  
  return (
    <div className={`w-full ${className}`}>
      {/* Title */}
      <h4 className="text-sm font-semibold text-base-content/80 mb-3">
        7-Day Outlook
      </h4>
      
      {/* Days grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const isToday = index === 0;
          
          return (
            <div 
              key={day.date.toISOString()}
              className="flex flex-col items-center gap-1"
            >
              {/* Day label */}
              <div className="text-center">
                <div className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-base-content/70'}`}>
                  {isToday ? 'Today' : day.dayLabel}
                </div>
                <div className="text-[10px] text-base-content/50">
                  {day.dateLabel}
                </div>
              </div>
              
              {/* Confidence ring */}
              <ConfidenceRing 
                score={day.confidenceScore}
                size="sm"
                showLabel={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Generate mock 7-day forecast for development
 * TODO: Replace with real forecast calculation from conditions API
 */
export function generateMockForecast(baseScore: number): DayForecast[] {
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    // Add some variation to scores (±15 points)
    const variation = Math.floor(Math.random() * 30) - 15;
    const score = Math.max(0, Math.min(100, baseScore + variation));
    
    return {
      date,
      confidenceScore: score,
      dayLabel: dayNames[date.getDay()],
      dateLabel: date.getDate().toString()
    };
  });
}

export default MiniCalendar;
