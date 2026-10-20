/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirLogado } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import { data as fmtData } from "@/lib/formato";
import { lerReuniao, usuariosAtivos, STATUS_TAREFA } from "@/lib/reunioes";
import BotaoImprimir from "@/components/BotaoImprimir";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Ata da reunião pronta para imprimir / salvar em PDF e colher assinaturas */
export default async function AtaImpressao({ params }: { params: Promise<{ id: string }> }) {
  await exigirLogado();
  const { id } = await params;
  const r = await lerReuniao(Number(id) || 0);
  if (!r) notFound();
  const { ev, pauta, ata, decisoes, tarefas } = r;
  const cfg = await lerConfig();
  const usuarios = await usuariosAtivos();
  const ids = new Set(ata?.presentes ?? []);
  const presentes = usuarios.filter((p) => ids.has(p.id)).map((p) => p.nome);
  const convidados = (ata?.convidados ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const [y, m, d] = ev.data.split("-").map(Number);
  const extenso = `${d} de ${MESES[m - 1]} de ${y}`;
  const local = ev.na_sede ? ` na sede do ${cfg.clube_nome}${cfg.clube_endereco ? `, ${cfg.clube_endereco}` : ""},` : ev.local ? ` em ${ev.local},` : "";
  const assinantes = presentes.length ? presentes : ["", "", "", ""];

  return (
    <div className="termo-pagina">
      <div className="termo-barra">
        <BotaoImprimir />
        <Link className="btn sec" href={`/reunioes/${ev.id}`}>Voltar</Link>
        <span className="dica">{ata?.aprovada ? "Ata finalizada." : "Atenção: a ata ainda está como rascunho."}</span>
      </div>
      <div className="termo">
        <div className="topo">
          <img src="/logo.png" alt="" />
          <div>
            <div className="clube">{cfg.clube_nome.toUpperCase()}</div>
            <div className="sub">{[cfg.clube_documento, cfg.clube_cidade].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="num">Ata nº R-{String(ev.id).padStart(4, "0")}<br />{fmtData(ev.data)}</div>
        </div>

        <h1>Ata da reunião — {ev.titulo}</h1>
        <p>
          Aos {extenso}, {ata?.hora_inicio ? `às ${ata.hora_inicio}` : ev.hora ? `às ${ev.hora}` : ""}, reuniram-se{local} os integrantes do {cfg.clube_nome} abaixo relacionados, para tratar dos assuntos da pauta a seguir.
        </p>

        <h3>Presentes</h3>
        <p>{[...presentes, ...convidados].join("; ") || "—"}{presentes.length ? ` (${presentes.length + convidados.length} pessoas)` : ""}.</p>

        <h3>Pauta</h3>
        {pauta.length ? <ol>{pauta.map((p) => <li key={p.id}>{p.titulo}{p.descricao ? ` — ${p.descricao}` : ""}</li>)}</ol> : <p>—</p>}

        <h3>Relato</h3>
        <p style={{ whiteSpace: "pre-wrap" }}>{ata?.texto || "—"}</p>

        <h3>Decisões</h3>
        {decisoes.length ? <ol>{decisoes.map((x) => <li key={x.id} style={{ whiteSpace: "pre-wrap" }}>{x.texto}</li>)}</ol> : <p>Nenhuma decisão registrada.</p>}

        <h3>Tarefas e responsáveis</h3>
        {tarefas.length ? (
          <table>
            <thead><tr><th>Tarefa</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
            <tbody>
              {tarefas.map((t) => (
                <tr key={t.id}><td>{t.titulo}</td><td>{t.responsavel ?? "—"}</td><td>{fmtData(t.prazo)}</td><td>{STATUS_TAREFA[t.status]}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p>Nenhuma tarefa passada.</p>}

        <p className="local">
          Nada mais havendo a tratar, a reunião foi encerrada{ata?.hora_fim ? ` às ${ata.hora_fim}` : ""}, e eu,
          {" "}{ata?.secretario ? <b>{ata.secretario}</b> : <span className="linha" />}, lavrei a presente ata, que vai assinada pelos presentes.
        </p>
        <p className="local">{cfg.clube_cidade}, {extenso}.</p>

        <div className="assinaturas">
          {assinantes.map((n, i) => (
            <div key={i} className="assinatura"><div className="traco" />{n || "Nome:"}</div>
          ))}
        </div>
        <div className="rodape">{cfg.clube_nome} · Ata gerada pelo sistema do clube</div>
      </div>
    </div>
  );
}
