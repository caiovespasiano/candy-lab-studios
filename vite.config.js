import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/

const globalSecurityResponseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

const globalPreviewSecurityResponseHeaders = {
  ...globalSecurityResponseHeaders,
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com; " +
    "connect-src 'self'; base-uri 'self'; form-action 'self';",
}

export default defineConfig(({ command }) => {
  const isDevelopmentServer = command === 'serve'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      headers: globalSecurityResponseHeaders,
    },
    preview: { headers: globalPreviewSecurityResponseHeaders },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setupTests.js',
      coverage: {
        reporter: ['text', 'html'],
      },
    },
    // In dev, Vite HMR and module graph can be blocked by strict CSP.
    // Keep strict CSP only in preview/build-serving environments.
    ...(isDevelopmentServer && {
      server: {
        headers: globalSecurityResponseHeaders,
      },
    }),
  }
})
