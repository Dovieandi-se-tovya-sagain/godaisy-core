"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Calendar, Clock, Share2, Check } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/googleMaps';
import { useUserPreferences } from '../../context/UserPreferencesContext';

interface Venue {
  placeId: string;
  name: string;
  address: string;
  latLng: { lat: number; lng: number };
  rating?: number;
  photoUrl?: string;
}

interface EnhancedShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
  activityName: string;
  activityDescription?: string;
  activityMessage?: string;
}

export default function EnhancedShareModal({
  isOpen,
  onClose,
  activityId: _activityId,
  activityName,
  activityDescription = "",
  activityMessage = ""
}: EnhancedShareModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Venue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const { preferences } = useUserPreferences();
  const [sharedStatus, setSharedStatus] = useState<string | null>(null);
  
  // Quick date options
  const dateOptions = [
    { label: 'Today', value: new Date().toISOString().split('T')[0] },
    { label: 'Tomorrow', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
    { label: 'This weekend', value: 'This weekend' }
  ];
  
  // Quick time options
  const timeOptions = [
    { label: 'Morning', value: '09:00' },
    { label: 'Afternoon', value: '14:00' },
    { label: 'Evening', value: '19:00' }
  ];

  // Handle modal open/close
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      modalRef.current?.close();
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Initialize Google Maps Places service
  useEffect(() => {
    if (isOpen) {
      loadGoogleMaps().then((google) => {
        const map = new google.maps.Map(document.createElement('div'));
        const service = new google.maps.places.PlacesService(map);
        setPlacesService(service);
      }).catch(console.error);
    }
  }, [isOpen]);

  // Reset form and search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate("");
      setSelectedTime("");
      setSelectedPlace("");
      setSearchQuery("");
      setSearchResults([]);
      setSharedStatus(null);
    }
  }, [isOpen]);

  // Handle place search
  const searchPlaces = useCallback((query: string) => {
    if (!placesService || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    // Get user's home location or fallback to London
    const homeLocation = preferences.locations.find(l => l.type === 'home') || preferences.locations[0];
    const searchLocation = homeLocation 
      ? new google.maps.LatLng(homeLocation.lat, homeLocation.lon)
      : new google.maps.LatLng(51.5074, -0.1278); // London fallback

    const request: google.maps.places.TextSearchRequest = {
      query: `${query} ${activityName} near me`,
      location: searchLocation,
      radius: 50000, // 50km radius
    };

    placesService.textSearch(request, (results, status) => {
      setIsSearching(false);
      
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const venues: Venue[] = results.slice(0, 5).map(place => ({
          placeId: place.place_id || '',
          name: place.name || '',
          address: place.formatted_address || '',
          latLng: {
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0
          },
          rating: place.rating,
          photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 200 })
        }));
        setSearchResults(venues);
      } else {
        setSearchResults([]);
      }
    });
  }, [placesService, preferences.locations, activityName]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length > 2) {
      const timer = setTimeout(() => {
        searchPlaces(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchPlaces]);

  // Share the invitation
  const shareInvite = () => {
    const activityNameLower = activityName.toLowerCase();
    let message = `Let's ${activityNameLower} at ${selectedPlace}`;
    
    if (selectedDate) {
      if (selectedDate === dateOptions[0].value) message += ' today';
      else if (selectedDate === dateOptions[1].value) message += ' tomorrow';
      else if (selectedDate === 'This weekend') message += ' this weekend';
      else message += ` on ${new Date(selectedDate).toLocaleDateString()}`;
    }
    
    if (selectedTime) {
      const timeFormatted = new Date(`2000-01-01T${selectedTime}`).toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      message += ` at ${timeFormatted}`;
    }
    
    message += '!';
    
    // Add the activity message if available
    if (activityMessage) {
      message += `\n\n${activityMessage}`;
    }
    
    // Add weather snippet if applicable
    if (activityDescription) {
      message += `\n\nToday's conditions: ${activityDescription}`;
    }
    
    const shareData = {
      title: `${activityName} Invitation`,
      text: message,
    };
    
    // Try to use Web Share API first
    if (navigator.share) {
      navigator.share(shareData)
        .then(() => setSharedStatus("shared"))
        .catch((error) => {
          console.error('Error sharing:', error);
          // Fallback to WhatsApp
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, "_blank");
          setSharedStatus("shared-whatsapp");
        });
    } else {
      // Fallback to WhatsApp
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank");
      setSharedStatus("shared-whatsapp");
    }
  };

  return (
    <dialog
      ref={modalRef}
      className="modal modal-bottom sm:modal-middle"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      data-theme="light"
    >
      <div className="modal-box bg-base-200 text-base-content max-w-md mx-auto">
        <button 
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3" 
          onClick={onClose}
        >
          <X size={18} />
        </button>
        
        <h3 className="font-bold text-lg mb-4 text-primary-content">
          Let&#39;s {activityName.toLowerCase()}!
        </h3>

        {/* Activity description displayed as a chat bubble */}
        {activityDescription && (
          <div className="chat chat-start mb-4">
            <div className="chat-bubble bg-neutral text-neutral-content">
              {activityDescription}
            </div>
          </div>
        )}
        
        {/* Activity message as a response */}
        {activityMessage && (
          <div className="chat chat-end mb-6">
            <div className="chat-bubble bg-primary text-primary-content">
              {activityMessage}
            </div>
          </div>
        )}

        {sharedStatus ? (
          <div className="text-center py-8">
            <div className="bg-success text-success-content rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Check size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Invitation Shared!</h3>
            <p className="mb-6">Your friends will be excited to join you.</p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Date selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={18} />
                <p className="font-semibold text-primary-content">When?</p>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {dateOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`btn btn-sm ${
                      selectedDate === option.value 
                        ? option.label === 'Today' 
                          ? 'btn-active bg-secondary text-secondary-content' 
                          : option.label === 'Tomorrow'
                            ? 'btn-active btn-primary text-primary-content'
                            : 'btn-active btn-secondary text-secondary-content'
                        : 'bg-base-300'
                    }`}
                    onClick={() => setSelectedDate(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              <div className="divider text-xs opacity-70">or choose specific date</div>
              
              <input
                type="date"
                className="input input-bordered w-full bg-base-300 text-base-content"
                value={selectedDate && !dateOptions.map(o => o.value).includes(selectedDate) ? selectedDate : ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            {/* Time selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={18} />
                <p className="font-semibold text-primary-content">What time?</p>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {timeOptions.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`btn btn-sm ${
                      selectedTime === option.value 
                        ? index === 0 
                          ? 'btn-active bg-secondary text-secondary-content' 
                          : index === 1
                            ? 'btn-active btn-primary text-primary-content'
                            : 'btn-active btn-secondary text-secondary-content'
                        : 'bg-base-300'
                    }`}
                    onClick={() => setSelectedTime(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              <div className="divider text-xs opacity-70">or choose specific time</div>
              
              <input
                type="time"
                className="input input-bordered w-full bg-base-300 text-base-content"
                value={selectedTime && !timeOptions.map(o => o.value).includes(selectedTime) ? selectedTime : ''}
                onChange={(e) => setSelectedTime(e.target.value)}
              />
            </div>
            
            {/* Place selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} />
                <p className="font-semibold text-primary-content">Where?</p>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {['My place', 'Your place', 'The usual spot'].map((place, index) => (
                  <button
                    key={place}
                    type="button"
                    className={`btn btn-sm ${
                      selectedPlace === place 
                        ? index === 0 
                          ? 'btn-active bg-secondary text-secondary-content' 
                          : index === 1
                            ? 'btn-active btn-primary text-primary-content'
                            : 'btn-active btn-secondary text-secondary-content'
                        : 'bg-base-300'
                    }`}
                    onClick={() => {
                      setSelectedPlace(place);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    {place}
                  </button>
                ))}
              </div>
              
              <div className="divider text-xs opacity-70">or search for a venue</div>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder={`Search for ${activityName.toLowerCase()} venues`}
                  className="input input-bordered w-full bg-base-300 text-base-content"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value) {
                      setSelectedPlace('');
                    }
                  }}
                />
                
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <span className="loading loading-spinner loading-xs"></span>
                  </div>
                )}
                
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-base-100 rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((venue) => (
                      <div 
                        key={venue.placeId}
                        className="p-2 hover:bg-base-300 cursor-pointer"
                        onClick={() => {
                          setSelectedPlace(venue.name);
                          setSearchQuery(venue.name);
                          setSearchResults([]);
                        }}
                      >
                        <div className="font-semibold">{venue.name}</div>
                        <div className="text-xs opacity-70">{venue.address}</div>
                        {venue.rating && (
                          <div className="text-xs mt-1">
                            {"★".repeat(Math.round(venue.rating))}
                            {"☆".repeat(5 - Math.round(venue.rating))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Share button */}
            <div className="pt-4 flex justify-between">
              <button
                type="button"
                className="btn btn-success"
                disabled={!selectedPlace || (!selectedDate && !selectedTime)}
                onClick={shareInvite}
              >
                <Share2 size={18} className="mr-2" />
                Share Invitation
              </button>
              <button 
                type="button" 
                className="btn btn-error" 
                onClick={onClose}
              >
                Cancel
              </button>
              
              <p className="text-xs text-center mt-2 opacity-70">
                {!selectedPlace ? "Please select a place" : 
                 (!selectedDate && !selectedTime) ? "Please select at least a date or time" : 
                 "Ready to share!"}
              </p>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
