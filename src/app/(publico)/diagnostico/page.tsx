import pg from "pg";
import { configConexao } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Item = { ok: boolean; titulo: string; detalhe: string };

function explicarErro(e: unknown): string {
  const err = e as { message?: string; code?: string };
  const m = err?.message ?? String(e);
  if (/password authentication failed|28P01/i.test(m + err?.code))
    return "Senha do banco incorreta. Confira a senha no lugar de [YOUR-PASSWORD] (sem os colchetes).";
  if (/Tenant or user not found/i.test(m))
    return "Usuário do pooler incorreto. No Supabase o usuário é 'postgres.SEU_ID_DO_PROJETO' — copie o endereço completo em Connect > Transaction pooler.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(m))
    return "Endereço do servidor não encontrado. Confira o host na DATABASE_URL.";
  if (/ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|ETIMEDOUT|timeout/i.test(m))
    return "Não foi possível alcançar o banco. Se você usou a conexão 'Direct connection' (db.xxx.supabase.co:5432), troque pela 'Transaction pooler' (porta 6543) — a direta não funciona na Vercel.";
  if (/Invalid URL|invalid connection|ERR_INVALID_URL/i.test(m))
    return "A DATABASE_URL está mal formatada. Se a senha tiver caracteres especiais (@ # / ? % :), troque a senha do banco no Supabase por uma só com letras e números.";
  return m;
}

export default async function Diagnostico() {
  const itens: Item[] = [];
  const url = process.env.DATABASE_URL;
  const secret = process.env.AUTH_SECRET;

  itens.push({
    ok: !!url,
    titulo: "Variável DATABASE_URL",
    detalhe: url ? "Configurada." : "NÃO configurada. Na Vercel: Settings > Environment Variables > adicione DATABASE_URL e faça Redeploy.",
  });
  if (url) {
    let resumo = "";
    try {
      const u = new URL(url.trim().replace(/^["']|["']$/g, ""));
      resumo = `servidor ${u.hostname}, porta ${u.port || "5432"}, usuário ${decodeURIComponent(u.username)}, banco ${u.pathname.slice(1)}`;
      if (url.includes("[YOUR-PASSWORD]") || url.includes("YOUR-PASSWORD"))
        itens.push({ ok: false, titulo: "Senha na DATABASE_URL", detalhe: "Ainda contém [YOUR-PASSWORD]. Troque pela senha real do banco (sem colchetes)." });
      if (u.hostname.startsWith("db.") && u.hostname.endsWith("supabase.co"))
        itens.push({ ok: false, titulo: "Tipo de conexão", detalhe: "Você está usando a 'Direct connection'. Na Vercel use a 'Transaction pooler' (…pooler.supabase.com:6543)." });
    } catch {
      resumo = "não foi possível ler o endereço (senha com caracteres especiais?)";
    }
    itens.push({ ok: true, titulo: "Endereço do banco", detalhe: resumo });
  }
  itens.push({
    ok: !!secret && secret.length >= 16,
    titulo: "Variável AUTH_SECRET",
    detalhe: !secret ? "NÃO configurada. Adicione AUTH_SECRET (frase com 16+ caracteres) e faça Redeploy."
      : secret.length < 16 ? `Muito curta (${secret.length} caracteres). Use pelo menos 16.` : "Configurada.",
  });

  let temUsuarios = false;
  if (url) {
    const client = new pg.Client(configConexao(url));
    try {
      await client.connect();
      itens.push({ ok: true, titulo: "Conexão com o banco", detalhe: "Conectou com sucesso." });
      const r = await client.query(
        `SELECT t FROM unnest(ARRAY['usuarios','pessoas','equipamentos','emprestimos','mensalidades','configuracoes','devolucoes','solicitacoes','solicitacao_itens']) t
          WHERE to_regclass('public.'||t) IS NULL`);
      const faltando = r.rows.map((x) => x.t);
      itens.push({
        ok: faltando.length === 0,
        titulo: "Tabelas do sistema",
        detalhe: faltando.length === 0 ? "Todas criadas."
          : `Faltando: ${faltando.join(", ")}. Rode o arquivo db/schema.sql no SQL Editor do Supabase (pode rodar de novo, não apaga dados).`,
      });
      if (faltando.length === 0) {
        const col = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_name='emprestimos' AND column_name='quantidade_inicial'");
        itens.push({
          ok: col.rowCount === 1,
          titulo: "Versão do banco",
          detalhe: col.rowCount === 1 ? "Atualizada (com quantidades)."
            : "Desatualizada. Rode o arquivo db/schema.sql de novo no SQL Editor do Supabase (é seguro, não apaga dados).",
        });
        const n = await client.query("SELECT count(*)::int n FROM usuarios");
        temUsuarios = n.rows[0].n > 0;
        itens.push({ ok: true, titulo: "Usuários", detalhe: temUsuarios ? `${n.rows[0].n} cadastrado(s).` : "Nenhum ainda — acesse /setup para criar o administrador." });
      }
    } catch (e) {
      itens.push({ ok: false, titulo: "Conexão com o banco", detalhe: explicarErro(e) });
    } finally {
      await client.end().catch(() => {});
    }
  }

  // Depois que o sistema estiver em uso, só administradores veem esta página
  if (temUsuarios && itens.every((i) => i.ok)) {
    const u = await usuarioAtual().catch(() => null);
    if (!u || u.papel !== "admin") {
      return (
        <div className="auth"><div className="card"><h2>Diagnóstico</h2><p>Tudo funcionando. <a href="/login">Ir para o login</a></p></div></div>
      );
    }
  }

  const tudoOk = itens.every((i) => i.ok);
  return (
    <div className="auth">
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>Diagnóstico da instalação</h2>
        <div className={`msg ${tudoOk ? "ok" : "erro"}`}>
          {tudoOk ? "Tudo certo! " : "Há itens a corrigir abaixo."}
          {tudoOk && <a href="/login">Ir para o sistema</a>}
        </div>
        <table>
          <tbody>
            {itens.map((i, k) => (
              <tr key={k}>
                <td style={{ width: 28, fontSize: "1.1rem" }}>{i.ok ? "✅" : "❌"}</td>
                <td><b>{i.titulo}</b><div className="sub">{i.detalhe}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sub" style={{ fontSize: ".85rem", marginTop: 14 }}>
          Depois de alterar variáveis na Vercel, é preciso fazer <b>Redeploy</b> para valerem.
        </p>
      </div>
    </div>
  );
}
