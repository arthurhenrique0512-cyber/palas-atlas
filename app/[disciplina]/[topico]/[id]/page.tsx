import React from 'react';
import { notFound } from 'next/navigation';
import { getLaminaById } from '@/lib/data/catalog';
import { MicroscopeViewerClient } from '@/components/microscope/MicroscopeViewerClient';
import type { Metadata } from 'next';

interface SlidePageProps {
  params: Promise<{
    disciplina: string;
    topico: string;
    id: string;
  }>;
}

export async function generateMetadata({ params }: SlidePageProps): Promise<Metadata> {
  const { id } = await params;
  const slide = await getLaminaById(id);

  if (!slide) {
    return {
      title: 'Lâmina não encontrada — Palas Atlas',
    };
  }

  const title = `${slide.nome} (${slide.coloracao}) — Palas Atlas`;
  const desc = `Estudo microscópico digital de ${slide.nome} em alta resolução. Coloração: ${slide.coloracao}. Magnificação óptica: até ${slide.max_magnification}x.`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: slide.thumbnail_url || slide.preview_image ? [{ url: slide.thumbnail_url || slide.preview_image! }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: slide.thumbnail_url || slide.preview_image ? [slide.thumbnail_url || slide.preview_image!] : [],
    }
  };
}

export default async function SlidePage({ params }: SlidePageProps) {
  const { id } = await params;
  const slide = await getLaminaById(id);

  if (!slide) notFound();

  return <MicroscopeViewerClient slide={slide} />;
}
