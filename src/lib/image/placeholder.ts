// /lib/image/placeholder.ts
// Utility to generate a fallback blurDataURL SVG for missing images

export function generateBlurDataURL(width: number = 32, height: number = 20, color: string = '#e5e7eb'): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
