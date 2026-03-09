import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oracle — AI Trading Copilot',
  description:
    'Real-time multimodal trading analysis powered by Gemini. Oracle watches your live chart, listens to your voice, and gives instant market intelligence — setups, levels, bias, and trade ideas.',
  openGraph: {
    title: 'Oracle — AI Trading Copilot',
    description:
      'Real-time multimodal trading intelligence. Oracle sees your chart, hears your questions, responds live.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased h-full">{children}</body>
    </html>
  );
}
