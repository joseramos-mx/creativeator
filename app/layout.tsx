import type { Metadata } from 'next';
import '@/plantillas/clinica/plantilla.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carruseles',
  description: 'Generador de carruseles de Instagram, una plantilla por cuenta.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
