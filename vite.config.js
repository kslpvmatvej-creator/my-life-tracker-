import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' -> ассеты из public/ (m3.jpg, m3-edit.mp4) грузятся на GitHub Pages по любой ссылке
export default defineConfig({
  base: './',
  plugins: [react()]
});
