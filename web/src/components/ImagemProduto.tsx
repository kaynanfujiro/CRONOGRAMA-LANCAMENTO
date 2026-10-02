import { useEffect, useState } from 'react';
import type { Projeto } from '@shared/types';

/**
 * Foto do produto (campo "IMAGEM PRODUTO" do ClickUp) numa caixa de tamanho fixo.
 * Sem imagem, ou se ela não carregar, mostra um ícone neutro no lugar.
 */
export function ImagemProduto({ p, grande = false, className = '' }: { p: Projeto; grande?: boolean; className?: string }) {
  const img = p.imagem;
  const src = img ? (grande ? img.url : img.miniatura) : null;
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [src]);

  // imagem pequena não é ampliada mais que 2,5x (ficaria borrada)
  const limite = img?.largura && img?.altura ? { maxWidth: img.largura * 2.5, maxHeight: img.altura * 2.5 } : undefined;

  return (
    <span className={`flex flex-none items-center justify-center overflow-hidden rounded-md border border-line bg-white ${className}`}>
      {src && !falhou ? (
        <img
          src={src}
          alt={grande ? `Imagem do produto ${p.nome}` : ''}
          loading={grande ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFalhou(true)}
          className="h-full w-full object-contain p-1"
          style={limite}
        />
      ) : (
        <span
          className="flex flex-col items-center gap-1 px-2 text-center text-muted/70"
          title={img ? 'Não foi possível carregar a imagem do ClickUp' : 'Sem imagem — anexe a foto no campo IMAGEM PRODUTO do card no ClickUp'}
        >
          <svg viewBox="0 0 24 24" className={grande ? 'h-9 w-9' : 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="3" y="4.5" width="18" height="15" rx="2" />
            <circle cx="9" cy="10" r="1.75" />
            <path d="m21 16-4.5-4.5L8 19.5" />
          </svg>
          {grande && (
            <span className="text-[11.5px] leading-tight">
              {img ? 'Não foi possível carregar a imagem' : 'Sem imagem — anexe no campo IMAGEM PRODUTO'}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
