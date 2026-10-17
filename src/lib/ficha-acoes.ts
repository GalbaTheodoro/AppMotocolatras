"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { queryOne, transacao } from "./db";
import { exigirLogado, criarSessao } from "./auth";
import { papelDoConvite, NOME_PAPEL } from "./convites";
import { enviarPush } from "./push";
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

type Q = (sql: string, params?: unknown[]) => Promise<unknown[]>;

/** Confere os campos obrigatórios/CPFs; devolve a mensagem de erro ou null */
function validarFicha(fd: FormData): string | null {
  if (!txt(fd, "nome")) return "Informe o nome completo";
  const cpf = soDigitos(txt(fd, "cpf"));
  if (cpf && !cpfValido(cpf)) return "CPF do integrante inválido";
  const cpfConj = soDigitos(txt(fd, "conjuge_cpf"));
  if (cpfConj && !cpfValido(cpfConj)) return "CPF do(a) cônjuge inválido";
  return null;
}

/** Grava nome/telefone, a ficha e os filhos do usuário (dentro de uma transação) */
async function gravarFicha(q: Q, id: number, fd: FormData) {
  const nome = txt(fd, "nome");
  const cpf = soDigitos(txt(fd, "cpf"));
  const cpfConj = soDigitos(txt(fd, "conjuge_cpf"));

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
}

/** Salva a ficha: o administrador edita qualquer usuário; cada pessoa edita a própria */
export async function salvarFicha(fd: FormData) {
  const eu = await exigirLogado();
  const id = Number(fd.get("usuario_id"));
  const proprio = id === eu.id;
  if (!proprio && eu.papel !== "admin") redirect("/");
  const volta = proprio && txt(fd, "origem") === "meus-dados" ? "/meus-dados" : `/usuarios/${id}`;

  const erro = validarFicha(fd);
  if (erro) redirect(comMsg(volta, "erro", erro));
  await transacao((q) => gravarFicha(q, id, fd));
  revalidatePath(volta);
  redirect(comMsg(volta, "ok", "Dados salvos"));
}


/** O e-mail ainda está livre? (usado no formulário de cadastro antes de enviar) */
export async function emailDisponivel(email: string) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return true;
  return !(await queryOne("SELECT 1 FROM usuarios WHERE lower(email)=$1", [e]));
}

/** Cadastro feito pela própria pessoa, a partir do link do perfil */
export async function cadastrarPorConvite(fd: FormData) {
  const codigo = txt(fd, "convite") ?? "";
  const papel = await papelDoConvite(codigo);
  const volta = `/cadastro/${codigo}`;
  if (!papel) redirect(comMsg(volta, "erro", "Este link de cadastro não vale mais. Peça um novo ao administrador."));
  if (txt(fd, "site")) redirect("/login"); // robôs

  const email = (txt(fd, "email") ?? "").toLowerCase();
  const senha = txt(fd, "senha") ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(comMsg(volta, "erro", "Informe um e-mail válido"));
  if (senha.length < 6) redirect(comMsg(volta, "erro", "A senha precisa ter pelo menos 6 caracteres"));
  if (senha !== (txt(fd, "senha2") ?? "")) redirect(comMsg(volta, "erro", "As duas senhas não conferem"));
  const erro = validarFicha(fd);
  if (erro) redirect(comMsg(volta, "erro", erro));
  if (!(await emailDisponivel(email))) redirect(comMsg(volta, "erro", "Já existe um cadastro com este e-mail. Use o login ou peça para trocar a senha."));

  const hash = await bcrypt.hash(senha, 10);
  let novoId = 0;
  try {
    novoId = await transacao(async (q) => {
      const [{ id }] = await q<{ id: number }>("INSERT INTO usuarios (nome, email, senha_hash, papel, telefone) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        [txt(fd, "nome"), email, hash, papel, txt(fd, "telefone")]);
      await gravarFicha(q, id, fd);
      return id;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") redirect(comMsg(volta, "erro", "Já existe um cadastro com este e-mail"));
    throw e;
  }

  await enviarPush({
    titulo: "👤 Novo cadastro no sistema",
    corpo: `${txt(fd, "nome")} se cadastrou como ${NOME_PAPEL[papel]}`,
    url: `/usuarios/${novoId}`,
    tag: `cadastro-${novoId}`,
  }).catch((e) => console.error("Push não enviado:", e));

  await criarSessao(novoId);
  redirect(comMsg(papel === "integrante" ? "/sede" : "/", "ok", `Bem-vindo(a)! Seu cadastro como ${NOME_PAPEL[papel]} foi concluído.`));
}
