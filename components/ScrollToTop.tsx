'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Componente global que força a rolagem da janela para o topo absoluto (0, 0)
 * sempre que a rota/caminho (pathname) mudar.
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  }, [pathname]);

  return null;
}
