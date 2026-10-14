import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { data, soDigitos, STATUS_SOLIC } from "@/lib/formato";
import CabecaPublica from "@/components/CabecaPublica";
import Tag from "@/components/Tag";
import { consultarSolicitacao } from "../solicitar/acoes";

export const dynamic = "force-dynamic";

export default async function Acompanhar({ searchParams }: { searchParams: Promise<{ p?: string; c?: string }> }) {
  const sp = await searchParams;
  const protocolo = (sp.p ?? "").toUpperCase();
  const cpf = soDigitos(sp.c);
  let s: Record<string, any> | null = null;
  let itens: Record<string, any>[] = [];
  const consultou = !!(protocolo && cpf);
  if (consultou) {
    s = await queryOne(
      "SELECT * FROM solicitacoes WHERE protocolo=$1 AND regexp_replace(cpf,'\\D','','g')=$2", [protocolo, cpf]);
    if (s) {
      itens = await query(
        `SELECT i.*, q.nome FROM solicitacao_itens i JOIN equipamentos q ON q.id=i.equipamento_id
          WHERE i.solicitacao_id=$1 ORDER BY q.nome`, [s.id]);
    }
  }
  return (
    <div className="publico">
      <div className="caixa">
        <CabecaPublica titulo="Acompanhar solicitação" />
        <div className="card">
          <form action={consultarSolicitacao} className="acoes" style={{ alignItems: "flex-end" }}>
            <label>Protocolo<input name="protocolo" defaultValue={protocolo} required style={{ textTransform: "uppercase" }} /></label>
            <label>CPF<input name="cpf" inputMode="numeric" defaultValue={sp.c ?? ""} required /></label>
            <button className="btn" type="submit">Consultar</button>
          </form>
        </div>
        {consultou && !s && <div className="msg erro">Solicitação não encontrada. Confira o protocolo e o CPF.</div>}
        {s && (
          <div className="card">
            <h2>Protocolo {s.protocolo}</h2>
            <dl className="info">
              <dt>Situação</dt><dd><Tag tipo={s.status === "pendente" ? "pendente" : s.status}>{STATUS_SOLIC[s.status]}</Tag></dd>
              <dt>Enviada em</dt><dd>{data(s.criado_em)}</dd>
              <dt>Nome</dt><dd>{s.nome}</dd>
              {s.resposta && (<><dt>Mensagem da equipe</dt><dd>{s.resposta}</dd></>)}
            </dl>
            <h2 style={{ marginTop: 18 }}>Itens</h2>
            <table>
              <thead><tr><th>Equipamento</th><th className="r">Pedido</th>{s.status === "aprovada" && <th className="r">Aprovado</th>}</tr></thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nome}</td><td className="r">{i.quantidade}</td>
                    {s.status === "aprovada" && <td className="r">{i.quantidade_aprovada ?? 0}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="rodape"><Link href="/solicitar">Fazer uma nova solicitação</Link></div>
      </div>
    </div>
  );
}
