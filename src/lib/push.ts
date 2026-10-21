import webpush from "web-push";
import { query, queryOne } from "./db";

/**
 * Notificações no celular (Web Push) — gratuitas, usam o próprio navegador/app instalado.
 * As chaves VAPID são criadas automaticamente na primeira vez e guardadas em "configuracoes".
 * (Também podem vir das variáveis VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, se você preferir.)
 */
export async function chavesVapid(): Promise<{ publica: string; privada: string }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publica: process.env.VAPID_PUBLIC_KEY, privada: process.env.VAPID_PRIVATE_KEY };
  }
  const pub = await queryOne<{ valor: string }>("SELECT valor FROM configuracoes WHERE chave='vapid_publica'");
  const priv = await queryOne<{ valor: string }>("SELECT valor FROM configuracoes WHERE chave='vapid_privada'");
  if (pub?.valor && priv?.valor) return { publica: pub.valor, privada: priv.valor };
  const k = webpush.generateVAPIDKeys();
  // ON CONFLICT DO NOTHING: se duas requisições gerarem ao mesmo tempo, fica a primeira
  await query("INSERT INTO configuracoes (chave, valor) VALUES ('vapid_publica',$1),('vapid_privada',$2) ON CONFLICT (chave) DO NOTHING",
    [k.publicKey, k.privateKey]);
  const p2 = await queryOne<{ valor: string }>("SELECT valor FROM configuracoes WHERE chave='vapid_publica'");
  const v2 = await queryOne<{ valor: string }>("SELECT valor FROM configuracoes WHERE chave='vapid_privada'");
  return { publica: p2!.valor, privada: v2!.valor };
}

export type Aviso = { titulo: string; corpo: string; url?: string; tag?: string };

/** Envia para os aparelhos inscritos dos usuários com os perfis indicados (padrão: administradores) */
export async function enviarPush(aviso: Aviso, papeis: string[] = ["admin"], usuarioId?: number) {
  const inscricoes = await query<{ id: number; endpoint: string; p256dh: string; auth: string }>(
    `SELECT i.id, i.endpoint, i.p256dh, i.auth FROM push_inscricoes i JOIN usuarios u ON u.id=i.usuario_id
      WHERE u.ativo AND ($2::int IS NOT NULL AND u.id = $2 OR $2::int IS NULL AND u.papel = ANY($1::text[]))`,
    [papeis, usuarioId ?? null]
  );
  if (inscricoes.length === 0) return { enviados: 0, falhas: 0 };
  const { publica, privada } = await chavesVapid();
  webpush.setVapidDetails("mailto:avisos@motocolatras.app", publica, privada);
  const payload = JSON.stringify(aviso);
  let enviados = 0, falhas = 0;
  await Promise.all(inscricoes.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
      enviados++;
    } catch (e) {
      falhas++;
      const status = (e as { statusCode?: number }).statusCode;
      // Inscrição vencida ou removida no aparelho: apaga
      if (status === 404 || status === 410) await query("DELETE FROM push_inscricoes WHERE id=$1", [s.id]).catch(() => {});
      else console.error("Falha no push:", status, (e as Error).message);
    }
  }));
  return { enviados, falhas };
}

/** Envia para os aparelhos de uma lista de usuários (ex.: convidados de uma reunião) */
export async function enviarPushPara(aviso: Aviso, usuarioIds: number[]) {
  const ids = [...new Set(usuarioIds.filter((n) => Number.isInteger(n) && n > 0))];
  let enviados = 0, falhas = 0;
  for (const id of ids) {
    const r = await enviarPush(aviso, [], id).catch(() => ({ enviados: 0, falhas: 1 }));
    enviados += r.enviados; falhas += r.falhas;
  }
  return { enviados, falhas, pessoas: ids.length };
}
