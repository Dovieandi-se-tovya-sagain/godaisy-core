"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VenueSearch } from './VenueSearch';
import { FiX } from 'react-icons/fi';

interface ShareModalProps {
  activityId: string; // kept for API compatibility though unused
  activityName: string;
  onClose: () => void;
}

interface Venue {
  placeId: string;
  name: string;
  address: string;
  latLng: { lat: number; lng: number };
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
}

const spring = {
  type: 'spring' as const,
  damping: 25,
  stiffness: 300
};

export const ShareModal: React.FC<ShareModalProps> = ({
  activityName,
  onClose
}) => {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedDate, setSelectedDate] = useState<'today' | 'tomorrow' | 'pick'>('today');
  const [customDate, setCustomDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().split('T')[0];
  });
  const [showVenueSearch, setShowVenueSearch] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleShare = async (method: 'whatsapp' | 'copy') => {
    setIsSharing(true);
    
    try {
      const dateText = selectedDate === 'today' ? 'today' : 
                     selectedDate === 'tomorrow' ? 'tomorrow' : 
                     `on ${new Date(customDate).toLocaleDateString()}`;
      
      const venueText = selectedVenue?.name || 'a place';
      const message = `Do you fancy ${activityName.toLowerCase()} with me ${dateText} at ${venueText}?`;
      
      if (method === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      } else {
        await navigator.clipboard.writeText(message);
        setCopied(true);
      }
      
      onClose();
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const getDateDisplay = () => {
    if (selectedDate === 'today') return 'Today';
    if (selectedDate === 'tomorrow') return 'Tomorrow';
    return new Date(customDate).toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={spring}
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Plan {activityName}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 flex items-center text-sm text-gray-500">
              <span>{getDateDisplay()}</span>
              {selectedVenue && (
                <>
                  <span className="mx-2">•</span>
                  <span>{selectedVenue.name || 'Select location'}</span>
                </>
              )}
            </div>
          </div>
          
          {/* When? Section */}
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-medium text-gray-900 mb-3">When?</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedDate('today')}
                className={`py-3 px-2 rounded-lg text-sm font-medium ${
                  selectedDate === 'today'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' 
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setSelectedDate('tomorrow')}
                className={`py-3 px-2 rounded-lg text-sm font-medium ${
                  selectedDate === 'tomorrow'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' 
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                Tomorrow
              </button>
              <div className="relative">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setSelectedDate('pick');
                    setCustomDate(e.target.value);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-full absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className={`py-3 px-2 rounded-lg text-sm font-medium text-center ${
                  selectedDate === 'pick'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' 
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}>
                  {selectedDate === 'pick' ? getDateDisplay() : 'Pick date'}
                </div>
              </div>
            </div>
          </div>

          {/* Where? Section */}
          <div className="p-5">
            <h3 className="font-medium text-gray-900 mb-3">Where?</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setSelectedVenue({
                    placeId: 'my-place',
                    name: 'My place',
                    address: 'At my location',
                    latLng: { lat: 0, lng: 0 }
                  });
                }}
                className={`w-full p-4 text-left rounded-lg flex items-center ${
                  selectedVenue?.placeId === 'my-place'
                    ? 'bg-blue-50 border-2 border-blue-300'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div>
                  <div className="font-medium text-gray-900">My place</div>
                  <div className="text-xs text-gray-500">At my location</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedVenue({
                    placeId: 'your-place',
                    name: 'Your place',
                    address: 'At your location',
                    latLng: { lat: 0, lng: 0 }
                  });
                }}
                className={`w-full p-4 text-left rounded-lg flex items-center ${
                  selectedVenue?.placeId === 'your-place'
                    ? 'bg-blue-50 border-2 border-blue-300'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div>
                    <div className="font-medium text-gray-900">Your place</div>
                    <div className="text-xs text-gray-500">At your location</div>
                </div>
              </button>

              <button
                onClick={() => setShowVenueSearch(true)}
                className="w-full p-4 text-left rounded-lg flex items-center bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300"
              >
                <div className="text-gray-700">Find a venue</div>
              </button>

              {selectedVenue?.placeId && selectedVenue.placeId !== 'my-place' && selectedVenue.placeId !== 'your-place' && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{selectedVenue.name}</div>
                    <div className="text-xs text-gray-500">{selectedVenue.address}</div>
                  </div>
                  <button 
                    onClick={() => setSelectedVenue(null)}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Bottom action buttons */}
        <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleShare('whatsapp')}
              disabled={isSharing}
              className="flex items-center justify-center bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
            >
              WhatsApp
            </button>
            <button
              onClick={() => handleShare('copy')}
              disabled={isSharing}
              className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Message'}
            </button>
          </div>
        </div>

        {/* Venue Search Modal */}
        <AnimatePresence>
          {showVenueSearch && (
            <motion.div 
              className="absolute inset-0 bg-white z-20 p-4 overflow-y-auto"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween' }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Find a venue</h3>
                <button 
                  onClick={() => setShowVenueSearch(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  ×
                </button>
              </div>
              <VenueSearch
                activityName={activityName}
                onVenuesSelected={(venues) => {
                  if (venues.length > 0) {
                    setSelectedVenue(venues[0]);
                  }
                  setShowVenueSearch(false);
                }}
                maxSelections={1}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
