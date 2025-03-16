import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@state': path.resolve(__dirname, './src/state'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@scenes': path.resolve(__dirname, './src/scenes'),
      '@shaders': path.resolve(__dirname, './src/shaders'),
    },
  },
  optimizeDeps: {
    exclude: ['three-stdlib'],
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          vendor: ['react', 'react-dom', 'zustand', 'gsap'],
        },
      },
    },
    assetsInclude: ['**/*.wasm', '**/*.js'],
  },
  server: {
    open: true,
    port: 3000,
  },
  define: {
    'process.env.PUBLIC_URL': JSON.stringify('/public/'),
  },
});