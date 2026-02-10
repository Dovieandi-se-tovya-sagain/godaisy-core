import { defineConfig } from 'tsup';

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],  // ESM only - required for code splitting
    dts: true,
    splitting: true,  // Enable splitting so dynamic imports become separate chunks
    sourcemap: true,
    clean: true,
    external: [
      'react',
      'react-dom',
      'next',
      'next/dynamic',
      'next/image',
      'next/link',
      'next/router',
      'leaflet',
      'react-leaflet',
      /^@capacitor\/.*/,
      /^@capacitor-community\/.*/,
      /^@capgo\/capacitor.*/,
    ],
    treeshake: true,
  });