import { useCallback, useEffect, useRef, useState } from 'react';
import type { Projeto } from '@shared/types';
import { api } from '../lib/api';

const INTERVALO = 2 * 60 * 1000; // relê o ClickUp a cada 2 minutos

export function useProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [sincronizadoEm, setSincronizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);

  const carregar = useCallback(async (forcar = false) => {
    if (emVoo.current) return;
    emVoo.current = true;
    setCarregando(true);
    try {
      const r = await api.projetos(forcar);
      setProjetos(r.projetos);
      setSincronizadoEm(r.sincronizadoEm);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message); // mantém os últimos dados na tela
    } finally {
      emVoo.current = false;
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') carregar();
    }, INTERVALO);
    return () => clearInterval(id);
  }, [carregar]);

  return { projetos, sincronizadoEm, carregando, erro, atualizar: () => carregar(true) };
}
