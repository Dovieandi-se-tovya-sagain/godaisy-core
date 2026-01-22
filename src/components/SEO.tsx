import Head from 'next/head';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  lcpImage?: string; // Preload hint for LCP image
}

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  lcpImage
}: SEOProps) {
  const siteUrl = 'https://godaisy.io';
  const fullUrl = url || siteUrl;
  const ogImage = image || `${siteUrl}/og-image.png`;
  const siteName = 'Go Daisy';
  const fullTitle = `${title} | ${siteName}`;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="weather, activities, outdoor, recommendations, forecast, things to do, weather-based activities" />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph (Facebook, LinkedIn) */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#111827" />
      <meta name="author" content="Go Daisy" />

      {/* LCP Image Preload - improves Largest Contentful Paint */}
      {lcpImage && (
        <link
          rel="preload"
          as="image"
          href={lcpImage}
          type="image/webp"
        />
      )}
    </Head>
  );
}
