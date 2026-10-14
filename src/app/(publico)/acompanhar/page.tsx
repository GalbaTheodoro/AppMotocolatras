import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { data, soDigitos, STATUS_SOLIC } from "@/lib/formato";
import CabecaPublica from "@/components/CabecaPublica";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import { consultarSolicitacao } from "../solicitar/acoes";

export const dynamic = "force-dynamic";

/** Na consulta pública mostramos só o primeiro nome, para não expor dados pessoais */
function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0];
}

function cpfMascarado(cpf: string) {
  const d = soDigitos(cpf);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "";
}

const CPF_SQL = "regexp_replace(s.cpf,'\\D','','g')";

export default async function Acompanhar({ searchParams }: { searchParams: Promise<{ p?: string; c?: string; erro?: string }> }) {
  const sp = await searchParams;
  const protocolo = (sp.p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cpf = soDigitos(sp.c);
  const buscou = !!(protocolo || cpf);

  // Detalhe de um protocolo (com ou sem CPF; se vier CPF, ele precisa bater)
  let s: Record<string, any> | null = null;
  let itens: Record<string, any>[] = [];
  if (protocolo) {
    s = await queryOne(
      `SELECT s.* FROM solicitacoes s WHERE s.protocolo=$1 AND ($2 = '' OR ${CPF_SQL} = $2)`, [protocolo, cpf]);
    if (s) {
      itens = await query(
        `SELECT i.*, q.nome FROM solicitacao_itens i JOIN equipamentos q ON q.id=i.equipamento_id
          WHERE i.solicitacao_id=$1 ORDER BY q.nome`, [s.id]);
    }
  }

  // Histórico pelo CPF
  let historico: Record<string, any>[] = [];
  if (cpf) {
    historico = await query(
      `SELECT s.id, s.protocolo, s.status, s.criado_em, s.nome, s.cpf,
              (SELECT string_agg(q.nome || ' × ' || i.quantidade, ', ' ORDER BY q.nome)
                 FROM solicitacao_itens i JOIN equipamentos q ON q.id=i.equipamento_id WHERE i.solicitacao_id=s.id) itens
         FROM solicitacoes s WHERE ${CPF_SQL} = $1 ORDER BY s.criado_em DESC LIMIT 50`, [cpf]);
  }

  const nada = buscou && !s && historico.length === 0;
  const aprovada = s?.status === "aprovada";

  return (
    <div className="publico">
      <div className="caixa">
        <CabecaPublica titulo="Acompanhar solicitação" />
        <Mensagem sp={sp} />
        <div className="card">
          <p className="sub" style={{ marginTop: 0 }}>
            Pesquise pelo <b>protocolo</b>, pelo <b>CPF</b> ou pelos dois. Pelo CPF aparece o histórico de todas as suas solicitações.
          </p>
          <form action={consultarSolicitacao} className="acoes" style={{ alignItems: "flex-end" }}>
            <label>Protocolo<input name="protocolo" defaultValue={protocolo} placeholder="Ex.: L6PAYE" style={{ textTransform: "uppercase" }} /></label>
            <label>CPF<input name="cpf" inputMode="numeric" defaultValue={sp.c ?? ""} placeholder="000.000.000-00" /></label>
            <button className="btn" type="submit">Consultar</button>
          </form>
        </div>

        {nada && (
          <div className="msg erro">
            {protocolo && cpf ? "Nenhuma solicitação encontrada com este protocolo e CPF."
              : protocolo ? "Protocolo não encontrado. Confira as letras e números."
              : "Nenhuma solicitação encontrada para este CPF."}
          </div>
        )}
        {protocolo && cpf && !s && historico.length > 0 && (
          <div className="msg erro">O protocolo {protocolo} não pertence a este CPF. Veja abaixo as solicitações deste CPF.</div>
        )}

        {s && (
          <div className="card">
            <h2>Protocolo {s.protocolo}</h2>
            <dl className="info">
              <dt>Situação</dt><dd><Tag tipo={s.status}>{STATUS_SOLIC[s.status]}</Tag></dd>
              <dt>Enviada em</dt><dd>{data(s.criado_em)}</dd>
              <dt>Solicitante</dt><dd>{primeiroNome(s.nome)} · CPF {cpfMascarado(s.cpf)}</dd>
              {s.analisado_em && (<><dt>Analisada em</dt><dd>{data(s.analisado_em)}</dd></>)}
              {s.resposta && (<><dt>Mensagem da equipe</dt><dd>{s.resposta}</dd></>)}
            </dl>
            <h2 style={{ marginTop: 18 }}>Itens</h2>
            <table>
              <thead><tr><th>Equipamento</th><th className="r">Pedido</th>{aprovada && <th className="r">Aprovado</th>}</tr></thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nome}</td><td className="r">{i.quantidade}</td>
                    {aprovada && <td className="r">{i.quantidade_aprovada ?? 0}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {historico.length > 0 && (
          <div className="card">
            <h2>Histórico de solicitações</h2>
            <p className="sub" style={{ marginTop: -6 }}>
              {primeiroNome(historico[0].nome)} · CPF {cpfMascarado(historico[0].cpf)} · {historico.length} solicitação(ões)
            </p>
            <div className="tbl" style={{ marginBottom: 0 }}>
              <table>
                <thead><tr><th>Protocolo</th><th>Data</th><th>Itens</th><th>Situação</th><th></th></tr></thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id} style={h.protocolo === s?.protocolo ? { background: "#fdf8c8" } : undefined}>
                      <td><b>{h.protocolo}</b></td>
                      <td>{data(h.criado_em)}</td>
                      <td>{h.itens}</td>
                      <td><Tag tipo={h.status}>{STATUS_SOLIC[h.status]}</Tag></td>
                      <td className="r">
                        <Link className="btn sec peq" href={`/acompanhar?p=${h.protocolo}&c=${cpf}`}>Ver detalhes</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rodape"><Link href="/solicitar">Fazer uma nova solicitação</Link> · <Link href="/login">Início</Link></div>
      </div>
    </div>
  );
}
