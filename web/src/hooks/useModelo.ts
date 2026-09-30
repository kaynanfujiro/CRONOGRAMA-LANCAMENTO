import { useEffect, useRef, useState } from 'react';
import type { Modelo } from '@shared/types';
import { MODELO_PADRAO } from '@shared/modelo-padrao';
import { api } from '../lib/api';

/** Modelo de lead time: carrega do servidor e salva (com atraso de 800 ms) a cada edição. */
export function useModelo(aoSalvar?: () => void) {
  const [modelo, setModelo] = useState<Modelo>(MODELO_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api.modelo().then(setModelo).catch((e) => setErro(e.message));
  }, []);

  function alterar(novo: Modelo) {
    setModelo(novo);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSalvando(true);
      try {
        await api.salvarModelo(novo);
        setErro(null);
        aoSalvar?.();
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setSalvando(false);
      }
    }, 800);
  }

  return { modelo, alterar, salvando, erro };
}
