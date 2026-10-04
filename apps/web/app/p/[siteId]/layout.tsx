import type { ReactNode } from 'react';
import {
  Lora,
  Playfair_Display,
  Source_Sans_3,
  Space_Grotesk,
} from 'next/font/google';
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${lora.variable} ${playfair.variable} ${sourceSans.variable} ${spaceGrotesk.variable}`}
    >
      {children}
    </div>
  );
}
