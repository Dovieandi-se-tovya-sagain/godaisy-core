import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface OptimizedBackgroundImageProps {
  src: string;
  alt: string;
  className?: string;
  children?: React.ReactNode;
  priority?: boolean;
  style?: React.CSSProperties;
}

/**
 * Optimized background image component that:
 * 1. Uses Next.js Image for optimization
 * 2. Serves WebP when available
 * 3. Uses responsive sizes for mobile/desktop
 * 4. Implements lazy loading (unless priority=true)
 */
export default function OptimizedBackgroundImage({
  src,
  alt,
  className = '',
  children,
  priority = false,
  style = {},
}: OptimizedBackgroundImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile viewport
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Try to use WebP version if available
    const baseName = src.replace(/\.(png|jpg|jpeg)$/i, '');
    const webpSrc = isMobile 
      ? `/webp${baseName}-mobile.webp`
      : `/webp${baseName}.webp`;

    // Check if WebP version exists
    const img = new window.Image();
    img.onload = () => setImageSrc(webpSrc);
    img.onerror = () => setImageSrc(src); // Fallback to original
    img.src = webpSrc;
  }, [src, isMobile]);

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        className="object-cover"
        priority={priority}
        sizes={isMobile ? "512px" : "1024px"}
        quality={85}
      />
      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}
    </div>
  );
}
