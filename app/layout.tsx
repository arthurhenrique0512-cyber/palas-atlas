import type { Metadata } from 'next';
import {
  Inter,
  Plus_Jakarta_Sans,
  Cormorant_Garamond,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Palas Atlas | Atlas de Histologia Digital',
  description:
    'Plataforma acadêmica de microscopia digital em alta resolução para o ensino de histologia.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${plusJakarta.variable} ${cormorant.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-sky-200/60 selection:text-slate-900">
        {children}
      </body>
    </html>
  );
}
