import React from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
}

/**
 * Optimized image component that uses Next.js Image for optimization
 * Especially useful for icons and smaller images throughout the app
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
  loading = 'lazy',
  priority = false,
}: OptimizedImageProps) {
  // Check if the image is external (starts with http)
  const isExternal = src.startsWith('http');

  // Handle images from the public directory
  const imageSrc = isExternal ? src : src;

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      loading={priority ? undefined : loading}
      priority={priority}
      unoptimized={src.endsWith('.svg')} // SVGs don't need optimization
    />
  );
}
