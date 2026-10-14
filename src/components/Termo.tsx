/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Config } from "@/lib/config";
import { data, moeda, formatarCPF } from "@/lib/formato";
import BotaoImprimir from "./BotaoImprimir";

export type DadosTermo = {
  numero: string; // protocolo ou nº do empréstimo
  voltar: string;
  pessoa: { nome: string; cpf: string | null; telefone: string | null; email: string | null; endereco: string | null };
  itens: { nome: string; codigo: string | null; categoria: string | null; quantidade: number; data_inicio: string }[];
  dataInicio: string;
};

function porExtenso(n: number) {
  const nomes = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze"];
  return nomes[n] ?? String(n);
}

function addMeses(iso: string, meses: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, ultimo));
  return dt.toISOString().slice(0, 10);
}

export default function Termo({ d, cfg }: { d: DadosTermo; cfg: Config }) {
  const totalUn = d.itens.reduce((s, i) => s + i.quantidade, 0);
  const inicioCobranca = addMeses(d.dataInicio, cfg.meses_gratis);
  const mensal = totalUn * cfg.valor_mensalidade;
  const extras = cfg.termo_clausulas_extras.split("\n").map((l) => l.trim()).filter(Boolean);
  const cidade = cfg.clube_cidade || "________________";
  const clube = cfg.clube_nome || "Motocólatras MC";
  let n = 0;
  const c = () => ++n;

  return (
    <div className="termo-pagina">
      <div className="termo-barra">
        <BotaoImprimir />
        <Link className="btn sec" href={d.voltar}>Voltar</Link>
        <span className="dica">Na janela de impressão, escolha <b>“Salvar como PDF”</b> para gerar o arquivo.</span>
      </div>

      <div className="termo">
        <div className="topo">
          <img src="/logo.png" alt="" />
          <div>
            <div className="clube">{clube.toUpperCase()}</div>
            <div className="sub">
              {[cfg.clube_documento && `CNPJ/CPF ${cfg.clube_documento}`, cfg.clube_endereco, cfg.clube_cidade].filter(Boolean).join(" · ") || "Viciados em duas rodas"}
            </div>
          </div>
          <div className="num">Termo nº <b>{d.numero}</b><br />Emitido em {data(new Date())}</div>
        </div>

        <h1>Termo de Empréstimo de Equipamentos, Responsabilidade e Ciência das Condições</h1>

        <p>
          Pelo presente termo, <b>{clube}</b>, doravante <b>CLUBE</b>, empresta ao(à) <b>COMODATÁRIO(A)</b> abaixo
          identificado(a) os equipamentos relacionados, nas condições a seguir, que as partes declaram ter lido e aceitado.
        </p>

        <h3>1. Dados do(a) comodatário(a)</h3>
        <table className="dados">
          <tbody>
            <tr><td>Nome</td><td>{d.pessoa.nome}</td></tr>
            <tr><td>CPF</td><td>{d.pessoa.cpf ? formatarCPF(d.pessoa.cpf) : <span className="linha" />}</td></tr>
            <tr><td>Telefone</td><td>{d.pessoa.telefone ?? <span className="linha" />}</td></tr>
            <tr><td>E-mail</td><td>{d.pessoa.email ?? <span className="linha" />}</td></tr>
            <tr><td>Endereço</td><td>{d.pessoa.endereco ?? <span className="linha" style={{ minWidth: 320 }} />}</td></tr>
          </tbody>
        </table>

        <h3>2. Equipamentos emprestados</h3>
        <table>
          <thead>
            <tr><th>Equipamento</th><th>Código</th><th style={{ width: 50 }}>Qtd.</th><th style={{ width: 80 }}>Início</th><th style={{ width: 170 }}>Estado na entrega</th></tr>
          </thead>
          <tbody>
            {d.itens.map((i, k) => (
              <tr key={k}>
                <td>{i.nome}{i.categoria ? ` (${i.categoria})` : ""}</td>
                <td>{i.codigo ?? "—"}</td>
                <td style={{ textAlign: "center" }}>{i.quantidade}</td>
                <td>{data(i.data_inicio)}</td>
                <td><span className="caixa-check" />Bom <span className="caixa-check" style={{ marginLeft: 8 }} />Com avarias*</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: "8.5pt" }}>* Avarias observadas na entrega: <span className="linha" style={{ minWidth: "70%" }} /></p>

        <h3>3. Condições financeiras</h3>
        <ol>
          <li value={c()}>
            Os primeiros <b>{cfg.meses_gratis} ({porExtenso(cfg.meses_gratis)}) meses</b> de empréstimo são gratuitos, contados a partir de <b>{data(d.dataInicio)}</b>.
          </li>
          <li value={c()}>
            A partir de <b>{data(inicioCobranca)}</b>, será devida mensalidade de <b>{moeda(cfg.valor_mensalidade)} por unidade</b> emprestada,
            totalizando hoje <b>{moeda(mensal)} por mês</b> ({totalUn} unidade{totalUn > 1 ? "s" : ""}), com vencimento todo dia {Number(inicioCobranca.slice(8))} de cada mês.
          </li>
          <li value={c()}>
            O pagamento em atraso por mais de {cfg.dias_tolerancia} dias caracteriza inadimplência. Persistindo o atraso, o CLUBE poderá
            solicitar a devolução imediata dos equipamentos, sem prejuízo da cobrança dos valores devidos.
          </li>
          <li value={c()}>Em caso de devolução parcial, a mensalidade passa a ser calculada sobre a quantidade que permanecer com o(a) comodatário(a).</li>
        </ol>

        <h3>4. Estado de conservação e cuidados</h3>
        <ol>
          <li value={c()}>O(A) comodatário(a) declara ter recebido os equipamentos <b>em boas condições de uso, conservação e funcionamento</b>, conforme conferido no ato da entrega, salvo avarias anotadas acima.</li>
          <li value={c()}>Compromete-se a utilizar os equipamentos com zelo, somente para a finalidade a que se destinam, seguindo as orientações de uso e de segurança do fabricante.</li>
          <li value={c()}>É de uso <b>pessoal e intransferível</b>: é proibido emprestar, alugar, vender, ceder ou dar em garantia os equipamentos a terceiros.</li>
          <li value={c()}>Deve mantê-los limpos, guardados em local seguro, protegidos de umidade, calor excessivo e produtos que possam danificá-los, e não realizar modificações, pinturas ou reparos sem autorização do CLUBE.</li>
        </ol>

        <h3>5. Danos, perda, furto ou roubo</h3>
        <ol>
          <li value={c()}>Qualquer dano, defeito, perda, furto ou roubo deve ser comunicado ao CLUBE em até <b>48 horas</b>. Em caso de furto ou roubo, deve ser apresentado o Boletim de Ocorrência.</li>
          <li value={c()}>O(A) comodatário(a) é responsável pelos danos causados por mau uso, negligência ou descuido e pela perda ou extravio, devendo arcar com o <b>conserto ou a reposição por equipamento equivalente</b> (ou o valor de mercado correspondente).</li>
          <li value={c()}>O desgaste natural decorrente do uso normal não gera obrigação de indenizar.</li>
        </ol>

        <h3>6. Devolução</h3>
        <ol>
          <li value={c()}>Os equipamentos devem ser devolvidos <b>no mesmo estado em que foram recebidos</b>, ressalvado o desgaste natural, limpos e com todos os acessórios.</li>
          <li value={c()}>O CLUBE poderá solicitar a devolução a qualquer tempo, devendo o(a) comodatário(a) devolvê-los em até <b>{cfg.termo_prazo_devolucao} dias</b> após o aviso. O(A) comodatário(a) também pode devolvê-los quando desejar, encerrando a cobrança a partir do mês seguinte à devolução.</li>
          <li value={c()}>Na devolução, os equipamentos serão vistoriados; eventuais danos serão registrados e cobrados conforme o item 5.</li>
        </ol>

        <h3>7. Dados pessoais</h3>
        <ol>
          <li value={c()}>O(A) comodatário(a) autoriza o CLUBE a guardar seus dados e documentos (inclusive fotos enviadas) exclusivamente para controle deste empréstimo, cobrança e contato, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</li>
        </ol>

        {extras.length > 0 && (
          <>
            <h3>8. Disposições adicionais</h3>
            <ol>{extras.map((t, k) => <li key={k} value={c()}>{t}</li>)}</ol>
          </>
        )}

        <h3>{extras.length > 0 ? "9" : "8"}. Declaração</h3>
        <p>
          Declaro que li e compreendi todas as cláusulas deste termo, que recebi os equipamentos acima nas condições descritas e
          que estou ciente das minhas responsabilidades e das condições de cobrança. Fica eleito o foro da comarca de {cidade} para
          dirimir quaisquer questões oriundas deste termo.
        </p>

        <p className="local">{cidade}, ______ de ______________________ de ________.</p>

        <div className="assinaturas">
          <div className="assinatura">
            <div className="traco" />
            <b>{d.pessoa.nome}</b><br />Comodatário(a) · CPF {d.pessoa.cpf ? formatarCPF(d.pessoa.cpf) : "_______________"}
          </div>
          <div className="assinatura">
            <div className="traco" />
            <b>{cfg.clube_responsavel || "Responsável"}</b><br />pelo {clube}
          </div>
          <div className="assinatura">
            <div className="traco" />
            Testemunha 1 — Nome / CPF
          </div>
          <div className="assinatura">
            <div className="traco" />
            Testemunha 2 — Nome / CPF
          </div>
        </div>

        <div className="rodape">{clube} · Termo nº {d.numero} · Documento gerado pelo sistema de controle de empréstimos</div>
      </div>
    </div>
  );
}
