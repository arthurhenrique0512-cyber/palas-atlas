import type { Metadata } from 'next';
import { Inter, Merriweather, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const merriweather = Merriweather({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-merriweather',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://palasatlas.com'),
  title: 'Palas Atlas | Atlas Morfológico Digital',
  description: 'Plataforma de ensino morfológico focado em Histologia, Anatomia, Patologia e Microscopia Digital para o ciclo básico da Medicina.',
  openGraph: {
    type: 'website',
    url: 'https://palasatlas.com',
    title: 'Palas Atlas | Atlas Morfológico Digital',
    description: 'Explore lâminas histológicas e preparações morfológicas em altíssima resolução com navegação óptica profunda.',
    images: [{ url: '/og-preview.png', width: 1200, height: 630, alt: 'Palas Atlas' }],
  },
  icons: {
    icon: '/assets/logo-coruja.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${merriweather.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-[#090b10] text-slate-200 min-h-screen flex flex-col font-sans antialiased selection:bg-[#d4af37]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
