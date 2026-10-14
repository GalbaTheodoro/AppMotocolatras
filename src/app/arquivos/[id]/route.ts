import { queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";

// Entrega o arquivo apenas para usuários logados da equipe
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u) return new Response("Não autorizado", { status: 401 });
  const { id } = await params;
  const a = await queryOne<{ mime: string; nome: string | null; dados: Buffer }>(
    "SELECT mime, nome, dados FROM arquivos WHERE id=$1", [Number(id) || 0]);
  if (!a) return new Response("Não encontrado", { status: 404 });
  const nome = (a.nome ?? `arquivo-${id}`).replace(/[^\w.\-]/g, "_");
  return new Response(new Uint8Array(a.dados), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
