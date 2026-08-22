import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import ServiceWorker from '@/components/ServiceWorker';
import './globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Chore Board',
  description: 'Daily chores and stars for the whole family',
  applicationName: 'Chore Board',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    // iOS ignores the manifest; this is what gives it a chrome-free home screen app.
    capable: true,
    title: 'Chores',
    statusBarStyle: 'default',
  },
  formatDetection: {
    // Stops iOS turning point totals into phone-number links.
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#3B82F6',
  // A child resting a palm on the tablet must not zoom the board.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} antialiased`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
