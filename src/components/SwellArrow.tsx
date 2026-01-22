export default function SwellArrow({ deg }: { deg: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        transform: `rotate(${deg}deg)`,
        transition: 'transform 0.2s',
      }}
      title={`${deg}°`}
    >
      ↑
    </span>
  );
}
