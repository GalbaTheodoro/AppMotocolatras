import Link from "next/link";
import { data, moeda, hojeISO, SITUACAO_MENS } from "@/lib/formato";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { pagar, estornar, cancelar } from "./acoes";

type Linha = {
  id: number; competencia_inicio: string; competencia_fim: string; vencimento: string; valor: number;
  situacao: string; quantidade?: number; pago_em: string | null; forma_pagamento: string | null;
  pessoa?: string; equipamento?: string; emprestimo_id: number;
};

export default function TabelaMensalidades({
  linhas, volta, admin, mostrarPessoa = true,
}: { linhas: Linha[]; volta: string; admin: boolean; mostrarPessoa?: boolean }) {
  if (linhas.length === 0) return <div className="tbl"><div className="vazio">Nenhuma mensalidade.</div></div>;
  return (
    <div className="tbl">
      <table>
        <thead>
          <tr>
            {mostrarPessoa && <><th>Pessoa</th><th>Equipamento</th></>}
            <th>Competência</th><th>Vencimento</th><th className="r">Valor</th><th>Situação</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((m) => (
            <tr key={m.id}>
              {mostrarPessoa && <><td>{m.pessoa}</td><td><Link href={`/emprestimos/${m.emprestimo_id}`}>{m.equipamento}</Link></td></>}
              <td>{data(m.competencia_inicio)} a {data(m.competencia_fim)}</td>
              <td>{data(m.vencimento)}</td>
              <td className="r">{moeda(m.valor)}{(m.quantidade ?? 1) > 1 && <div className="sub" style={{ fontSize: ".75rem" }}>{m.quantidade} unidades</div>}</td>
              <td>
                <Tag tipo={m.situacao}>{SITUACAO_MENS[m.situacao]}</Tag>
                {m.situacao === "pago" && <div className="sub" style={{ fontSize: ".78rem" }}>em {data(m.pago_em)}{m.forma_pagamento ? ` · ${m.forma_pagamento}` : ""}</div>}
              </td>
              <td>
                {(m.situacao === "pendente" || m.situacao === "atrasado") && (
                  <div className="acoes">
                    <form action={pagar} className="acoes">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="volta" value={volta} />
                      <input type="date" name="pago_em" defaultValue={hojeISO()} style={{ padding: "4px 6px" }} />
                      <select name="forma_pagamento" defaultValue="Pix" style={{ padding: "4px 6px" }}>
                        <option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option>
                      </select>
                      <button className="btn ok peq" type="submit">Receber</button>
                    </form>
                    {admin && (
                      <form action={cancelar}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="volta" value={volta} />
                        <BotaoConfirmar mensagem="Cancelar (isentar) esta mensalidade?" className="btn sec peq">Isentar</BotaoConfirmar>
                      </form>
                    )}
                  </div>
                )}
                {m.situacao === "pago" && (
                  <form action={estornar}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="volta" value={volta} />
                    <BotaoConfirmar mensagem="Desfazer o recebimento desta mensalidade?" className="btn sec peq">Desfazer</BotaoConfirmar>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
