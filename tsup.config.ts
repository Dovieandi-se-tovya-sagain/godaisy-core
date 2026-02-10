import { defineConfig } from 'tsup';

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
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
      // Capacitor packages - must be external to avoid SSR issues
      /^@capacitor\/.*/,
      /^@capacitor-community\/.*/,
      /^@capgo\/capacitor.*/,
    ],
    treeshake: true,
  });