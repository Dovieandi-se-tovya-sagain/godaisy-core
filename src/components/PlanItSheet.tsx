'use client';

import React, { useEffect, useId, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { X, Calendar, Clock, Bell, BellOff, Check, Cloud, Smartphone, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Plan data structure stored in localStorage
 */
export interface PlannedActivity {
  id: string;
  app: 'godaisy' | 'findr' | 'growdaisy';
  activityType: string;
  activityName: string;
  activityData: Record<string, unknown>;
  plannedFor: string; // ISO date string
  plannedTime?: string; // HH:MM format
  reminderEnabled: boolean;
  completed?: boolean;
  completedAt?: string;
  createdAt: string;
}

/**
 * When options for the plan
 */
type WhenOption = 'today' | 'tomorrow' | 'weekend' | 'afterwork' | 'custom';

interface WhenChip {
  id: WhenOption;
  label: string;
  getDate: () => Date;
}

const getNextWeekend = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  return saturday;
};

const getAfterWork = (): Date => {
  const today = new Date();
  today.setHours(17, 0, 0, 0); // 5 PM today
  return today;
};

const WHEN_OPTIONS: WhenChip[] = [
  { id: 'today', label: 'Today', getDate: () => new Date() },
  { id: 'tomorrow', label: 'Tomorrow', getDate: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }},
  { id: 'weekend', label: 'This weekend', getDate: getNextWeekend },
  { id: 'afterwork', label: 'After work', getDate: getAfterWork },
];

export interface PlanItSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (plan: PlannedActivity) => void;
  app: 'godaisy' | 'findr' | 'growdaisy';
  activityType: string;
  activityName: string;
  activityData?: Record<string, unknown>;
  /** Custom content to show in the sheet (e.g., safety checklist for Findr) */
  children?: React.ReactNode;
}

/**
 * PlanItSheet - A shared bottom sheet component for planning activities
 *
 * Features:
 * - Bottom sheet on mobile, centered modal on desktop
 * - When? chips (Today, Tomorrow, This weekend, After work)
 * - Optional time picker
 * - Reminder toggle
 * - Saves to localStorage (anonymous-first)
 */
export const PlanItSheet: React.FC<PlanItSheetProps> = ({
  open,
  onClose,
  onSave,
  app,
  activityType,
  activityName,
  activityData = {},
  children,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const [selectedWhen, setSelectedWhen] = useState<WhenOption>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [reminderScheduled, setReminderScheduled] = useState<boolean | null>(null);
  const [isNative, setIsNative] = useState(false);

  // Detect native platform on mount (avoid SSR issues)
  useEffect(() => {
    const checkNative = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        setIsNative(Capacitor.isNativePlatform());
      } catch {
        setIsNative(false);
      }
    };
    checkNative();
  }, []);

  // Get auth link based on app
  const getAuthLink = () => {
    switch (app) {
      case 'findr':
        return '/findr/auth';
      case 'growdaisy':
        return '/login?redirect=/grow';
      default:
        return '/login';
    }
  };

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSelectedWhen('today');
      setCustomDate('');
      setSelectedTime('');
      setReminderEnabled(true);
      setShowTimePicker(false);
      setSaved(false);
      setShowAuthPrompt(false);
      setReminderScheduled(null);
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  const getPlannedDate = useCallback((): string => {
    if (selectedWhen === 'custom' && customDate) {
      return customDate;
    }
    const option = WHEN_OPTIONS.find(o => o.id === selectedWhen);
    if (option) {
      return option.getDate().toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  }, [selectedWhen, customDate]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    const plan: PlannedActivity = {
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      app,
      activityType,
      activityName,
      activityData,
      plannedFor: getPlannedDate(),
      plannedTime: selectedTime || undefined,
      reminderEnabled,
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage first (works for all users)
    try {
      const existing = localStorage.getItem('planned_activities');
      const plans: PlannedActivity[] = existing ? JSON.parse(existing) : [];
      plans.push(plan);
      localStorage.setItem('planned_activities', JSON.stringify(plans));

      // Sync to database for authenticated users
      if (user) {
        try {
          const { supabase } = await import('../lib/supabase/client');
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.access_token) {
            const response = await fetch('/api/plans', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                app: plan.app,
                activityType: plan.activityType,
                activityName: plan.activityName,
                activityData: plan.activityData,
                plannedFor: plan.plannedFor,
                plannedTime: plan.plannedTime,
                reminderEnabled: plan.reminderEnabled,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              // Update local plan with server ID for consistency
              plan.id = data.plan.id;
              if (process.env.NODE_ENV === 'development') {
                console.log('[PlanItSheet] Plan synced to cloud:', data.plan.id);
              }
            } else if (process.env.NODE_ENV === 'development') {
              console.warn('[PlanItSheet] Failed to sync plan to cloud:', response.status);
            }
          }
        } catch (syncError) {
          // Cloud sync failure is non-blocking - plan is still saved locally
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PlanItSheet] Cloud sync failed (non-blocking):', syncError);
          }
        }
      }

      // Schedule reminder notification if enabled (native apps only)
      if (reminderEnabled && isNative) {
        try {
          const { scheduleReminder } = await import('../lib/capacitor/pushNotifications');
          const notificationId = await scheduleReminder(plan);
          setReminderScheduled(notificationId !== null);
          if (process.env.NODE_ENV === 'development') {
            console.log('[PlanItSheet] Reminder scheduled:', notificationId);
          }
        } catch (err) {
          setReminderScheduled(false);
          if (process.env.NODE_ENV === 'development') {
            console.log('[PlanItSheet] Could not schedule reminder:', err);
          }
        }
      } else if (reminderEnabled && !isNative) {
        // Web users - reminder not available
        setReminderScheduled(false);
      }

      onSave(plan);
      setSaved(true);

      // Check if we should show auth prompt (anonymous user with 2+ plans)
      const shouldShowAuthPrompt = !user && plans.length >= 2;

      if (shouldShowAuthPrompt) {
        // Show auth prompt instead of closing immediately
        setTimeout(() => {
          setSaved(false);
          setShowAuthPrompt(true);
        }, 800);
      } else {
        // Close after brief success feedback
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (error) {
      console.error('[PlanItSheet] Failed to save plan:', error);
    } finally {
      setIsSaving(false);
    }
  }, [app, activityType, activityName, activityData, getPlannedDate, selectedTime, reminderEnabled, isNative, onSave, onClose, user]);

  const formatDateDisplay = (option: WhenChip): string => {
    const date = option.getDate();
    if (option.id === 'afterwork') {
      return 'Today 5pm';
    }
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className={`modal modal-bottom sm:modal-middle ${open ? 'modal-open' : ''}`} style={{ overscrollBehavior: 'contain' }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal-box w-full max-w-lg space-y-4 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="font-semibold text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
            Plan it
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {showAuthPrompt ? (
          /* Auth prompt view */
          <>
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center gap-3">
                <Cloud className="h-8 w-8 text-primary" aria-hidden="true" />
                <Smartphone className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h4 className="font-semibold text-lg">Save across devices</h4>
                <p className="text-sm text-base-content/70 mt-2">
                  Create a free account to keep your plans synced across all your devices and never lose them.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href={getAuthLink()}
                className="btn btn-primary w-full"
              >
                Sign up free
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost w-full"
              >
                Maybe later
              </button>
            </div>
          </>
        ) : (
          /* Planning form view */
          <>
            {/* Activity being planned */}
            <div className="bg-base-200 rounded-lg p-3">
              <p className="text-sm text-base-content/70">Planning:</p>
              <p className="font-medium">{activityName}</p>
            </div>

            {/* When? chips */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-base-content/70">When?</label>
              <div className="flex flex-wrap gap-2">
                {WHEN_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedWhen(option.id)}
                    className={`btn btn-sm ${
                      selectedWhen === option.id
                        ? 'btn-primary'
                        : 'btn-outline'
                    }`}
                  >
                    {option.label}
                    {selectedWhen === option.id && (
                      <span className="text-xs opacity-70 ml-1">
                        ({formatDateDisplay(option)})
                      </span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedWhen('custom')}
                  className={`btn btn-sm ${
                    selectedWhen === 'custom'
                      ? 'btn-primary'
                      : 'btn-outline'
                  }`}
                >
                  Pick date
                </button>
              </div>

              {/* Custom date picker */}
              {selectedWhen === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="input input-bordered w-full mt-2"
                />
              )}
            </div>

            {/* Time picker toggle */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowTimePicker(!showTimePicker)}
                className="btn btn-ghost btn-sm gap-2"
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                {showTimePicker ? 'Hide time' : 'Add specific time'}
              </button>

              {showTimePicker && (
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="input input-bordered w-full"
                />
              )}
            </div>

            {/* Reminder toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  {reminderEnabled ? (
                    <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
                  ) : (
                    <BellOff className="h-5 w-5 text-base-content/50" aria-hidden="true" />
                  )}
                  <span className="text-sm">Remind me</span>
                </label>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                />
              </div>
              {/* Web user notice */}
              {reminderEnabled && !isNative && (
                <div className="flex items-start gap-2 p-2 bg-info/10 rounded-lg text-xs text-info">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Reminders work best in the mobile app. Download the app from the App Store for push notifications.
                  </span>
                </div>
              )}
            </div>

            {/* Custom children (e.g., safety checklist for Findr) */}
            {children}

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || saved || (selectedWhen === 'custom' && !customDate)}
              className={`btn btn-primary w-full ${saved ? 'btn-success' : ''}`}
            >
              {saved ? (
                <>
                  <Check className="h-5 w-5" aria-hidden="true" />
                  Planned!
                </>
              ) : isSaving ? (
                <>
                  <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save plan'
              )}
            </button>

            {/* Reminder status feedback after save */}
            {saved && reminderEnabled && reminderScheduled === true && (
              <p className="text-xs text-success text-center flex items-center justify-center gap-1">
                <Bell className="h-3 w-3" aria-hidden="true" />
                Reminder set
              </p>
            )}
            {saved && reminderEnabled && reminderScheduled === false && !isNative && (
              <p className="text-xs text-base-content/60 text-center">
                Plan saved. Open the app for reminder notifications.
              </p>
            )}
          </>
        )}
      </div>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </div>
  );
};

/**
 * Hook to manage planned activities with localStorage + cloud sync
 *
 * For anonymous users: localStorage only
 * For authenticated users: fetches from API, merges with localStorage
 */
export function usePlannedActivities(app?: 'godaisy' | 'findr' | 'growdaisy') {
  const [plans, setPlans] = useState<PlannedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load plans from localStorage and optionally from API
  useEffect(() => {
    const loadPlans = async () => {
      setIsLoading(true);

      // Always load from localStorage first
      let localPlans: PlannedActivity[] = [];
      const stored = localStorage.getItem('planned_activities');
      if (stored) {
        try {
          localPlans = JSON.parse(stored);
          // Filter by app if specified
          if (app) {
            localPlans = localPlans.filter(p => p.app === app);
          }
        } catch {
          localPlans = [];
        }
      }

      // For authenticated users, also fetch from API
      if (user) {
        try {
          const { supabase } = await import('../lib/supabase/client');
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.access_token) {
            const url = app ? `/api/plans?app=${app}` : '/api/plans';
            const response = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            });

            if (response.ok) {
              const data = await response.json();
              const cloudPlans: PlannedActivity[] = data.plans || [];

              // Merge local and cloud plans, preferring cloud for duplicates
              const cloudIds = new Set(cloudPlans.map(p => p.id));
              const uniqueLocalPlans = localPlans.filter(p => !cloudIds.has(p.id));
              const mergedPlans = [...cloudPlans, ...uniqueLocalPlans];

              setPlans(mergedPlans);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[usePlannedActivities] Failed to fetch from API:', err);
          }
        }
      }

      // Fallback to local plans only
      setPlans(localPlans);
      setIsLoading(false);
    };

    loadPlans();
  }, [user, app]);

  const addPlan = useCallback((plan: PlannedActivity) => {
    setPlans(prev => {
      const updated = [...prev, plan];
      // Also update localStorage
      const allStored = localStorage.getItem('planned_activities');
      const allPlans: PlannedActivity[] = allStored ? JSON.parse(allStored) : [];
      allPlans.push(plan);
      localStorage.setItem('planned_activities', JSON.stringify(allPlans));
      return updated;
    });
  }, []);

  const removePlan = useCallback(async (planId: string) => {
    setPlans(prev => {
      const updated = prev.filter(p => p.id !== planId);
      // Also update localStorage
      const allStored = localStorage.getItem('planned_activities');
      const allPlans: PlannedActivity[] = allStored ? JSON.parse(allStored) : [];
      const updatedAll = allPlans.filter(p => p.id !== planId);
      localStorage.setItem('planned_activities', JSON.stringify(updatedAll));
      return updated;
    });

    // Also delete from cloud for authenticated users
    if (user) {
      try {
        const { supabase } = await import('../lib/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch('/api/plans', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ id: planId }),
          });
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[usePlannedActivities] Failed to delete from cloud:', err);
        }
      }
    }
  }, [user]);

  const markCompleted = useCallback(async (planId: string, completed: boolean = true) => {
    setPlans(prev => {
      const updated = prev.map(p =>
        p.id === planId ? { ...p, completed, completedAt: completed ? new Date().toISOString() : undefined } : p
      );
      // Also update localStorage
      const allStored = localStorage.getItem('planned_activities');
      const allPlans: PlannedActivity[] = allStored ? JSON.parse(allStored) : [];
      const updatedAll = allPlans.map(p =>
        p.id === planId ? { ...p, completed, completedAt: completed ? new Date().toISOString() : undefined } : p
      );
      localStorage.setItem('planned_activities', JSON.stringify(updatedAll));
      return updated;
    });

    // Update in cloud for authenticated users
    if (user) {
      try {
        const { supabase } = await import('../lib/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch('/api/plans', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ id: planId, completed }),
          });
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[usePlannedActivities] Failed to update in cloud:', err);
        }
      }
    }
  }, [user]);

  const getUpcoming = useCallback(() => {
    const now = new Date();
    return plans
      .filter(p => new Date(p.plannedFor) >= now && !('completed' in p && p.completed))
      .sort((a, b) => new Date(a.plannedFor).getTime() - new Date(b.plannedFor).getTime());
  }, [plans]);

  return { plans, isLoading, addPlan, removePlan, markCompleted, getUpcoming };
}

export default PlanItSheet;
