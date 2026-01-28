import * as React from 'react';
import { getImageVariants, isImageOptimized } from '../data/bgMapOptimized';
import bgMap from '../data/bgMap';

interface SmartBackgroundImageProps {
  activityId: string;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Smart background image component that:
 * 1. Uses optimized WebP images when available
 * 2. Falls back to original PNG images
 * 3. Serves appropriate sizes for mobile/desktop
 * 4. Uses CSS background-image for overlay compatibility
 */
export default function SmartBackgroundImage({
  activityId,
  className = '',
  children,
  style = {},
}: SmartBackgroundImageProps) {
  const [backgroundImage, setBackgroundImage] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    // Detect mobile viewport
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  React.useEffect(() => {
    const loadOptimalImage = async () => {
      setIsLoading(true);
      
      if (isImageOptimized(activityId)) {
        const variants = getImageVariants(activityId);
        if (variants) {
          // Try WebP first (mobile or desktop)
          const webpSrc = isMobile ? variants.webpSmall : variants.webpLarge;
          
          try {
            // Test if WebP loads successfully
            await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = resolve as () => void;
              img.onerror = reject as () => void;
              img.src = webpSrc;
            });
            
            setBackgroundImage(`url(${webpSrc})`);
          } catch {
            // Fallback to original PNG
            setBackgroundImage(`url(${variants.fallback})`);
          }
        }
      } else {
        // Use original bgMap
        const originalSrc = bgMap[activityId] ?? '/zumba.png';
        setBackgroundImage(`url(${originalSrc})`);
      }
      
      setIsLoading(false);
    };

    loadOptimalImage();
  }, [activityId, isMobile]);

  const containerStyle = {
    backgroundImage: isLoading ? 'none' : backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    ...style,
  } as React.CSSProperties;

  return (
    <div 
      className={`relative ${isLoading ? 'bg-gray-300 animate-pulse' : ''} ${className}`}
      style={containerStyle}
    >
      {children}
    </div>
  );
}
