'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import { X, MapPin, Heart, ChevronRight, Check, Loader2 } from 'lucide-react';
import { useUserPreferences } from '../context/UserPreferencesContext';
import { activityTypes } from '../data/activityTypes';

/**
 * Popular activities to show in quick setup (curated selection)
 */
const POPULAR_ACTIVITIES = [
  { id: 'hiking', name: 'Hiking', emoji: '🥾' },
  { id: 'cycling', name: 'Cycling', emoji: '🚴' },
  { id: 'running', name: 'Running', emoji: '🏃' },
  { id: 'dog_walking', name: 'Dog Walking', emoji: '🐕' },
  { id: 'picnicking', name: 'Picnic', emoji: '🧺' },
  { id: 'stargazing', name: 'Stargazing', emoji: '🌟' },
  { id: 'photography', name: 'Photography', emoji: '📷' },
  { id: 'bbq', name: 'BBQ', emoji: '🍖' },
  { id: 'golf', name: 'Golf', emoji: '⛳' },
  { id: 'tennis', name: 'Tennis', emoji: '🎾' },
  { id: 'swimming', name: 'Swimming', emoji: '🏊' },
  { id: 'surfing', name: 'Surfing', emoji: '🏄' },
].filter(a => activityTypes.some(at => at.id === a.id));

const MAX_INTERESTS = 5;
const MIN_INTERESTS = 1;

type SetupStep = 'location' | 'interests' | 'done';

interface QuickSetupModalProps {
  /** Whether to show the modal */
  open: boolean;
  /** Called when modal is closed */
  onClose: () => void;
  /** App context for customization */
  app?: 'godaisy' | 'findr' | 'growdaisy';
  /** Initial step to show */
  initialStep?: SetupStep;
}

/**
 * Quick Setup Modal - Shows when essential preferences are missing
 *
 * Helps new users set up:
 * - Their location (for weather-based recommendations)
 * - Their interests (for personalized activity suggestions)
 */
export const QuickSetupModal: React.FC<QuickSetupModalProps> = ({
  open,
  onClose,
  app: _app = 'godaisy',
  initialStep = 'location',
}) => {
  const titleId = useId();
  const { preferences, setPreferences } = useUserPreferences();

  const [step, setStep] = useState<SetupStep>(initialStep);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationName, setLocationName] = useState<string>('');
  const [locationError, setLocationError] = useState<string>('');

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setSelectedInterests(preferences.interests?.slice(0, MAX_INTERESTS) || []);
      const homeLocation = preferences.locations?.find(l => l.type === 'home');
      setLocationName(homeLocation?.name || '');
      setLocationError('');
    }
  }, [open, initialStep, preferences.interests, preferences.locations]);

  // Handle location detection
  const handleDetectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsDetectingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Reverse geocode to get location name
          const response = await fetch(
            `/api/osm-orientation?lat=${position.coords.latitude}&lon=${position.coords.longitude}`
          );

          let name = 'Your location';
          if (response.ok) {
            const data = await response.json();
            name = data.display_name?.split(',').slice(0, 2).join(', ') || 'Your location';
          }

          setPreferences(prev => ({
            ...prev,
            locations: [
              ...prev.locations.filter(l => l.type !== 'home'),
              {
                name,
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                type: 'home' as const,
              },
            ],
          }));

          setLocationName(name);
          setIsDetectingLocation(false);

          // Move to next step after successful location detection
          setTimeout(() => setStep('interests'), 500);
        } catch {
          setLocationName('Your location');
          setIsDetectingLocation(false);
          setTimeout(() => setStep('interests'), 500);
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location access was denied. Please enable it in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out. Please try again.');
            break;
          default:
            setLocationError('An unknown error occurred.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [setPreferences]);

  // Handle interest toggle
  const toggleInterest = useCallback((activityId: string) => {
    setSelectedInterests(prev => {
      if (prev.includes(activityId)) {
        return prev.filter(id => id !== activityId);
      }
      if (prev.length >= MAX_INTERESTS) {
        return prev; // Don't add more than max
      }
      return [...prev, activityId];
    });
  }, []);

  // Handle save interests and complete
  const handleComplete = useCallback(() => {
    if (selectedInterests.length >= MIN_INTERESTS) {
      setPreferences(prev => ({
        ...prev,
        interests: selectedInterests,
      }));
      setStep('done');

      // Close after showing success
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  }, [selectedInterests, setPreferences, onClose]);

  // Skip location step
  const handleSkipLocation = useCallback(() => {
    setStep('interests');
  }, []);

  // Get step title
  const getStepTitle = () => {
    switch (step) {
      case 'location':
        return 'Where are you?';
      case 'interests':
        return 'What do you enjoy?';
      case 'done':
        return 'All set!';
      default:
        return 'Quick Setup';
    }
  };

  // Get step description
  const getStepDescription = () => {
    switch (step) {
      case 'location':
        return 'We\'ll use your location to show you personalized weather-based recommendations.';
      case 'interests':
        return `Pick ${MIN_INTERESTS}-${MAX_INTERESTS} activities you enjoy. We'll suggest the best times for them.`;
      case 'done':
        return 'Your preferences have been saved. Enjoy personalized recommendations!';
      default:
        return '';
    }
  };

  if (!open) return null;

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-box w-full max-w-md space-y-4 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="font-semibold text-lg">
            {getStepTitle()}
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

        {/* Description */}
        <p className="text-sm text-base-content/70">
          {getStepDescription()}
        </p>

        {/* Step Content */}
        {step === 'location' && (
          <div className="space-y-4">
            {/* Current location display */}
            {locationName && (
              <div className="bg-base-200 rounded-lg p-3 flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-base-content/70">Current location</p>
                  <p className="font-medium truncate">{locationName}</p>
                </div>
                <Check className="h-5 w-5 text-success shrink-0" />
              </div>
            )}

            {/* Error message */}
            {locationError && (
              <div className="alert alert-warning text-sm">
                {locationError}
              </div>
            )}

            {/* Detect location button */}
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              className="btn btn-primary w-full gap-2"
            >
              {isDetectingLocation ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <MapPin className="h-5 w-5" />
                  {locationName ? 'Update my location' : 'Detect my location'}
                </>
              )}
            </button>

            {/* Skip button */}
            <button
              type="button"
              onClick={handleSkipLocation}
              className="btn btn-ghost w-full"
            >
              Skip for now
            </button>

            {/* Already have location - continue */}
            {locationName && (
              <button
                type="button"
                onClick={() => setStep('interests')}
                className="btn btn-outline btn-primary w-full gap-2"
              >
                Continue with this location
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {step === 'interests' && (
          <div className="space-y-4">
            {/* Interest chips */}
            <div className="flex flex-wrap gap-2">
              {POPULAR_ACTIVITIES.map(activity => {
                const isSelected = selectedInterests.includes(activity.id);
                const isDisabled = !isSelected && selectedInterests.length >= MAX_INTERESTS;

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => toggleInterest(activity.id)}
                    disabled={isDisabled}
                    className={`btn btn-sm gap-1.5 ${
                      isSelected
                        ? 'btn-primary'
                        : isDisabled
                        ? 'btn-disabled opacity-50'
                        : 'btn-outline'
                    }`}
                  >
                    <span>{activity.emoji}</span>
                    <span>{activity.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>

            {/* Selection count */}
            <p className="text-xs text-base-content/50 text-center">
              {selectedInterests.length} of {MAX_INTERESTS} selected
              {selectedInterests.length < MIN_INTERESTS && (
                <span className="text-warning"> (select at least {MIN_INTERESTS})</span>
              )}
            </p>

            {/* Continue button */}
            <button
              type="button"
              onClick={handleComplete}
              disabled={selectedInterests.length < MIN_INTERESTS}
              className="btn btn-primary w-full gap-2"
            >
              <Heart className="h-5 w-5" />
              Save my interests
            </button>

            {/* Back button */}
            <button
              type="button"
              onClick={() => setStep('location')}
              className="btn btn-ghost w-full"
            >
              Back to location
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div className="bg-success/20 rounded-full p-4">
                <Check className="h-10 w-10 text-success" />
              </div>
            </div>
            <p className="text-lg font-medium">You&apos;re all set!</p>
            <p className="text-sm text-base-content/70 mt-2">
              Enjoy your personalized recommendations
            </p>
          </div>
        )}

        {/* Progress dots */}
        {step !== 'done' && (
          <div className="flex justify-center gap-2 pt-2">
            <div className={`w-2 h-2 rounded-full ${step === 'location' ? 'bg-primary' : 'bg-base-300'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'interests' ? 'bg-primary' : 'bg-base-300'}`} />
          </div>
        )}
      </div>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </div>
  );
};

/**
 * Hook to determine if Quick Setup should be shown
 */
export function useQuickSetupNeeded(): { needsSetup: boolean; reason: 'location' | 'interests' | null } {
  const { preferences } = useUserPreferences();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [reason, setReason] = useState<'location' | 'interests' | null>(null);

  useEffect(() => {
    // Check if location is set (not default London)
    const homeLocation = preferences.locations?.find(l => l.type === 'home');
    const isDefaultLocation = !homeLocation ||
      (homeLocation.name === 'London, UK' &&
       Math.abs(homeLocation.lat - 51.5074) < 0.01 &&
       Math.abs(homeLocation.lon - (-0.1278)) < 0.01);

    // Check if interests have been customized (not all defaults)
    const hasCustomInterests = preferences.interests?.length > 0 &&
      typeof window !== 'undefined' &&
      localStorage.getItem('preferences') !== null;

    // Check if user has explicitly dismissed setup before
    const setupDismissed = typeof window !== 'undefined' &&
      localStorage.getItem('quickSetupDismissed') === 'true';

    if (setupDismissed) {
      setNeedsSetup(false);
      setReason(null);
      return;
    }

    if (isDefaultLocation) {
      setNeedsSetup(true);
      setReason('location');
    } else if (!hasCustomInterests) {
      setNeedsSetup(true);
      setReason('interests');
    } else {
      setNeedsSetup(false);
      setReason(null);
    }
  }, [preferences.locations, preferences.interests]);

  return { needsSetup, reason };
}

/**
 * Dismiss Quick Setup permanently
 */
export function dismissQuickSetup() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('quickSetupDismissed', 'true');
  }
}

export default QuickSetupModal;
