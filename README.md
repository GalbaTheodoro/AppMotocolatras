# Motocólatras – Controle de Empréstimos

Sistema web para cadastro de **equipamentos**, **pessoas**, controle de **empréstimos** e **mensalidades**.

- Login por usuário (perfis **Administrador** e **Operador**)
- Cada empréstimo tem os **3 primeiros meses grátis** (contados da data de início)
- Depois disso, gera automaticamente **1 mensalidade por mês por equipamento** (valor único configurável)
- Pagamentos registrados manualmente (Pix, dinheiro, cartão…), com controle de pendentes e atrasadas

Tecnologia: Next.js (Vercel) + PostgreSQL (Neon).

---

## Publicar (passo a passo)

### 1. Banco de dados no Neon
1. Crie uma conta em https://neon.tech e um projeto (região *São Paulo* se disponível).
2. Em **Dashboard → Connect**, copie a *connection string* **Pooled** (contém `-pooler` no endereço).
3. Abra **SQL Editor** no Neon, cole todo o conteúdo do arquivo `db/schema.sql` e clique em **Run**.

### 2. Código no GitHub
1. Crie um repositório (pode ser privado) em https://github.com/new.
2. Envie esta pasta para ele (GitHub Desktop: *Add existing repository* → *Publish*).

### 3. Publicar na Vercel
1. Em https://vercel.com → **Add New → Project** → importe o repositório.
2. Em **Environment Variables**, adicione:
   - `DATABASE_URL` = connection string do Neon
   - `AUTH_SECRET` = uma frase longa e aleatória (mín. 16 caracteres)
3. Clique em **Deploy**.

> Alternativa: na Vercel, aba **Storage → Neon**, cria o banco e já preenche `DATABASE_URL` sozinho.

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

## Regras de cobrança
- Início do empréstimo em 15/01 → grátis até 15/04 → mensalidades vencem em 15/04, 15/05, 15/06…
- A mensalidade é gerada no dia em que começa a competência (só aparece quando chega a data).
- Fica **atrasada** após os dias de tolerância (padrão 5).
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
