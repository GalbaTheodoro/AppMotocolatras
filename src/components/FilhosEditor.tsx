"use client";

import { useState } from "react";

type Filho = { nome: string; data_nascimento: string | null; sexo: string | null };

function idade(n: string | null) {
  if (!n) return "";
  const [y, m, d] = n.split("-").map(Number);
  const h = new Date();
  let a = h.getFullYear() - y;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) a--;
  return a >= 0 && a < 130 ? `${a} ano${a === 1 ? "" : "s"}` : "";
}

/** Lista de filhos com "+ Adicionar filho(a)" (até o máximo) */
export default function FilhosEditor({ iniciais, max = 5 }: { iniciais: Filho[]; max?: number }) {
  const [filhos, setFilhos] = useState<Filho[]>(iniciais.length ? iniciais : []);
  const hoje = new Date().toISOString().slice(0, 10);

  function mudar(i: number, campo: keyof Filho, v: string) {
    setFilhos((f) => f.map((x, k) => (k === i ? { ...x, [campo]: v || null } : x)));
  }

  return (
    <div className="filhos">
      {filhos.length === 0 && <p className="sub" style={{ margin: 0 }}>Nenhum filho cadastrado.</p>}
      {filhos.map((f, i) => (
        <div className="filho" key={i}>
          <div className="filho-num">{i + 1}</div>
          <label style={{ flex: "2 1 220px" }}>Nome
            <input name={`filho_nome_${i}`} value={f.nome} onChange={(e) => mudar(i, "nome", e.currentTarget.value)} required />
          </label>
          <label style={{ flex: "1 1 150px" }}>Nascimento {f.data_nascimento && <span className="sub" style={{ fontWeight: 400 }}>({idade(f.data_nascimento)})</span>}
            <input type="date" name={`filho_nasc_${i}`} max={hoje} value={f.data_nascimento ?? ""} onChange={(e) => mudar(i, "data_nascimento", e.currentTarget.value)} />
          </label>
          <label style={{ flex: "1 1 120px" }}>Sexo
            <select name={`filho_sexo_${i}`} value={f.sexo ?? ""} onChange={(e) => mudar(i, "sexo", e.currentTarget.value)}>
              <option value="">—</option><option>Masculino</option><option>Feminino</option>
            </select>
          </label>
          <button type="button" className="remover" title="Remover" aria-label="Remover filho"
            onClick={() => setFilhos((x) => x.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      {filhos.length < max ? (
        <button type="button" className="btn sec peq" style={{ justifySelf: "start" }}
          onClick={() => setFilhos((x) => [...x, { nome: "", data_nascimento: null, sexo: null }])}>
          + Adicionar filho(a)
        </button>
      ) : (
        <p className="sub" style={{ margin: 0, fontSize: ".85rem" }}>Limite de {max} filhos.</p>
      )}
    </div>
  );
}
