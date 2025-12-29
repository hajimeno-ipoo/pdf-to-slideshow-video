import { execFile } from 'node:child_process';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function runGenerateUserManual() {
  return new Promise<void>((resolve, reject) => {
    execFile('node', ['scripts/generate-user-manual.mjs'], { cwd: __dirname }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function userManualHtmlPlugin() {
  let queue = Promise.resolve();
  const run = () => {
    queue = queue.then(() => runGenerateUserManual()).catch((e) => {
      console.warn('[user-manual] generate failed:', e);
    });
    return queue;
  };

  return {
    name: 'user-manual-html',
    apply: 'serve',
    async configResolved() {
      await run();
    },
    configureServer(server) {
      const mdPath = path.resolve(__dirname, 'USER_MANUAL.md');
      const imgDir = path.resolve(__dirname, 'Doc', 'manual_images');

      server.watcher.add(mdPath);
      server.watcher.add(imgDir);

      const shouldHandle = (file: string) => file === mdPath || file.startsWith(imgDir);
      server.watcher.on('change', (file) => {
        if (!shouldHandle(file)) return;

        run().then(() => {
          server.ws.send({ type: 'full-reload', path: '/user_manual.html' });
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Use relative base so the app still loads on file:// or subpath deployments
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), userManualHtmlPlugin()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
