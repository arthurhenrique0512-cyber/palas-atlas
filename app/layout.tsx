import React from 'react';
import type { Metadata } from 'next';
import ScrollToTop from '../components/ScrollToTop';
import Navbar from '../components/Navbar';

export const metadata: Metadata = {
  title: 'Palas Atlas - Atlas Integrado de Ciências Morfológicas',
  description: 'Atlas Morfológico Digital e Simulador de Microscopia Óptica',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0b0f17] text-slate-100 antialiased min-h-screen">
        <ScrollToTop />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
