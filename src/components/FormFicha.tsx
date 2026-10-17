import { ESTADOS_CIVIS, MAX_FILHOS, TIPOS_SANGUINEOS, UFS, idade, type Ficha, type Filho } from "@/lib/ficha";
import { salvarFicha, cadastrarPorConvite } from "@/lib/ficha-acoes";
import AcessoCadastro from "./AcessoCadastro";
import FilhosEditor from "./FilhosEditor";
import CampoCEP from "./CampoCEP";
import CampoCPF from "./CampoCPF";

type Props = {
  usuario: { id: number; nome: string; email: string; telefone: string | null };
  ficha: Ficha;
  filhos: Filho[];
  origem?: "meus-dados" | "admin";
  /** Cadastro pelo link: a própria pessoa cria login + ficha */
  convite?: { codigo: string; papel: string };
};

/** Ficha completa do integrante: dados pessoais, endereço, emergência, moto, cônjuge e filhos */
export default function FormFicha({ usuario, ficha, filhos, origem = "admin", convite }: Props) {
  const f = (k: string) => (ficha[k] as string | null) ?? "";
  const hoje = new Date().toISOString().slice(0, 10);
  const idadeTit = idade(f("data_nascimento"));
  return (
    <form id="form-ficha" action={convite ? cadastrarPorConvite : salvarFicha}>
      {convite ? (
        <>
          <input type="hidden" name="convite" value={convite.codigo} />
          <div className="hp" aria-hidden="true"><label>Site<input name="site" tabIndex={-1} autoComplete="off" /></label></div>
          <div className="card">
            <h2>Acesso ao sistema</h2>
            <p className="sub" style={{ marginBottom: 10 }}>Perfil: <b>{convite.papel}</b>. Use este e-mail e senha para entrar depois.</p>
            <AcessoCadastro />
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="usuario_id" value={usuario.id} />
          <input type="hidden" name="origem" value={origem} />
        </>
      )}

      <div className="card">
        <h2>Dados pessoais</h2>
        <div className="f">
          <label>Nome completo *<input name="nome" defaultValue={usuario.nome} required /></label>
          <label>Apelido / nome de estrada<input name="apelido" defaultValue={f("apelido")} /></label>
          <CampoCPF obrigatorio={false} valor={f("cpf")} />
          <label>RG<input name="rg" defaultValue={f("rg")} /></label>
          <label>Data de nascimento {idadeTit != null && <span className="sub" style={{ fontWeight: 400 }}>({idadeTit} anos)</span>}
            <input type="date" name="data_nascimento" max={hoje} defaultValue={f("data_nascimento")} />
          </label>
          <label>Tipo sanguíneo
            <select name="tipo_sanguineo" defaultValue={f("tipo_sanguineo")}>
              <option value="">—</option>{TIPOS_SANGUINEOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Estado civil
            <select name="estado_civil" defaultValue={f("estado_civil")}>
              <option value="">—</option>{ESTADOS_CIVIS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Profissão<input name="profissao" defaultValue={f("profissao")} /></label>
          <label>Telefone / WhatsApp{convite ? " *" : ""}<input name="telefone" defaultValue={usuario.telefone ?? ""} inputMode="tel" required={!!convite} /></label>
          {!convite && <label>E-mail (login)<input value={usuario.email} disabled /></label>}
        </div>
      </div>

      <div className="card">
        <h2>Endereço</h2>
        <div className="f">
          <CampoCEP valor={f("cep")} />
          <label className="full">Rua / Avenida<input name="endereco" defaultValue={f("endereco")} /></label>
          <label>Número<input name="numero" defaultValue={f("numero")} /></label>
          <label>Complemento<input name="complemento" defaultValue={f("complemento")} /></label>
          <label>Bairro<input name="bairro" defaultValue={f("bairro")} /></label>
          <label>Cidade<input name="cidade" defaultValue={f("cidade")} /></label>
          <label>UF
            <select name="uf" defaultValue={f("uf") || "MG"}>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Emergência e moto</h2>
        <div className="f">
          <label>Contato de emergência (nome)<input name="contato_emergencia" defaultValue={f("contato_emergencia")} /></label>
          <label>Telefone de emergência<input name="telefone_emergencia" defaultValue={f("telefone_emergencia")} inputMode="tel" /></label>
          <label>Moto (marca / modelo)<input name="moto" defaultValue={f("moto")} placeholder="Ex.: Honda CB 500X" /></label>
          <label>Placa<input name="placa" defaultValue={f("placa")} style={{ textTransform: "uppercase" }} /></label>
        </div>
      </div>

      <div className="card">
        <h2>Esposa / cônjuge</h2>
        <div className="f">
          <label>Nome<input name="conjuge_nome" defaultValue={f("conjuge_nome")} /></label>
          <CampoCPF name="conjuge_cpf" obrigatorio={false} valor={f("conjuge_cpf")} />
          <label>Data de nascimento {idade(f("conjuge_nascimento")) != null && <span className="sub" style={{ fontWeight: 400 }}>({idade(f("conjuge_nascimento"))} anos)</span>}
            <input type="date" name="conjuge_nascimento" max={hoje} defaultValue={f("conjuge_nascimento")} />
          </label>
          <label>Telefone<input name="conjuge_telefone" defaultValue={f("conjuge_telefone")} inputMode="tel" /></label>
        </div>
      </div>

      <div className="card">
        <h2>Filhos <span className="sub" style={{ fontWeight: 400, fontSize: ".85rem" }}>(até {MAX_FILHOS})</span></h2>
        <FilhosEditor iniciais={filhos} max={MAX_FILHOS} />
      </div>

      <div className="card">
        <label>Observações<textarea name="observacoes" defaultValue={f("observacoes")} /></label>
        <p className="sub" style={{ fontSize: ".8rem" }}>
          Dados usados apenas pelo Motocólatras MC para cadastro dos integrantes e contato em caso de emergência (LGPD).
        </p>
        <div className="acoes"><button className="btn" type="submit">{convite ? "Concluir cadastro" : "Salvar ficha"}</button></div>
      </div>
    </form>
  );
}
