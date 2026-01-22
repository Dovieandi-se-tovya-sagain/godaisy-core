"use client";

import { useState, useEffect } from 'react';
import { X, Check, Calendar, MapPin, Share2 } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string; // kept for compatibility, not used
  activityName: string;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  activityName
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!selectedDate) {
        throw new Error('Please select a date and time');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Sharing:', { activityName, selectedDate, selectedVenue });
      setShareSuccess(true);
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 btn btn-sm btn-circle btn-ghost"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-bold mb-4">Share Activity</h2>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {shareSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-success" />
            </div>
            <h3 className="text-lg font-medium mb-2">Shared Successfully!</h3>
            <p className="text-gray-600">Your activity has been shared.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center gap-2">
                  <Calendar size={16} />
                  When
                </span>
              </label>
              <input
                type="datetime-local"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input input-bordered w-full"
                required
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center gap-2">
                  <MapPin size={16} />
                  Venue (optional)
                </span>
              </label>
              <input
                type="text"
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="input input-bordered w-full"
                placeholder="Where will you be?"
              />
            </div>
            
            <div className="form-control mt-6">
              <button
                onClick={handleShare}
                className="btn btn-primary gap-2"
                disabled={isLoading || !selectedDate}
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Share2 size={16} />
                )}
                {isLoading ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
