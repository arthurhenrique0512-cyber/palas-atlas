import React from 'react';
import type { Metadata } from 'next';
import MicroscopeViewerClient, { SlideData } from './MicroscopeViewerClient';

// Catálogo base de lâminas para resolução instantânea e resiliente
const catalog: Record<string, SlideData> = {
  '5kqs5Qv9fvWlpNSJoyPG': {
    id: '5kqs5Qv9fvWlpNSJoyPG',
    title: 'Medula Espinal (Corte Transversal)',
    category: 'Histologia • Sistema Nervoso',
    stain: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Corte Transversal',
    desc: 'Corte transversal de medula espinal exibindo substância cinzenta central em forma de "H" com motoneurônios no corno anterior e substância branca periférica contendo tratos mielinizados.',
    imageUrl: 'assets/histologia/medula-espinal-he.png',
    previewImage: 'assets/histologia/medula-espinal-he.png',
    maxMagnification: 40,
    mpp: 0.25,
    pinos: []
  },
  'a3oRvXvJpMKAtU2RE85q': {
    id: 'a3oRvXvJpMKAtU2RE85q',
    title: 'Preparação Histológica Digital Matriz',
    category: 'Histologia • Tecido Epitelial',
    stain: 'Hematoxilina e Eosina (H&E) • 40x',
    specimen: 'Varredura Panorâmica',
    desc: 'Lâmina completa digitalizada em altíssima resolução com pirâmide de Deep Zoom (DZI) para exploração microscópica multiescala.',
    dziUrl: 'assets/histologia/lamina-real1.dzi',
    imageUrl: 'assets/histologia/lamina-real1.dzi',
    previewImage: 'assets/histologia/lamina-real1-preview.jpg',
    maxMagnification: 40,
    mpp: 0.25,
    pinos: []
  },
  'medula-espinal-he': {
    id: 'medula-espinal-he',
    title: 'Medula Espinal (Corte Transversal)',
    category: 'Histologia • Sistema Nervoso',
    stain: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Corte Transversal',
    desc: 'Corte transversal de medula espinal exibindo substância cinzenta central em forma de "H" com motoneurônios no corno anterior e substância branca periférica contendo tratos mielinizados.',
    imageUrl: 'assets/histologia/medula-espinal-he.png',
    previewImage: 'assets/histologia/medula-espinal-he.png',
    maxMagnification: 40,
    mpp: 0.25,
    pinos: []
  },
  'muscular-esqueletico-he': {
    id: 'muscular-esqueletico-he',
    title: 'Tecido Muscular Estriado Esquelético',
    category: 'Histologia • Tecido Muscular',
    stain: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Corte Longitudinal',
    desc: 'Corte longitudinal de músculo estriado esquelético. Fibras musculares multinucleadas com núcleos periféricos achatados e estriações transversais de actina e miosina.',
    imageUrl: 'assets/histologia/muscular-esqueletico-he.jpg',
    previewImage: 'assets/histologia/muscular-esqueletico-he.jpg',
    maxMagnification: 40,
    mpp: 0.25,
    pinos: []
  },
  'osso_compacto_dzi': {
    id: 'osso_compacto_dzi',
    title: 'Osso Compacto Desgastado',
    category: 'Histologia • Tecido Ósseo',
    stain: 'Desgaste • 40x',
    specimen: 'Corte Transversal Desgastado',
    desc: 'Tecido ósseo compacto evidenciando sistemas de Havers (ósteons), canais centrais vasculares, lamelas concêntricas e lacunas comunicantes com canalículos de osteócitos.',
    dziUrl: 'assets/histologia/osso_compacto_dzi.dzi',
    imageUrl: 'assets/histologia/osso_compacto_dzi.dzi',
    previewImage: 'assets/histologia/osso-compacto-preview.jpg',
    maxMagnification: 40,
    mpp: 0.25,
    pinos: []
  },
  'epitelio-simples-escamoso': {
    id: 'epitelio-simples-escamoso',
    title: 'Epitélio Pavimentoso Simples',
    category: 'Histologia • Tecido Epitelial',
    stain: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Camada Única',
    desc: 'Camada única de células epiteliais pavimentosas (achatadas) com núcleos elípticos proeminentes, adaptadas para transporte passivo e difusão de solutos.',
    dziUrl: 'assets/histologia/epitelio-simples-escamoso.dzi',
    imageUrl: 'assets/histologia/epitelio-simples-escamoso.dzi',
    previewImage: 'assets/histologia/epitelio-simples-escamoso-preview.jpg',
    maxMagnification: 40,
    mpp: 0.25,
    pinos: []
  },
  'lamina-real1': {
    id: 'lamina-real1',
    title: 'Preparação Histológica Digital Matriz',
    category: 'Histologia • Tecido Epitelial',
    stain: 'Hematoxilina e Eosina (H&E)',
    specimen: 'Varredura Panorâmica',
    desc: 'Lâmina completa digitalizada em altíssima resolução com pirâmide de Deep Zoom (DZI) para exploração microscópica multiescala.',
    dziUrl: 'assets/histologia/lamina-real1.dzi',
    imageUrl: 'assets/histologia/lamina-real1.dzi',
    previewImage: 'assets/histologia/lamina-real1-preview.jpg',
    maxMagnification: 40,
    mpp: 0.25,
    pinos: []
  }
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const slide = catalog[id] || catalog[id.toLowerCase()];
  const title = slide ? `${slide.title} — Palas Atlas` : 'Microscópio Virtual — Palas Atlas';
  return {
    title,
    description: slide?.desc || 'Simulador de Microscopia Óptica e Análise Morfológica Interativa.'
  };
}

export default async function LaminaPage({ params, searchParams }: PageProps) {
  // Diretrizes do Next.js App Router (Next.js 15+): desempacotamento assíncrono de params e searchParams
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const slideId = resolvedParams.id || (resolvedSearchParams.id as string) || '';

  // Resolução imediata com fallback resiliente
  const initialSlide = catalog[slideId] || 
                       catalog[slideId.toLowerCase()] || 
                       Object.values(catalog).find(s => s.id.toLowerCase() === slideId.toLowerCase()) || 
                       null;

  return (
    <MicroscopeViewerClient
      initialSlide={initialSlide}
      slideId={slideId}
    />
  );
}
