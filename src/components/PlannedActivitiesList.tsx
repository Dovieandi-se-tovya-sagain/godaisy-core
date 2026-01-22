'use client';

import React from 'react';
import { Calendar, Clock, Check, Trash2, ChevronRight } from 'lucide-react';
import { usePlannedActivities, type PlannedActivity } from './PlanItSheet';

interface PlannedActivitiesListProps {
  app?: 'godaisy' | 'findr' | 'growdaisy';
  /** Maximum number of items to show */
  limit?: number;
  /** Show completed items */
  showCompleted?: boolean;
  /** Compact mode for sidebar/widget use */
  compact?: boolean;
}

/**
 * Format a date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Get app-specific accent color class
 */
function getAppAccentClass(app: PlannedActivity['app']): string {
  switch (app) {
    case 'godaisy':
      return 'border-l-sky-500';
    case 'findr':
      return 'border-l-cyan-500';
    case 'growdaisy':
      return 'border-l-green-500';
    default:
      return 'border-l-primary';
  }
}

/**
 * Get app name for display
 */
function getAppName(app: PlannedActivity['app']): string {
  switch (app) {
    case 'godaisy':
      return 'Go Daisy';
    case 'findr':
      return 'Fish Findr';
    case 'growdaisy':
      return 'Grow Daisy';
    default:
      return 'Plan';
  }
}

/**
 * Single plan item component
 */
const PlanItem: React.FC<{
  plan: PlannedActivity;
  onComplete: (id: string, completed: boolean) => void;
  onRemove: (id: string) => void;
  compact?: boolean;
  showAppBadge?: boolean;
}> = ({ plan, onComplete, onRemove, compact, showAppBadge }) => {
  const isOverdue = !plan.completed && new Date(plan.plannedFor) < new Date();

  return (
    <div
      className={`
        flex items-center gap-3 p-3 bg-base-100 rounded-lg border-l-4
        ${getAppAccentClass(plan.app)}
        ${plan.completed ? 'opacity-60' : ''}
        ${isOverdue ? 'bg-warning/5' : ''}
        transition-all hover:shadow-sm
      `}
    >
      {/* Completion checkbox */}
      <button
        type="button"
        onClick={() => onComplete(plan.id, !plan.completed)}
        className={`
          shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
          transition-colors
          ${plan.completed
            ? 'bg-success border-success text-success-content'
            : 'border-base-300 hover:border-primary'
          }
        `}
        aria-label={plan.completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {plan.completed && <Check className="h-4 w-4" />}
      </button>

      {/* Plan details */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${plan.completed ? 'line-through' : ''}`}>
          {plan.activityName}
        </p>
        <div className="flex items-center gap-2 text-xs text-base-content/60 mt-0.5">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(plan.plannedFor)}
          </span>
          {plan.plannedTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {plan.plannedTime}
            </span>
          )}
          {showAppBadge && (
            <span className="badge badge-xs badge-ghost">{getAppName(plan.app)}</span>
          )}
          {isOverdue && !plan.completed && (
            <span className="badge badge-xs badge-warning">Overdue</span>
          )}
        </div>
      </div>

      {/* Remove button */}
      {!compact && (
        <button
          type="button"
          onClick={() => onRemove(plan.id)}
          className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-error"
          aria-label="Remove plan"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

/**
 * PlannedActivitiesList - Shows upcoming and completed plans
 *
 * Features:
 * - Shows plans for specific app or all apps
 * - Mark as complete/incomplete
 * - Remove plans
 * - Compact mode for widgets
 */
export const PlannedActivitiesList: React.FC<PlannedActivitiesListProps> = ({
  app,
  limit = 5,
  showCompleted = false,
  compact = false,
}) => {
  const { plans, isLoading, markCompleted, removePlan } = usePlannedActivities(app);

  // Filter and sort plans
  const filteredPlans = React.useMemo(() => {
    let filtered = plans;

    // Filter out completed if not showing them
    if (!showCompleted) {
      filtered = filtered.filter(p => !p.completed);
    }

    // Sort: incomplete first (by date), then completed (by completion date)
    filtered.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.completed && b.completed) {
        return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
      }
      return new Date(a.plannedFor).getTime() - new Date(b.plannedFor).getTime();
    });

    // Apply limit
    if (limit > 0) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }, [plans, showCompleted, limit]);

  const upcomingCount = plans.filter(p => !p.completed).length;
  const completedCount = plans.filter(p => p.completed).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-base-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (filteredPlans.length === 0) {
    return (
      <div className="text-center py-6 text-base-content/50">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No planned activities yet</p>
        <p className="text-xs mt-1">Use &quot;Plan it&quot; to schedule activities</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with counts */}
      {!compact && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-base-content/70">
            {upcomingCount} upcoming{completedCount > 0 && `, ${completedCount} completed`}
          </span>
          {plans.length > limit && (
            <button
              type="button"
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => {/* Could expand or navigate to full list */}}
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Plan items */}
      <div className="space-y-2">
        {filteredPlans.map(plan => (
          <PlanItem
            key={plan.id}
            plan={plan}
            onComplete={markCompleted}
            onRemove={removePlan}
            compact={compact}
            showAppBadge={!app} // Show app badge when viewing all apps
          />
        ))}
      </div>

      {/* Show completed toggle */}
      {!showCompleted && completedCount > 0 && !compact && (
        <p className="text-xs text-center text-base-content/50">
          {completedCount} completed {completedCount === 1 ? 'activity' : 'activities'} hidden
        </p>
      )}
    </div>
  );
};

export default PlannedActivitiesList;
