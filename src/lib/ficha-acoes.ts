"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { transacao } from "./db";
import { exigirLogado } from "./auth";
import { txt, comMsg, soDigitos, cpfValido, formatarCPF, hojeISO } from "./formato";
import { MAX_FILHOS } from "./ficha";

const CAMPOS = [
  "apelido", "rg", "tipo_sanguineo", "profissao", "estado_civil", "cep", "endereco", "numero", "complemento",
  "bairro", "cidade", "uf", "contato_emergencia", "telefone_emergencia", "moto", "placa",
  "conjuge_nome", "conjuge_telefone", "observacoes",
] as const;

function dataOk(v: string | null) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= hojeISO() && v >= "1900-01-01" ? v : null;
}

/** Salva a ficha: o administrador edita qualquer usuário; cada pessoa edita a própria */
export async function salvarFicha(fd: FormData) {
  const eu = await exigirLogado();
  const id = Number(fd.get("usuario_id"));
  const proprio = id === eu.id;
  if (!proprio && eu.papel !== "admin") redirect("/");
  const volta = proprio && txt(fd, "origem") === "meus-dados" ? "/meus-dados" : `/usuarios/${id}`;

  const nome = txt(fd, "nome");
  if (!nome) redirect(comMsg(volta, "erro", "Informe o nome completo"));
  const cpf = soDigitos(txt(fd, "cpf"));
  if (cpf && !cpfValido(cpf)) redirect(comMsg(volta, "erro", "CPF do integrante inválido"));
  const cpfConj = soDigitos(txt(fd, "conjuge_cpf"));
  if (cpfConj && !cpfValido(cpfConj)) redirect(comMsg(volta, "erro", "CPF do(a) cônjuge inválido"));

  // Filhos: campos filho_nome_0..4, filho_nasc_0..4, filho_sexo_0..4 (linhas sem nome são ignoradas)
  const filhos: { nome: string; nasc: string | null; sexo: string | null }[] = [];
  for (let i = 0; i < MAX_FILHOS; i++) {
    const n = txt(fd, `filho_nome_${i}`);
    if (n) filhos.push({ nome: n, nasc: dataOk(txt(fd, `filho_nasc_${i}`)), sexo: txt(fd, `filho_sexo_${i}`) });
  }

  const valores = CAMPOS.map((c) => {
    const v = txt(fd, c);
    return c === "uf" || c === "placa" ? v?.toUpperCase() ?? null : v;
  });

  await transacao(async (q) => {
    await q("UPDATE usuarios SET nome=$1, telefone=$2 WHERE id=$3", [nome, txt(fd, "telefone"), id]);
    await q(
      `INSERT INTO usuario_ficha (usuario_id, cpf, data_nascimento, conjuge_cpf, conjuge_nascimento, ${CAMPOS.join(", ")}, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, ${CAMPOS.map((_, i) => `$${i + 6}`).join(", ")}, now())
       ON CONFLICT (usuario_id) DO UPDATE SET cpf=EXCLUDED.cpf, data_nascimento=EXCLUDED.data_nascimento,
         conjuge_cpf=EXCLUDED.conjuge_cpf, conjuge_nascimento=EXCLUDED.conjuge_nascimento,
         ${CAMPOS.map((c) => `${c}=EXCLUDED.${c}`).join(", ")}, atualizado_em=now()`,
      [id, cpf ? formatarCPF(cpf) : null, dataOk(txt(fd, "data_nascimento")), cpfConj ? formatarCPF(cpfConj) : null,
        dataOk(txt(fd, "conjuge_nascimento")), ...valores]);
    await q("DELETE FROM usuario_filhos WHERE usuario_id=$1", [id]);
    for (const [i, f] of filhos.entries()) {
      await q("INSERT INTO usuario_filhos (usuario_id, ordem, nome, data_nascimento, sexo) VALUES ($1,$2,$3,$4,$5)",
        [id, i + 1, f.nome, f.nasc, f.sexo]);
    }
  });
  revalidatePath(volta);
  redirect(comMsg(volta, "ok", "Dados salvos"));
}

