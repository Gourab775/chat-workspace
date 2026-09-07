import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Chat Assistant',
  description: 'AI-powered assistant — embed on any website with one line of code.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `dark` here matches the default theme in chat-panel (avoids a flash on load)
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-white text-gray-900 dark:bg-[#212121] dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
