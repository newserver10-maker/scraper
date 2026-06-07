import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages 배포 시 절대경로 문제 방지
  server: {
    port: 5173,
  },
});
