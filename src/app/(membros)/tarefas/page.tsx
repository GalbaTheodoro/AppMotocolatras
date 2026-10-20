import Link from "next/link";
import { query } from "@/lib/db";
import { exigirLogado, ehEquipe } from "@/lib/auth";
import { hojeISO } from "@/lib/formato";
import { SQL_TAREFAS, usuariosAtivos, type Tarefa } from "@/lib/reunioes";
import Mensagem from "@/components/Mensagem";
import { NovaTarefa, ListaTarefas } from "@/components/Tarefas";

const FILTROS: Record<string, string> = {
  abertas: "Em aberto", minhas: "Minhas", atrasadas: "Atrasadas", concluidas: "Concluídas", todas: "Todas",
};

export default async function TarefasPagina({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; f?: string }> }) {
  const u = await exigirLogado();
  const sp = await searchParams;
  const f = sp.f && sp.f in FILTROS ? sp.f : "abertas";
  const hoje = hojeISO();
  const onde: Record<string, string> = {
    abertas: "t.status IN ('pendente','andamento')",
    minhas: "t.responsavel_id = $1 AND t.status IN ('pendente','andamento')",
    atrasadas: "t.status IN ('pendente','andamento') AND t.prazo < $2",
    concluidas: "t.status = 'concluida'",
    todas: "TRUE",
  };
  const [tarefas, usuarios, contagem] = await Promise.all([
    query<Tarefa>(
      `${SQL_TAREFAS} WHERE ${onde[f]} AND ($1::int IS NOT NULL) AND ($2::date IS NOT NULL)
        ORDER BY t.status IN ('concluida','cancelada'), t.prazo NULLS LAST, t.id DESC LIMIT 300`, [u.id, hoje]),
    usuariosAtivos(),
    query<{ k: string; n: number }>(
      `SELECT 'abertas' k, count(*)::int n FROM tarefas WHERE status IN ('pendente','andamento')
       UNION ALL SELECT 'minhas', count(*)::int FROM tarefas WHERE responsavel_id=$1 AND status IN ('pendente','andamento')
       UNION ALL SELECT 'atrasadas', count(*)::int FROM tarefas WHERE status IN ('pendente','andamento') AND prazo < $2`, [u.id, hoje]),
  ]);
  const n = Object.fromEntries(contagem.map((c) => [c.k, c.n]));
  return (
    <>
      <div className="head">
        <div><h1>Tarefas do clube</h1><p className="sub">O que foi passado nas reuniões e quem está cuidando</p></div>
      </div>
      <Mensagem sp={sp} />
      <div className="filtros-chips">
        {Object.entries(FILTROS).map(([k, v]) => (
          <Link key={k} href={`/tarefas?f=${k}`} className={`chip ${f === k ? "on" : ""}`}>
            {v}{n[k] != null ? ` (${n[k]})` : ""}
          </Link>
        ))}
      </div>
      <div className="card"><ListaTarefas tarefas={tarefas} u={u} usuarios={usuarios} mostrarReuniao /></div>
      {ehEquipe(u) && (
        <details className="card">
          <summary className="btn sec" style={{ display: "inline-block" }}>+ Nova tarefa (fora de reunião)</summary>
          <div style={{ marginTop: 12 }}><NovaTarefa usuarios={usuarios} /></div>
        </details>
      )}
    </>
  );
}
