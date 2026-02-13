import React from 'react';
import Image from 'next/image.js';

interface FeelsLikeProps {
  tempC: number;
  humidityPct: number; // relative humidity in %
  wind: number; // wind speed in m/s
}

const kennethQuips = [
  { max: 0, text: "Brrr! It's colder than a witch's tit!" },
  { max: 5, text: "Ooooh, nippy! My knees are knocking like castanets!" },
  { max: 10, text: "Chilly enough to make you shiver, dear." },
  { max: 15, text: "Positively perky, duckie!" },
  { max: 20, text: "Quite pleasant, really. Nothing to fret about." },
  { max: 25, text: "Phwoar! Getting rather sultry, isn’t it?" },
  { max: 30, text: "I’m wilting like a daisy in a sauna!"},
  { max: 35, text: "Warm enough to make you want a lemonade." },
  { max: 37, text: "Stop the cab! I’m melting!" },
  { max: 40, text: "Blimey! It's like a sauna out here!" },
  { max: Infinity, text: "You're melting faster than a snowman in July!" }
];

const getApparentTemp = (tempC: number, humidityPct: number, wind: number): number => {
  // Simplified apparent temperature calculation (Steadman's apparent temperature)
  // This is a rough estimate combining heat index and wind chill.
  const e = humidityPct / 100 * 6.105 * Math.exp(17.27 * tempC / (237.7 + tempC));
  const apparentTemp = tempC + 0.33 * e - 0.7 * wind - 4.00;
  return apparentTemp;
};

const getKennethQuip = (appTemp: number): string => {
  for (const quip of kennethQuips) {
    if (appTemp <= quip.max) {
      return quip.text;
    }
  }
  return "";
};

const getPlainDescription = (appTemp: number): string => {
  if (appTemp <= 0) return "Feels very cold — wrap up warm.";
  if (appTemp <= 10) return "Feels cold";
  if (appTemp <= 15) return "Cool and fresh, good for walking or light activity.";
  if (appTemp <= 20) return "Comfortable for most outdoor activities.";
  if (appTemp <= 30) return "Warm — you’ll sweat during exercise; hydrate.";
  if (appTemp <= 40) return "Dangerously hot — avoid strenuous activity.";
  return "It feels very hot";
};

const FeelsLike: React.FC<FeelsLikeProps> = ({ tempC, humidityPct, wind }) => {
  const apparentTemp = getApparentTemp(tempC, humidityPct, wind);
  const kennethLine = getKennethQuip(apparentTemp);
  const plainDesc = getPlainDescription(apparentTemp);

  return (
    <div className="card weather-card-bg text-base-content w-full max-w-md mx-auto">
      <div className="card-body">
        <h3 className="card__header-title">Yes, but what does it feel like?</h3>
        <div className="flex flex-col gap-4">
          <div className="chat chat-start">
            <div className="chat-image avatar">
              <div className="w-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                <div className="w-10 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                  <Image src="/loquacious.png" alt="loquacious" width={40} height={40} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
            <div className="chat-bubble chat-bubble-primary">{kennethLine}</div>
          </div>
          <div className="chat chat-end">
            <div className="chat-image avatar">
              <div className="w-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
                <div className="w-10 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                  <Image src="/logical.png" alt="logical" width={40} height={40} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
            <div className="chat-bubble chat-bubble-secondary">{plainDesc}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeelsLike;
