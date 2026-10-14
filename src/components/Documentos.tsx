/* eslint-disable @next/next/no-img-element */
import { query } from "@/lib/db";
import { TIPOS_ARQUIVO, type TipoArquivo } from "@/lib/arquivos";

/** Mostra os documentos de uma solicitação ou de uma pessoa (somente área logada) */
export default async function Documentos({ solicitacaoId, pessoaId }: { solicitacaoId?: number; pessoaId?: number }) {
  const arquivos = await query<{ id: number; tipo: TipoArquivo; mime: string; tamanho: number; nome: string | null; criado_em: Date }>(
    `SELECT id, tipo, mime, tamanho, nome, criado_em FROM arquivos
      WHERE ($1::int IS NOT NULL AND solicitacao_id = $1) OR ($2::int IS NOT NULL AND pessoa_id = $2)
      ORDER BY criado_em DESC, id DESC`,
    [solicitacaoId ?? null, pessoaId ?? null]
  );
  // Mais recente de cada tipo
  const porTipo = new Map<TipoArquivo, (typeof arquivos)[number]>();
  for (const a of arquivos) if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, a);
  return (
    <div className="docs">
      {(Object.keys(TIPOS_ARQUIVO) as TipoArquivo[]).map((t) => {
        const a = porTipo.get(t);
        return (
          <div className="doc" key={t}>
            <div className="t">{TIPOS_ARQUIVO[t]}</div>
            {!a ? (
              <div className="faltando">Não enviado</div>
            ) : a.mime === "application/pdf" ? (
              <a href={`/arquivos/${a.id}`} target="_blank" rel="noreferrer">
                <div className="pdf">📄</div>
                Abrir PDF ({Math.round(a.tamanho / 1024)} KB)
              </a>
            ) : (
              <a href={`/arquivos/${a.id}`} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
                <img src={`/arquivos/${a.id}`} alt={TIPOS_ARQUIVO[t]} loading="lazy" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
