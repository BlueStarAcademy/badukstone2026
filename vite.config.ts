import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are loaded correctly when hosted.
  build: {
    outDir: 'dist', // Specifies the output directory for the build files.
  },
});