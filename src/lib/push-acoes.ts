"use server";

import { query } from "./db";
import { exigirUsuario } from "./auth";
import { enviarPush } from "./push";

type Inscricao = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function salvarInscricaoPush(sub: Inscricao, aparelho: string) {
  const u = await exigirUsuario();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await query(
    `INSERT INTO push_inscricoes (usuario_id, endpoint, p256dh, auth, aparelho) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE SET usuario_id=EXCLUDED.usuario_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, aparelho=EXCLUDED.aparelho`,
    [u.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, aparelho.slice(0, 120)]);
  return { ok: true };
}

export async function removerInscricaoPush(endpoint: string) {
  await exigirUsuario();
  await query("DELETE FROM push_inscricoes WHERE endpoint=$1", [endpoint]);
  return { ok: true };
}

export async function testarPush() {
  const u = await exigirUsuario();
  return enviarPush({ titulo: "Motocólatras", corpo: "✅ Notificações ativadas neste aparelho!", url: "/", tag: "teste" }, [], u.id);
}
