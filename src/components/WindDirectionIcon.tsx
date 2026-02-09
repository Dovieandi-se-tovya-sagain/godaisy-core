// Import weather icons CSS with the component for code-splitting
// This 127KB file is now lazy-loaded only when WindDirectionIcon is used
// import '../styles/weather-icons-wind.min.css'; // Apps must import this themselves

export default function WindDirectionIcon({ deg, size = 24, className = '' }: { deg: number; size?: number; className?: string }) {
  const roundedDeg = Math.round(deg);
  const iconClass = `wi wi-wind from-${roundedDeg}-deg`;

  return (
    <i
      className={`${iconClass} ${className}`.trim()}
      title={`Wind from ${roundedDeg}°`}
      style={{ fontSize: size, verticalAlign: 'middle' }}
    />
  );
}
