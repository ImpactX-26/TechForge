import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const githubRepository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS === 'true'
  && githubRepository
  && !githubRepository.endsWith('.github.io')
  ? `/${githubRepository}/`
  : '/';

// https://vitejs.dev/config/
export default {
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
};
