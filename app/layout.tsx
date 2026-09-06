import type { Metadata } from 'next';
import '@/template/plantilla.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carruseles · @alergo_derma',
  description: 'Generador de carruseles de Instagram con la plantilla de la cuenta.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
