import { exigirUsuario } from "@/lib/auth";
import "./termo.css";

export const dynamic = "force-dynamic";

export default async function ImpressaoLayout({ children }: { children: React.ReactNode }) {
  await exigirUsuario();
  return <>{children}</>;
}
