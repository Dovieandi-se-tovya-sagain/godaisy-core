import React from 'react';
import { getActivityEmoji } from '../data/emojiMap';
import { getActivityBg } from '../data/bgMap';
import { getOptimizedImageSrc, isImageOptimized } from '../data/bgMapOptimized';

interface CardProps {
  activityId: string;
  title: string;
  score: number;
  category: 'perfect' | 'good' | 'fair' | 'poor';
  description: string;
  marineData?: {
    waveHeight?: number;
    windSpeed?: number;
    waterTemperature?: number;
  };
  onClick: () => void;
}

const Card: React.FC<CardProps> = ({ activityId, title, score, category, description, marineData, onClick }) => {
  // Use optimized image if available, otherwise fallback to original
  const bgUrl = isImageOptimized(activityId) 
    ? getOptimizedImageSrc(activityId, 'webpSmall') // Cards are smaller, use mobile/small version
    : getActivityBg(activityId);

  return (
    <article
      className={`card card--${category} activity-card-enhanced`}
      style={{ backgroundImage: `url(${bgUrl})` }}
      onClick={onClick}
    >
      <div className="activity-card-overlay"></div>
      <div className="card__content activity-card-content">
        <div className="card__header">
          <span className="card__emoji">{getActivityEmoji(activityId)}</span>
          <h3 className="card__title">{title}</h3>
        </div>
        <p className="card__description">{description}</p>
        {marineData && (
          <div className="card__marine-data">
            {marineData.waveHeight && <span>🌊 {marineData.waveHeight}m</span>}
            {marineData.windSpeed && <span>💨 {marineData.windSpeed}km/h</span>}
            {marineData.waterTemperature && <span>🏊‍♂️ {marineData.waterTemperature.toFixed(1)}°C</span>}
          </div>
        )}
        <div className="card__score">Score: {score}%</div>
      </div>
    </article>
  );
};

export default Card;

