"use client";

import { useMemo, useState } from "react";

type Equip = { id: number; nome: string; categoria: string | null; descricao: string | null };

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Busca + "Adicionar" para escolher equipamentos numa lista grande.
 * Envia no formulário campos "qtd_<id>" (o servidor já entende esse formato).
 */
export default function SeletorEquipamentos({ equipamentos }: { equipamentos: Equip[] }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [escolhidos, setEscolhidos] = useState<Record<number, number>>({});

  const categorias = useMemo(
    () => Array.from(new Set(equipamentos.map((e) => e.categoria).filter(Boolean))) as string[],
    [equipamentos]
  );

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return equipamentos.filter((e) => {
      if (escolhidos[e.id]) return false;
      if (categoria && e.categoria !== categoria) return false;
      if (!termo) return true;
      return normalizar(`${e.nome} ${e.categoria ?? ""} ${e.descricao ?? ""}`).includes(termo);
    });
  }, [busca, categoria, equipamentos, escolhidos]);

  const lista = equipamentos.filter((e) => escolhidos[e.id]);
  const totalUn = lista.reduce((s, e) => s + escolhidos[e.id], 0);

  function adicionar(id: number) {
    setEscolhidos((x) => ({ ...x, [id]: 1 }));
  }
  function mudar(id: number, qtd: number) {
    setEscolhidos((x) => ({ ...x, [id]: Math.max(1, Math.min(50, Math.floor(qtd) || 1)) }));
  }
  function remover(id: number) {
    setEscolhidos((x) => {
      const y = { ...x };
      delete y[id];
      return y;
    });
  }

  return (
    <div className="seletor">
      {/* Itens escolhidos */}
      <div className="escolhidos">
        <div className="titulo-escolhidos">
          Itens escolhidos {lista.length > 0 && <span className="badge" style={{ background: "var(--side)" }}>{totalUn}</span>}
        </div>
        {lista.length === 0 ? (
          <div className="sub" style={{ fontSize: ".9rem" }}>Nenhum item ainda. Pesquise abaixo e toque em <b>+ Adicionar</b>.</div>
        ) : (
          lista.map((e) => (
            <div className="item escolhido" key={e.id}>
              <div style={{ minWidth: 0 }}>
                <div className="nome">{e.nome}</div>
                {e.categoria && <div className="desc">{e.categoria}</div>}
              </div>
              <div className="qtd-controle">
                <button type="button" className="btn sec peq" onClick={() => (escolhidos[e.id] <= 1 ? remover(e.id) : mudar(e.id, escolhidos[e.id] - 1))} aria-label="Diminuir">−</button>
                <input
                  type="number" min={1} max={50} value={escolhidos[e.id]}
                  onChange={(ev) => mudar(e.id, Number(ev.currentTarget.value))}
                  name={`qtd_${e.id}`} aria-label={`Quantidade de ${e.nome}`}
                />
                <button type="button" className="btn sec peq" onClick={() => mudar(e.id, escolhidos[e.id] + 1)} aria-label="Aumentar">+</button>
                <button type="button" className="remover" onClick={() => remover(e.id)} aria-label={`Remover ${e.nome}`} title="Remover">✕</button>
              </div>
            </div>
          ))
        )}
        {/* Garante que o navegador avise se nada foi escolhido */}
        <input
          className="arquivo-real" tabIndex={-1} aria-hidden="true" required readOnly
          value={lista.length ? "ok" : ""}
          onInvalid={(e) => e.currentTarget.setCustomValidity("Adicione pelo menos um equipamento.")}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
        />
      </div>

      {/* Busca */}
      <div className="busca-equip">
        <input
          type="search" placeholder="🔍 Pesquisar equipamento (ex.: capacete, luva, jaqueta)"
          value={busca} onChange={(e) => setBusca(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (resultados.length === 1) { adicionar(resultados[0].id); setBusca(""); } } }}
        />
        {categorias.length > 1 && (
          <div className="chips">
            <button type="button" className={`chip ${categoria === "" ? "on" : ""}`} onClick={() => setCategoria("")}>Todos</button>
            {categorias.map((c) => (
              <button type="button" key={c} className={`chip ${categoria === c ? "on" : ""}`} onClick={() => setCategoria(categoria === c ? "" : c)}>{c}</button>
            ))}
          </div>
        )}
        <div className="resultados">
          {resultados.length === 0 ? (
            <div className="sub" style={{ padding: 12, textAlign: "center" }}>
              {busca || categoria ? "Nenhum equipamento encontrado." : "Todos os equipamentos já foram adicionados."}
            </div>
          ) : (
            resultados.map((e) => (
              <div className="item" key={e.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="nome">{e.nome}</div>
                  <div className="desc">{[e.categoria, e.descricao].filter(Boolean).join(" · ")}</div>
                </div>
                <button type="button" className="btn peq" onClick={() => adicionar(e.id)}>+ Adicionar</button>
              </div>
            ))
          )}
        </div>
        <div className="sub" style={{ fontSize: ".8rem", marginTop: 6 }}>
          {resultados.length} de {equipamentos.length - lista.length} equipamento(s) {busca || categoria ? "encontrado(s)" : "disponível(is) para escolher"}
        </div>
      </div>
    </div>
  );
}
