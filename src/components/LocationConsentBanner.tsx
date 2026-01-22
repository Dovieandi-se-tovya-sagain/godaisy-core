import React from 'react';

interface LocationConsentBannerProps {
  onAccept: () => void;
  onDecline: () => void;
  show: boolean;
}

const LocationConsentBanner: React.FC<LocationConsentBannerProps> = ({ onAccept, onDecline, show }) => {
  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-base-200 border border-base-300 rounded-lg shadow-lg p-4 z-50 max-w-md mx-auto">
      <h3 className="text-lg font-semibold mb-2 text-base-content">Location Permission</h3>
      <p className="text-sm text-base-content mb-3">
        To provide precise weather recommendations for your exact location, we need access to your device&apos;s GPS location.
      </p>
      <p className="text-xs text-base-content/70 mb-3">
        This requires permission from your browser. Your location is only used to get weather data and is not stored or shared.
      </p>
      <div className="flex gap-2">
        <button 
          onClick={onAccept} 
          className="btn btn-primary btn-sm flex-1"
        >
          Allow GPS Location
        </button>
        <button 
          onClick={onDecline} 
          className="btn btn-outline btn-sm flex-1"
        >
          Search Manually
        </button>
      </div>
    </div>
  );
};

export default LocationConsentBanner;
