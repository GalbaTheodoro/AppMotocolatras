import { exigirAdmin } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import Mensagem from "@/components/Mensagem";
import { lerConfigAvisos } from "@/lib/notificar";
import { salvarConfig, salvarAvisos, testarAvisos, descobrirChatsTelegram, salvarIA } from "./acoes";
import { configIA, PROVEDORES } from "@/lib/ia";

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const c = await lerConfig();
  const av = await lerConfigAvisos();
  const ia = await configIA();
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

      <div className="card" id="ia">
        <h2>Inteligência artificial nas atas</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          Transcreve o áudio das reuniões e gera o resumo, as decisões e as tarefas da ata.
          Em uso: <b>{PROVEDORES[ia.provedor].nome}</b> — {ia.chave
            ? <b style={{ color: "var(--ok)" }}>configurado{ia.provedor === "gemini" ? (ia.gemini.daVariavel ? " (variável GEMINI_API_KEY)" : ` (chave …${ia.gemini.chave.slice(-4)})`) : (ia.grok.daVariavel ? " (variável XAI_API_KEY)" : ` (chave …${ia.grok.chave.slice(-4)})`)}</b>
            : <b style={{ color: "var(--warn)" }}>falta a chave</b>}.
        </p>
        <form action={salvarIA} className="f">
          <label className="full">Usar
            <select name="ia_provedor" defaultValue={ia.provedor}>
              <option value="gemini">{PROVEDORES.gemini.nome}</option>
              <option value="grok">{PROVEDORES.grok.nome}</option>
            </select>
          </label>

          <div className="full ia-bloco">
            <b>Google Gemini — grátis</b>
            <ol className="sub" style={{ fontSize: ".85rem", margin: "6px 0" }}>
              <li>Abra <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> e entre com uma conta Google (pode ser a do clube).</li>
              <li>Clique em <b>Create API key</b> (Criar chave de API) e copie a chave (começa com <code>AQ.</code> nas chaves novas, ou <code>AIza</code> nas antigas — as duas servem).</li>
              <li>Cole abaixo e clique em <b>Salvar e testar</b>. Não precisa cadastrar cartão.</li>
            </ol>
            <p className="sub" style={{ fontSize: ".78rem", margin: "0 0 6px" }}>
              No plano gratuito o Google pode usar o conteúdo enviado para melhorar os produtos dele, e há limite de uso por minuto/dia (suficiente para as reuniões do clube).
            </p>
            <div className="f">
              <label>Chave do Gemini<input name="gemini_api_key" type="password" autoComplete="off" placeholder={ia.gemini.chave ? "•••••••• (vazio = manter)" : "AQ.... ou AIza..."} /></label>
              <label>Modelo<input name="gemini_modelo" defaultValue={ia.gemini.modelo} placeholder={PROVEDORES.gemini.modelo} /></label>
            </div>
          </div>

          <details className="full ia-bloco">
            <summary><b>Grok (xAI) — pago</b> <span className="sub">(opcional)</span></summary>
            <p className="sub" style={{ fontSize: ".85rem" }}>
              Crie a chave em <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a> (API Keys) e coloque créditos em Billing. Cobrado por uso.
            </p>
            <div className="f">
              <label>Chave do Grok<input name="xai_api_key" type="password" autoComplete="off" placeholder={ia.grok.chave ? "•••••••• (vazio = manter)" : "xai-..."} /></label>
              <label>Modelo<input name="xai_modelo" defaultValue={ia.grok.modelo} placeholder={PROVEDORES.grok.modelo} /></label>
            </div>
          </details>

          <div className="full acoes"><button className="btn" type="submit">Salvar e testar</button></div>
        </form>
        <div className="acoes" style={{ marginTop: 8 }}>
          {ia.gemini.chave && !ia.gemini.daVariavel && (
            <form action={salvarIA}><input type="hidden" name="remover" value="gemini" /><button className="btn sec peq" type="submit">Remover chave do Gemini</button></form>
          )}
          {ia.grok.chave && !ia.grok.daVariavel && (
            <form action={salvarIA}><input type="hidden" name="remover" value="grok" /><button className="btn sec peq" type="submit">Remover chave do Grok</button></form>
          )}
        </div>
      </div>

      <div className="card" id="avisos">
        <h2>Avisos de novas solicitações (grátis)</h2>
        <p className="sub" style={{ marginTop: -4 }}>
          Toda vez que alguém enviar uma solicitação, o sistema manda uma mensagem com nome, telefone, itens e o link para analisar.
          Pode usar WhatsApp, Telegram ou mais de um ao mesmo tempo.
        </p>
        <form action={salvarAvisos} className="f">
          <div className="full" style={{ background: "#f7fbf7", border: "1px solid #cfe8d4", borderRadius: 8, padding: 12 }}>
            <b>WhatsApp pelo TextMeBot</b> (recomendado para WhatsApp — teste grátis de 2 dias, depois a partir de US$ 1/mês):
            <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: ".9rem" }}>
              <li>Entre em <a href="https://textmebot.com" target="_blank" rel="noreferrer">textmebot.com</a>, peça a <b>ApiKey</b> com seu e-mail.</li>
              <li>Pelo link do e-mail, cadastre e conecte o WhatsApp que vai <b>enviar</b> os avisos (um número do clube ou o seu).</li>
              <li>Cole a ApiKey abaixo e os números que vão <b>receber</b> (com DDI 55 e DDD).</li>
            </ol>
          </div>
          <label>ApiKey do TextMeBot<input name="aviso_textmebot_key" defaultValue={av.textmebotKey} autoComplete="off" /></label>
          <label>Números que recebem (um por linha)
            <textarea name="aviso_textmebot_numeros" defaultValue={av.textmebotNumeros.join("\n")} placeholder={"5534999998888\n5534988887777"} style={{ minHeight: 60 }} />
          </label>
          <div className="full" style={{ background: "#fafaf7", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <b>WhatsApp pelo CallMeBot</b> (gratuito, mas no momento <b>sem vagas</b> para novos números). Quando abrir vaga:
            salve o número indicado em <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">callmebot.com</a>,
            mande <code>I allow callmebot to send me messages</code> e coloque abaixo <code>telefone | apikey</code>.
          </div>
          <label className="full">CallMeBot — um por linha (telefone | apikey)
            <textarea name="aviso_whatsapp" defaultValue={av.whatsapp.map((w) => `${w.telefone} | ${w.apikey}`).join("\n")}
              placeholder="5534999998888 | 1234567" style={{ minHeight: 60 }} />
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
