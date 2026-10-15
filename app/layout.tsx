import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Thoppu Ledger | Farm bookkeeping',
  description: 'Simple, honest bookkeeping for your coconut farm.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Thoppu Ledger',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1f5f46',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased text-[#18221c] bg-[#fafaf7]">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (var reg of registrations) {
                      reg.unregister();
                    }
                  });
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      for (var name of names) {
                        caches.delete(name);
                      }
                    });
                  }
                } else {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.log('SW registration failed: ', err);
                    });
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
