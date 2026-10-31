'use client';

import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99995] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="bg-neutral-950/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl max-w-2xl w-full p-6 sm:p-8 text-neutral-200 shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative z-10 max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-5 border-b border-white/[0.06]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/25 px-2.5 py-0.5 rounded-full">
                Guia de Navegação &bull; Uso Prático
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-light text-white font-serif tracking-wide">
              Como Usar o Palas Atlas
            </h3>
            <p className="text-xs text-neutral-400 font-sans font-light">
              Orientações essenciais para explorar lâminas em alta definição e recursos interativos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white flex items-center justify-center transition-all border border-white/[0.06] cursor-pointer shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Passos do Guia */}
        <div className="py-5 space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="w-8 h-8 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 flex items-center justify-center font-mono font-medium text-xs shrink-0 mt-0.5">
              01
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-white tracking-wide">
                Navegação Óptica & Zoom Profundo (DZI)
              </h4>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed font-light">
                Utilize o <strong className="text-neutral-200 font-normal">scroll do mouse</strong> ou gestos de <strong className="text-neutral-200 font-normal">pinça no celular</strong> para transitar continuamente da visão panorâmica até o detalhamento celular em alta resolução.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="w-8 h-8 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 flex items-center justify-center font-mono font-medium text-xs shrink-0 mt-0.5">
              02
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-white tracking-wide">
                Pontos de Interesse & Painel Diagnóstico
              </h4>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed font-light">
                Clique nos <strong className="text-neutral-200 font-normal">pinos marcadores</strong> ou nos hiperlinks no texto lateral para que a câmera enquadre a estrutura anatômica automaticamente.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="w-8 h-8 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 flex items-center justify-center font-mono font-medium text-xs shrink-0 mt-0.5">
              03
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-white tracking-wide">
                Alternância Entre Disciplinas
              </h4>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed font-light">
                Alterne a qualquer instante entre as disciplinas — Histologia, Anatomia, Patologia, Parasitologia e Microbiologia — pelo menu lateral no topo.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="w-8 h-8 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 flex items-center justify-center font-mono font-medium text-xs shrink-0 mt-0.5">
              04
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-white tracking-wide">
                Revólver de Objetivas & Escala Micrométrica
              </h4>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed font-light">
                Selecione aumentos calibrados (4x, 10x, 40x, 100x) no seletor rápido inferior e consulte a barra de escala em micrômetros (μm) no canto superior.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between w-full mt-2">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest hidden sm:inline">
            Palas Atlas &bull; Acervo Morfológico
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-[#d4af37] hover:bg-[#e6ca65] text-neutral-950 font-medium px-6 py-2 rounded-full text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ml-auto"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
