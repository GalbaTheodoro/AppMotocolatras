import { exigirAdmin } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import Mensagem from "@/components/Mensagem";
import { lerConfigAvisos } from "@/lib/notificar";
import { salvarConfig, salvarAvisos, testarAvisos, descobrirChatsTelegram } from "./acoes";

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const c = await lerConfig();
  const av = await lerConfigAvisos();
  return (
    <>
      <div className="head"><div><h1>Configurações</h1><p className="sub">Regras de cobrança</p></div></div>
      <Mensagem sp={sp} />
      <form className="f card" action={salvarConfig}>
        <label>Valor da mensalidade por equipamento (R$)
          <input name="valor_mensalidade" type="number" step="0.01" min="0" defaultValue={c.valor_mensalidade.toFixed(2)} required />
        </label>
        <label>Meses grátis no início de cada empréstimo
          <input name="meses_gratis" type="number" min="0" step="1" defaultValue={c.meses_gratis} required />
        </label>
        <label>Dias de tolerância antes de considerar atrasada
          <input name="dias_tolerancia" type="number" min="0" step="1" defaultValue={c.dias_tolerancia} required />
        </label>
        <p className="full sub" style={{ fontSize: ".85rem" }}>
          Alterar o valor afeta apenas as mensalidades geradas daqui em diante. As já lançadas mantêm o valor original.
        </p>
        <h2 className="full" style={{ marginTop: 10, marginBottom: 0 }}>Dados do clube no termo de empréstimo</h2>
        <label>Nome do clube<input name="clube_nome" defaultValue={c.clube_nome} /></label>
        <label>CNPJ / CPF do responsável (opcional)<input name="clube_documento" defaultValue={c.clube_documento} /></label>
        <label>Endereço da sede<input name="clube_endereco" defaultValue={c.clube_endereco} /></label>
        <label>Cidade (local e foro)<input name="clube_cidade" defaultValue={c.clube_cidade} /></label>
        <label>Responsável que assina pelo clube<input name="clube_responsavel" defaultValue={c.clube_responsavel} placeholder="Nome do presidente / diretor" /></label>
        <label>Prazo para devolver quando solicitado (dias)
          <input name="termo_prazo_devolucao" type="number" min="0" step="1" defaultValue={c.termo_prazo_devolucao} />
        </label>
        <label className="full">Cláusulas extras (opcional — uma por linha, entram no fim do termo)
          <textarea name="termo_clausulas_extras" defaultValue={c.termo_clausulas_extras} placeholder="Ex.: O equipamento deve ser usado apenas em eventos e passeios do clube." />
        </label>
        <div className="full"><button className="btn" type="submit">Salvar</button></div>
      </form>

      <div className="card" id="avisos">
        <h2>Avisos de novas solicitações (grátis)</h2>
        <p className="sub" style={{ marginTop: -4 }}>
          Toda vez que alguém enviar uma solicitação, o sistema manda uma mensagem com nome, telefone, itens e o link para analisar.
          Pode usar WhatsApp, Telegram ou os dois.
        </p>
        <form action={salvarAvisos} className="f">
          <div className="full" style={{ background: "#f7fbf7", border: "1px solid #cfe8d4", borderRadius: 8, padding: 12 }}>
            <b>WhatsApp (CallMeBot)</b> — cada pessoa que vai receber faz uma vez, no próprio celular:
            <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: ".9rem" }}>
              <li>Salve o contato do CallMeBot (número em <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">callmebot.com</a>).</li>
              <li>Mande para ele no WhatsApp: <code>I allow callmebot to send me messages</code></li>
              <li>Ele responde com a sua <b>apikey</b>. Coloque abaixo: <code>número com DDI | apikey</code></li>
            </ol>
          </div>
          <label className="full">Quem recebe no WhatsApp (um por linha: telefone | apikey)
            <textarea name="aviso_whatsapp" defaultValue={av.whatsapp.map((w) => `${w.telefone} | ${w.apikey}`).join("\n")}
              placeholder={"5534999998888 | 1234567\n5534988887777 | 7654321"} />
          </label>
          <div className="full" style={{ background: "#f3f7fd", border: "1px solid #cfdcef", borderRadius: 8, padding: 12 }}>
            <b>Telegram</b> (opcional, mais estável):
            <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: ".9rem" }}>
              <li>No Telegram, fale com <b>@BotFather</b>, envie <code>/newbot</code> e copie o <b>token</b>.</li>
              <li>Cada pessoa manda um “oi” para o bot criado (ou adicione o bot num grupo da diretoria).</li>
              <li>Salve o token e clique em <b>Descobrir chat id</b>; copie os números para o campo Chat ID.</li>
            </ol>
          </div>
          <label>Token do bot do Telegram<input name="aviso_telegram_token" defaultValue={av.telegramToken} placeholder="123456:ABC-..." autoComplete="off" /></label>
          <label>Chat ID (um ou mais, separados por vírgula)<input name="aviso_telegram_chats" defaultValue={av.telegramChats.join(", ")} placeholder="123456789, -100987654321" /></label>
          <div className="full acoes">
            <button className="btn" type="submit">Salvar avisos</button>
            <button className="btn sec" type="submit" formAction={testarAvisos} formNoValidate>Enviar mensagem de teste</button>
            <button className="btn sec" type="submit" formAction={descobrirChatsTelegram} formNoValidate>Descobrir chat id (Telegram)</button>
          </div>
          <p className="full sub" style={{ fontSize: ".82rem", margin: 0 }}>
            O teste usa os dados já salvos — salve antes de testar. Se o aviso falhar, a solicitação é registrada normalmente.
          </p>
        </form>
      </div>
    </>
  );
}
