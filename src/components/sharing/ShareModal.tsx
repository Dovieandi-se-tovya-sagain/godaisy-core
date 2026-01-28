"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityName: string;
  activityDescription?: string;
}

export const ShareModal = ({
  isOpen,
  onClose,
  activityName,
  activityDescription = ""
}: ShareModalProps) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("");

  const handleShare = () => {
    const message = `Let's ${activityName.toLowerCase()} at ${selectedPlace} on ${selectedDate} at ${selectedTime}!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="relative w-full max-w-md bg-base-100 rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 btn btn-sm btn-circle btn-ghost">
          <X size={18} />
        </button>
        
        <h3 className="text-lg font-bold mb-4">Let&apos;s {activityName.toLowerCase()}!</h3>
        
        {activityDescription && (
          <div className="chat chat-start mb-4">
            <div className="chat-bubble bg-neutral text-neutral-content">
              {activityDescription}
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <p className="font-semibold mb-2">When?</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {['Today', 'Tonight', 'Tomorrow'].map((time) => (
                <button
                  key={time}
                  type="button"
                  className={`btn btn-sm ${
                    selectedDate === time ? 'btn-primary' : 'bg-base-200'
                  }`}
                  onClick={() => setSelectedDate(time)}
                >
                  {time}
                </button>
              ))}
            </div>
            <input
              type="date"
              className="input input-bordered w-full mt-2"
              value={selectedDate && !['Today', 'Tonight', 'Tomorrow'].includes(selectedDate) ? selectedDate : ''}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="font-semibold block mb-1">Time</label>
            <input
              type="time"
              className="input input-bordered w-full"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            />
          </div>
          
          <div>
            <p className="font-semibold mb-2">Where?</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {['My place', 'Your place', 'The usual place'].map((place) => (
                <button
                  key={place}
                  type="button"
                  className={`btn btn-sm ${
                    selectedPlace === place ? 'btn-primary' : 'bg-base-200'
                  }`}
                  onClick={() => setSelectedPlace(place)}
                >
                  {place}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search for the venue"
              className="input input-bordered w-full"
              value={selectedPlace}
              onChange={(e) => setSelectedPlace(e.target.value)}
              list="places"
            />
            <datalist id="places">
              <option value="Parks near me" />
              <option value={`${activityName} venues near me`} />
              <option value="Sports centres near me" />
            </datalist>
          </div>
          
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={handleShare}
              disabled={!selectedDate || !selectedTime || !selectedPlace}
            >
              Share on WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};