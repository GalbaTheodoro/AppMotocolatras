# Motocólatras – Controle de Empréstimos

Sistema web para cadastro de **equipamentos**, **pessoas**, controle de **empréstimos** e **mensalidades**.

- Login por usuário (perfis **Administrador** e **Operador**)
- Cada empréstimo tem os **3 primeiros meses grátis** (contados da data de início)
- Cada equipamento tem uma **quantidade em estoque**; um empréstimo pode levar várias unidades
- Depois do período grátis, gera automaticamente **1 mensalidade por mês**, cobrando **valor × unidades emprestadas**
- Pagamentos registrados manualmente (Pix, dinheiro, cartão…), com controle de pendentes e atrasadas

Tecnologia: Next.js (Vercel) + PostgreSQL (Supabase). Funciona com qualquer PostgreSQL.

---

## Publicar (passo a passo)

### 1. Banco de dados no Supabase
1. Entre em https://supabase.com → **New project** → nome `motocolatras`, região **South America (São Paulo)**.
   Anote a **senha do banco** (Database Password) que você definir.
2. No menu lateral, **SQL Editor** → **New query** → cole todo o conteúdo de `db/schema.sql` → **Run**.
3. Clique em **Connect** (topo da página) → **Connection string** → escolha **Transaction pooler** (porta `6543`).
   Copie o endereço e troque `[YOUR-PASSWORD]` pela senha do banco. Esse é o `DATABASE_URL`.

> Use o *Transaction pooler* (porta 6543): é o indicado para a Vercel.
> O schema já liga o RLS em todas as tabelas, bloqueando o acesso pela API pública do Supabase;
> o sistema conecta direto ao banco e funciona normalmente.

### 2. Código no GitHub
1. Crie um repositório (pode ser privado) em https://github.com/new.
2. Dê dois cliques em `publicar-github.bat` (envia a pasta e, nas próximas vezes, as atualizações).

### 3. Publicar na Vercel
1. Em https://vercel.com → **Add New → Project** → importe o repositório.
2. Em **Environment Variables**, adicione:
   - `DATABASE_URL` = connection string do Supabase (Transaction pooler)
   - `AUTH_SECRET` = uma frase longa e aleatória (mín. 16 caracteres)
3. Clique em **Deploy**.

> Alternativa: na Vercel, aba **Storage → Supabase**, cria o banco e preenche variáveis automaticamente.
> Nesse caso, crie também `DATABASE_URL` com o mesmo valor de `POSTGRES_URL`.

### 4. Primeiro acesso
Abra o endereço do site. Na primeira vez aparece a tela **/setup** para criar o administrador.
Depois, em **Usuários**, cadastre os operadores.

---

## Rodar no computador (opcional)
```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e AUTH_SECRET
npm run db:setup             # cria as tabelas
npm run dev                  # http://localhost:3000
```

## Solicitações pelo público
- Página pública **/solicitar**: a pessoa informa seus dados (CPF validado) e os equipamentos/quantidades que deseja. Recebe um **protocolo**.
- A pessoa também envia **documento com foto (RG/CNH)**, **foto do rosto** e **comprovante de endereço** (foto ou PDF). As fotos são reduzidas no próprio celular antes do envio; os arquivos ficam guardados no banco e só a equipe logada consegue abrir. Ao aprovar, os documentos vão para o cadastro da pessoa.
- Página **/acompanhar**: consulta a situação com protocolo + CPF e vê a mensagem da equipe.
- No sistema, menu **Solicitações**: mostra se o CPF já é cadastrado (e se tem atrasos), a disponibilidade de cada item e permite **aprovar** (cria/usa o cadastro da pessoa e registra os empréstimos) ou **recusar** com mensagem.

## Agenda da sede
- Menu **Agenda da sede**: calendário mensal; cada dia pode ter **uma reserva (dia inteiro)**.
- Perfil **Integrante** (criado em Usuários): entra no sistema, vê só a agenda, reserva dias livres e cancela as próprias reservas futuras. Vê quem reservou os outros dias, mas não valores.
- A equipe (admin/operador) vê tudo, reserva em nome de integrantes ou de outra pessoa, define o **valor** de cada reserva e marca **pago / pendente / isento**. O painel mostra as próximas reservas.

## Atualizar o banco
Se o banco já existia, rode **de novo** o `db/schema.sql` no SQL Editor do Supabase. É seguro: só acrescenta o que falta, não apaga dados.

## Regras de cobrança
- Início do empréstimo em 15/01 → grátis até 15/04 → mensalidades vencem em 15/04, 15/05, 15/06…
- A mensalidade é gerada no dia em que começa a competência (só aparece quando chega a data).
- Fica **atrasada** após os dias de tolerância (padrão 5).
- **Devolução parcial**: dá para devolver só parte das unidades; a cobrança passa a ser pela quantidade que ficou.
- Na **devolução**, mensalidades pendentes de meses que começam a partir da data de devolução são removidas.
- Empréstimos antigos podem ser lançados com a data real de início; as mensalidades devidas são geradas na hora.
- Em **Configurações** (admin): valor da mensalidade, meses grátis e dias de tolerância.
  Mudar o valor afeta apenas mensalidades novas.

## Permissões
| Ação | Operador | Admin |
|---|---|---|
| Cadastrar/editar equipamentos e pessoas | ✔ | ✔ |
| Registrar empréstimo e devolução | ✔ | ✔ |
| Receber / desfazer recebimento | ✔ | ✔ |
| Excluir registros, isentar mensalidade | | ✔ |
| Usuários e configurações | | ✔ |
