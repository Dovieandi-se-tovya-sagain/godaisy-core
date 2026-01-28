import OptimizedImage from './OptimizedImage';

export default function HomepageBanner() {
  return (
    <header className="homepage-banner">
      <div className="homepage-banner__container">
        <OptimizedImage
          src="/wotnow-horizontal.webp"
          alt="WotNow Logo"
          width={320}
          height={80}
          className="homepage-banner__logo"
          priority
        />
     <div className="homepage-banner__text">
            <h1 className="homepage-banner__title">What&apos;s good, when?</h1>
            <p className="homepage-banner__subtitle">
              Live your best life, every day
            </p>
          </div>
      </div>
    </header>
  );
}
