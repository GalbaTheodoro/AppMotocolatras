import { exigirUsuario } from "@/lib/auth";
import Lateral from "@/components/Lateral";

export const dynamic = "force-dynamic";

// Área da equipe (administradores e operadores). Integrantes são levados à agenda da sede.
export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  return (
    <div className="shell">
      <Lateral u={u} />
      <main className="main">{children}</main>
    </div>
  );
}
