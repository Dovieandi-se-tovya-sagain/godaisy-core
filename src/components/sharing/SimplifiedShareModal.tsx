"use client";

import { useState, useEffect } from 'react';
import { X, Share2, Check } from 'lucide-react';
import { shareToWhatsApp } from '../../utils/share';

interface SimplifiedShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityName: string;
  activityMessage?: string;     // AI-generated message about conditions
  activityDescription?: string; // Weather summary
  activityEmoji?: string;       // Activity emoji
  activityId?: string;          // For smart defaults (night activities)
  assessmentStatus?: 'perfect' | 'good' | 'fair' | 'poor' | 'offseason'; // For smart defaults
}

export default function SimplifiedShareModal({
  isOpen,
  onClose,
  activityName,
  activityMessage = "",
  activityDescription = "",
  activityEmoji = "🎉",
  activityId,
  assessmentStatus
}: SimplifiedShareModalProps) {
  const [when, setWhen] = useState<string>("today");
  const [time, setTime] = useState<string>("afternoon");
  const [where, setWhere] = useState<string>("");
  const [customWhere, setCustomWhere] = useState<string>("");
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Quick options
  const whenOptions = [
    { label: "Today", value: "today" },
    { label: "Tomorrow", value: "tomorrow" },
    { label: "This weekend", value: "this weekend" }
  ];

  const timeOptions = [
    { label: "Morning", value: "morning" },
    { label: "Afternoon", value: "afternoon" },
    { label: "Evening", value: "evening" }
  ];

  const whereOptions = [
    { label: "My place", value: "my place" },
    { label: "Your place", value: "your place" },
    { label: "The usual spot", value: "the usual spot" }
  ];

  // Reset form when modal opens with smart defaults
  useEffect(() => {
    if (isOpen) {
      // Smart default for "when": If conditions are perfect, suggest today
      const defaultWhen = assessmentStatus === 'perfect' ? 'today' : 'today';
      setWhen(defaultWhen);

      // Smart default for "time": Evening for night activities, afternoon otherwise
      const nightActivities = [
        'cinema', 'theatre', 'concert', 'nightclub', 'bar_hopping',
        'restaurant', 'dinner', 'stargazing', 'astronomy', 'night_photography'
      ];
      const isNightActivity = activityId && nightActivities.includes(activityId);
      const defaultTime = isNightActivity ? 'evening' : 'afternoon';
      setTime(defaultTime);

      setWhere("");
      setCustomWhere("");
      setShareSuccess(null);
      setIsSharing(false);
    }
  }, [isOpen, assessmentStatus, activityId]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleShare = async () => {
    setIsSharing(true);

    try {
      // Build the share message
      const venue = customWhere || where || "TBD";

      let message = `Let's ${activityName.toLowerCase()}! ${activityEmoji}\n\n`;
      message += `📅 ${when.charAt(0).toUpperCase() + when.slice(1)} ${time}\n`;
      message += `📍 ${venue}\n`;

      if (activityMessage) {
        message += `\n${activityMessage}\n`;
      }

      if (activityDescription) {
        message += `\n☀️ ${activityDescription}\n`;
      }

      message += `\nSee full conditions: ${window.location.origin}`;

      // Use the sophisticated share utility
      const result = await shareToWhatsApp({
        title: `${activityName} Invitation`,
        text: message,
        url: window.location.href
      });

      setShareSuccess(result);

      // Auto-close after success (but give user time to see the message)
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Share failed:', error);
      setShareSuccess('Unable to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-base-100 rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 btn btn-sm btn-circle btn-ghost"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <h3 className="text-xl font-bold mb-4 pr-8">
          Let&apos;s {activityName.toLowerCase()}! {activityEmoji}
        </h3>

        {/* Activity description as chat bubble */}
        {activityDescription && (
          <div className="chat chat-start mb-4">
            <div className="chat-bubble bg-neutral text-neutral-content">
              {activityDescription}
            </div>
          </div>
        )}

        {/* Activity message as response */}
        {activityMessage && (
          <div className="chat chat-end mb-6">
            <div className="chat-bubble bg-primary text-primary-content">
              {activityMessage}
            </div>
          </div>
        )}

        {/* Success state */}
        {shareSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-success" />
            </div>
            <h3 className="text-lg font-medium mb-2">Shared!</h3>
            <p className="text-base-content/70">{shareSuccess}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* When? */}
            <div>
              <p className="font-semibold mb-2">When?</p>
              <div className="flex flex-wrap gap-2">
                {whenOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`btn btn-sm ${
                      when === option.value ? 'btn-primary' : 'btn-outline'
                    }`}
                    onClick={() => setWhen(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* What time? */}
            <div>
              <p className="font-semibold mb-2">What time?</p>
              <div className="flex flex-wrap gap-2">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`btn btn-sm ${
                      time === option.value ? 'btn-primary' : 'btn-outline'
                    }`}
                    onClick={() => setTime(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Where? */}
            <div>
              <p className="font-semibold mb-2">Where?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {whereOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`btn btn-sm ${
                      where === option.value ? 'btn-primary' : 'btn-outline'
                    }`}
                    onClick={() => {
                      setWhere(option.value);
                      setCustomWhere("");
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="divider text-xs opacity-70">or enter a venue</div>

              <input
                type="text"
                placeholder="Type venue name (optional)"
                className="input input-bordered w-full"
                value={customWhere}
                onChange={(e) => {
                  setCustomWhere(e.target.value);
                  if (e.target.value) setWhere("");
                }}
              />
            </div>

            {/* Share button */}
            <div className="pt-4">
              <button
                type="button"
                className="btn btn-primary w-full gap-2"
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share2 size={18} />
                    Share Invitation
                  </>
                )}
              </button>

              <p className="text-xs text-center mt-2 opacity-70">
                Friends without Go Daisy will see conditions in the message
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
