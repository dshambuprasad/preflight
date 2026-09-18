import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true, routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }), react(), tailwindcss()],
  server: { port: 5173, proxy: { '/v1': { target: 'http://localhost:3000', changeOrigin: false } } },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'], include: ['test/**/*.test.tsx', 'test/**/*.test.ts'], globals: false },
});
