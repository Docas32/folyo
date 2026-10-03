import type { ReactNode } from 'react';
import { defaultMessages } from '@folyo/core';
export const metadata = {
  title: defaultMessages.brand
};
export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
