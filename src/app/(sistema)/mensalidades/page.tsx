import { query, queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import { gerarMensalidades, situacaoSql } from "@/lib/cobranca";
import { moeda } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import TabelaMensalidades from "./TabelaMensalidades";

export default async function Mensalidades({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filtro = sp.s ?? "abertas";
  const busca = sp.q?.trim() ?? "";
  const mes = sp.mes ?? ""; // YYYY-MM (vencimento)
  await gerarMensalidades();
  const cfg = await lerConfig();
  const u = await usuarioAtual();
  const sit = situacaoSql("m", cfg.dias_tolerancia);
  const where = `
      WHERE ($1='todas' OR ($1='abertas' AND m.status='pendente') OR ${sit} = $1)
        AND ($2='' OR p.nome ILIKE '%'||$2||'%' OR q.nome ILIKE '%'||$2||'%')
        AND ($3='' OR to_char(m.vencimento,'YYYY-MM') = $3)`;
  const from = `FROM mensalidades m JOIN emprestimos e ON e.id=m.emprestimo_id
       JOIN pessoas p ON p.id=e.pessoa_id JOIN equipamentos q ON q.id=e.equipamento_id`;
  const linhas = await query(
    `SELECT m.*, ${sit} situacao, p.nome pessoa, q.nome equipamento ${from} ${where}
      ORDER BY m.vencimento DESC, p.nome LIMIT 500`,
    [filtro, busca, mes]
  );
  const tot = await queryOne<{ n: number; v: number }>(
    `SELECT count(*)::int n, coalesce(sum(m.valor),0) v ${from} ${where}`, [filtro, busca, mes]);
  return (
    <>
      <div className="head">
        <div>
          <h1>Mensalidades</h1>
          <p className="sub">{tot?.n} mensalidade(s) · total {moeda(tot?.v)} · atrasada após {cfg.dias_tolerancia} dias do vencimento</p>
        </div>
      </div>
      <Mensagem sp={sp} />
      <form className="filtros">
        <input name="q" placeholder="Buscar pessoa ou equipamento" defaultValue={busca} />
        <select name="s" defaultValue={filtro}>
          <option value="abertas">Em aberto (pendentes + atrasadas)</option>
          <option value="atrasado">Somente atrasadas</option>
          <option value="pago">Pagas</option>
          <option value="cancelado">Canceladas</option>
          <option value="todas">Todas</option>
        </select>
        <label style={{ fontWeight: 400 }}>Mês de vencimento<input type="month" name="mes" defaultValue={mes} /></label>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>
      <TabelaMensalidades linhas={linhas as never} volta="/mensalidades" admin={u?.papel === "admin"} />
    </>
  );
}
