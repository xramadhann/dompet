import { defineConfig, loadEnv } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Load semua env vars sesuai mode (development/production)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    root: '.',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      headers: {
        'Service-Worker-Allowed': '/',
      },
    },
    plugins: [
      {
        // Plugin custom: inject env ke firebase-messaging-sw.js saat build
        name: 'inject-sw-env',
        closeBundle() {
          const swPath = resolve(__dirname, 'dist/firebase-messaging-sw.js')
          try {
            let swContent = readFileSync(swPath, 'utf-8')
            // Ganti placeholder dengan nilai dari .env
            swContent = swContent
              .replace('__VITE_FIREBASE_API_KEY__',            env.VITE_FIREBASE_API_KEY)
              .replace('__VITE_FIREBASE_AUTH_DOMAIN__',        env.VITE_FIREBASE_AUTH_DOMAIN)
              .replace('__VITE_FIREBASE_DATABASE_URL__',       env.VITE_FIREBASE_DATABASE_URL)
              .replace('__VITE_FIREBASE_PROJECT_ID__',         env.VITE_FIREBASE_PROJECT_ID)
              .replace('__VITE_FIREBASE_STORAGE_BUCKET__',     env.VITE_FIREBASE_STORAGE_BUCKET)
              .replace('__VITE_FIREBASE_MESSAGING_SENDER_ID__',env.VITE_FIREBASE_MESSAGING_SENDER_ID)
              .replace('__VITE_FIREBASE_APP_ID__',             env.VITE_FIREBASE_APP_ID)
            writeFileSync(swPath, swContent)
            console.log('✅ SW env injected successfully')
          } catch (e) {
            console.warn('⚠️ Could not inject SW env:', e.message)
          }
        }
      }
    ],
  }
})