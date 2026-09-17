import type { Metadata } from 'next';
import './globals.css';
import { TopNav } from '../components/AppNav';
import { GalaxyBackground } from '../components/GalaxyBackground';

export const metadata: Metadata = {
  title: 'Verdict | Pre-action Security Gate for Autonomous Agents',
  description:
    'A pre-action security gate for autonomous agents on Base — deterministic rules decide, every time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#030611] text-[#f5f6f8] antialiased flex flex-col selection:bg-blue-600 selection:text-white font-sans">
        {/* Background Lighting & Grid Matrix */}
        <GalaxyBackground />

        {/* Global Nav */}
        <TopNav />

        {/* Main Content Area */}
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
