"use client";

import { useMemo, useState } from "react";

type Pessoa = { id: number; nome: string; papel: string };
const PAPEL: Record<string, string> = { admin: "ADM", operador: "Operador", integrante: "Integrante" };

/** Lista de integrantes para escolher quem participa (envia campos "convidado") */
export default function EscolherParticipantes({ pessoas, iniciais = [] }: { pessoas: Pessoa[]; iniciais?: number[] }) {
  const [sel, setSel] = useState<Set<number>>(new Set(iniciais));
  const [busca, setBusca] = useState("");
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visiveis = useMemo(() => pessoas.filter((p) => n(p.nome).includes(n(busca))), [pessoas, busca]);
  const marcar = (ids: number[], ligar: boolean) =>
    setSel((s) => { const x = new Set(s); ids.forEach((i) => (ligar ? x.add(i) : x.delete(i))); return x; });

  return (
    <div className="participantes">
      <input type="hidden" name="tem_convidados" value="1" />
      {[...sel].map((id) => <input key={id} type="hidden" name="convidado" value={id} />)}
      <div className="acoes" style={{ gap: 6, flexWrap: "wrap" }}>
        <input type="search" placeholder="🔍 Buscar integrante" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: "1 1 180px" }} />
        <button type="button" className="chip" onClick={() => marcar(pessoas.map((p) => p.id), true)}>Todos</button>
        <button type="button" className="chip" onClick={() => marcar(pessoas.filter((p) => p.papel !== "integrante").map((p) => p.id), true)}>Diretoria/equipe</button>
        <button type="button" className="chip" onClick={() => setSel(new Set())}>Nenhum</button>
      </div>
      <div className="presentes" style={{ maxHeight: 220, overflowY: "auto", marginTop: 6 }}>
        {visiveis.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={sel.has(p.id)} onChange={(e) => marcar([p.id], e.target.checked)} />
            {p.nome} <span className="sub" style={{ fontSize: ".72rem" }}>{PAPEL[p.papel] ?? ""}</span>
          </label>
        ))}
      </div>
      <div className="sub" style={{ fontSize: ".8rem", marginTop: 4 }}>
        {sel.size ? `${sel.size} participante(s) — receberão aviso no celular` : "Ninguém escolhido: o aviso vai para todos os integrantes"}
      </div>
    </div>
  );
}
