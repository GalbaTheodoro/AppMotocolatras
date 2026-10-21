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

## Ficha do integrante
- Em **Usuários**, cada pessoa tem **Abrir ficha**: dados pessoais (apelido, CPF, RG, nascimento, tipo sanguíneo, estado civil, profissão), endereço com busca por CEP, contato de emergência, moto/placa, **esposa/cônjuge** e **até 5 filhos**.
- Ao criar um integrante, a ficha abre automaticamente. Cada pessoa também pode atualizar a própria ficha em **Meus dados**.

## Notificações no celular (grátis)
- No menu lateral, o **administrador** toca em **🔔 Receber avisos neste celular** (de preferência pelo app instalado). A cada nova solicitação chega uma notificação; tocando nela abre a solicitação.
- Android/Windows/Mac: funciona no Chrome/Edge. iPhone: só pelo app instalado na Tela de Início (iOS 16.4+).
- As chaves de envio são criadas automaticamente na primeira vez (ou use as variáveis VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).

## Avisos de novas solicitações (grátis)
- Em **Configurações → Avisos**: WhatsApp via CallMeBot (cada pessoa ativa o próprio número e recebe uma apikey) e/ou Telegram via bot próprio (@BotFather).
- Botões **Enviar mensagem de teste** e **Descobrir chat id**. Se o aviso falhar, a solicitação é salva normalmente.

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

## Links de cadastro (auto-cadastro)
Em **Usuários → Links de cadastro** há um link para cada perfil (Integrante, Operador, Administrador).
Quem abre o link preenche login, senha e a ficha completa, e o acesso é liberado na hora.
Os administradores recebem aviso no celular a cada novo cadastro. "Gerar novo link" invalida o anterior.
Não precisa rodar SQL: os códigos ficam na tabela `configuracoes` (chaves `convite_*`).

## Agenda do clube (eventos e aniversários)
A antiga "Agenda da sede" virou **Agenda do clube**:
- **Aniversários** do integrante, da esposa/cônjuge e dos filhos aparecem sozinhos (🎂), a partir das datas da ficha.
- Qualquer usuário logado marca **Reunião, Festa, Encontro ou Rolê** (tocando no dia → "+ Marcar"). Quem criou ou a equipe edita/remove. Todos recebem aviso no celular.
- Evento marcado **na sede** ocupa o dia: ninguém consegue reservar a sede nesse dia (e vice-versa).
- Rodar de novo o `db/schema.sql` no Supabase (cria a tabela `eventos`).

## Solicitação já cadastra a pessoa
Toda solicitação pública cria (ou atualiza, pelo CPF) o cadastro em **Pessoas**, com os documentos enviados.
O cadastro da pessoa mostra o histórico de solicitações. Rodar o `db/schema.sql` cadastra também as solicitações antigas.

## Reuniões: pauta, ata, decisões e tarefas
Ao marcar um evento do tipo **Reunião** na agenda, abre-se a página da reunião (`/reunioes/[id]`) com:
1. **Pauta** — qualquer integrante sugere assuntos; o organizador (equipe ou quem marcou) ordena e marca como discutido.
2. **Ata** — horário, presentes (lista de integrantes), convidados, relato, secretário e situação (rascunho/finalizada).
   Botão **Imprimir ata** gera o documento com campos de assinatura (`/ata/[id]`).
3. **Decisões** — lista do que foi decidido.
4. **Tarefas** — o que foi passado, para quem e com qual prazo. O responsável recebe aviso no celular e atualiza a situação
   (a fazer, em andamento, concluída, cancelada). Todas as tarefas do clube ficam no menu **Tarefas** (filtros: minhas, atrasadas…).
Rodar de novo o `db/schema.sql` no Supabase (cria reuniao_pauta, reuniao_ata, reuniao_decisoes e tarefas).

## Gravar a reunião e gerar a ata com IA (Gemini grátis ou Grok)
Na página da reunião, em **Ata → 🎙️ Gravar a reunião e gerar o resumo com IA**:
- **Transcrever ao vivo**: o Chrome escreve o que é falado (grátis, não usa a IA).
- **Gravar áudio**: grava em partes de 8 minutos; cada parte vai para a IA transcrever (`/api/reunioes/[id]/audio`). Dá para baixar cada parte.
- **Enviar arquivo de áudio**: um áudio já gravado (até 4 MB, ex.: do WhatsApp).
- **✨ Gerar resumo**: cria o relato (por assunto da pauta), as decisões e as tarefas; você revisa/edita e clica em **Aplicar na ata**.
Configurar em **Configurações → Inteligência artificial nas atas**:
- **Google Gemini (padrão, grátis)**: chave em aistudio.google.com/apikey (ou variável `GEMINI_API_KEY`). Modelo padrão `gemini-3.6-flash`.
- **Grok (xAI, pago)**: chave em console.x.ai (ou `XAI_API_KEY`). Modelo padrão `grok-4.3`.
Rodar de novo o `db/schema.sql`.

## Participantes das reuniões (convites com aviso no celular)
Ao marcar (ou editar) uma reunião/evento, escolha **Quem vai participar** (busca, Todos, Diretoria/equipe).
- Só os escolhidos recebem a notificação "Você foi convidado(a)"; sem ninguém escolhido, o aviso vai para todos.
- Cada participante responde **Vou / Talvez / Não vou**; quem marcou recebe aviso de cada resposta.
- Mudou data, horário ou local: os convidados são avisados. Novos convidados recebem o convite.
- Na ata, quem confirmou já vem marcado como presente.
- **Todos os usuários** agora podem ativar "🔔 Receber avisos neste celular" no menu (antes era só o ADM).
Rodar de novo o `db/schema.sql` (cria `evento_convidados`).
