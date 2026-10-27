import { defineConfig } from 'vite';

export default defineConfig({
  base: '/md-pad/',
  test: { environment: 'jsdom', restoreMocks: true },
});
