-- Motocólatras - estrutura do banco (PostgreSQL / Supabase)
-- Pode ser executado mais de uma vez com segurança.

CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  papel       TEXT NOT NULL DEFAULT 'operador' CHECK (papel IN ('admin','operador')),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pessoas (
  id           SERIAL PRIMARY KEY,
  nome         TEXT NOT NULL,
  cpf          TEXT,
  telefone     TEXT,
  email        TEXT,
  endereco     TEXT,
  observacoes  TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipamentos (
  id           SERIAL PRIMARY KEY,
  nome         TEXT NOT NULL,
  codigo       TEXT UNIQUE,
  categoria    TEXT,
  descricao    TEXT,
  status       TEXT NOT NULL DEFAULT 'disponivel'
               CHECK (status IN ('disponivel','emprestado','manutencao','inativo')),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emprestimos (
  id              SERIAL PRIMARY KEY,
  equipamento_id  INTEGER NOT NULL REFERENCES equipamentos(id),
  pessoa_id       INTEGER NOT NULL REFERENCES pessoas(id),
  data_inicio     DATE NOT NULL,
  data_devolucao  DATE,
  observacoes     TEXT,
  criado_por      INTEGER REFERENCES usuarios(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (data_devolucao IS NULL OR data_devolucao >= data_inicio)
);

CREATE TABLE IF NOT EXISTS mensalidades (
  id                  SERIAL PRIMARY KEY,
  emprestimo_id       INTEGER NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  competencia_inicio  DATE NOT NULL,
  competencia_fim     DATE NOT NULL,
  vencimento          DATE NOT NULL,
  valor               NUMERIC(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  pago_em             DATE,
  forma_pagamento     TEXT,
  observacao          TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (emprestimo_id, competencia_inicio)
);
CREATE INDEX IF NOT EXISTS mensalidades_status ON mensalidades (status, vencimento);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
);
INSERT INTO configuracoes (chave, valor) VALUES
  ('valor_mensalidade', '50.00'),
  ('meses_gratis', '3'),
  ('dias_tolerancia', '5')
ON CONFLICT (chave) DO NOTHING;

-- ===== Versão 2: quantidade por equipamento =====
-- (seguro rodar em banco já existente: só acrescenta o que falta)
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;
ALTER TABLE emprestimos  ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;
ALTER TABLE emprestimos  ADD COLUMN IF NOT EXISTS quantidade_inicial INTEGER NOT NULL DEFAULT 1;
ALTER TABLE mensalidades ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;
-- Agora um equipamento pode estar em vários empréstimos ao mesmo tempo
DROP INDEX IF EXISTS emprestimo_ativo_unico;
-- A disponibilidade passa a ser calculada pelas quantidades
UPDATE equipamentos SET status = 'disponivel' WHERE status = 'emprestado';

CREATE TABLE IF NOT EXISTS devolucoes (
  id             SERIAL PRIMARY KEY,
  emprestimo_id  INTEGER NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  data           DATE NOT NULL,
  quantidade     INTEGER NOT NULL CHECK (quantidade > 0),
  criado_por     INTEGER REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emprestimos_equip_ativos ON emprestimos (equipamento_id) WHERE data_devolucao IS NULL;

-- ===== Versão 3: solicitações públicas de empréstimo =====
CREATE TABLE IF NOT EXISTS solicitacoes (
  id             SERIAL PRIMARY KEY,
  protocolo      TEXT NOT NULL UNIQUE,
  nome           TEXT NOT NULL,
  cpf            TEXT NOT NULL,
  telefone       TEXT NOT NULL,
  email          TEXT,
  endereco       TEXT,
  observacoes    TEXT,
  status         TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','aprovada','recusada','cancelada')),
  resposta       TEXT,
  pessoa_id      INTEGER REFERENCES pessoas(id),
  analisado_por  INTEGER REFERENCES usuarios(id),
  analisado_em   TIMESTAMPTZ,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solicitacoes_status ON solicitacoes (status, criado_em);

CREATE TABLE IF NOT EXISTS solicitacao_itens (
  id                   SERIAL PRIMARY KEY,
  solicitacao_id       INTEGER NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
  equipamento_id       INTEGER NOT NULL REFERENCES equipamentos(id),
  quantidade           INTEGER NOT NULL CHECK (quantidade > 0),
  quantidade_aprovada  INTEGER,
  emprestimo_id        INTEGER REFERENCES emprestimos(id) ON DELETE SET NULL
);

-- ===== Versão 4: documentos (documento, foto de rosto, comprovante de endereço) =====
CREATE TABLE IF NOT EXISTS arquivos (
  id              SERIAL PRIMARY KEY,
  solicitacao_id  INTEGER REFERENCES solicitacoes(id) ON DELETE CASCADE,
  pessoa_id       INTEGER REFERENCES pessoas(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('documento','rosto','endereco')),
  nome            TEXT,
  mime            TEXT NOT NULL,
  tamanho         INTEGER NOT NULL,
  dados           BYTEA NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arquivos_solicitacao ON arquivos (solicitacao_id);
CREATE INDEX IF NOT EXISTS arquivos_pessoa ON arquivos (pessoa_id);

-- ===== Versão 5: integrantes e agenda da sede =====
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_papel_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_papel_check CHECK (papel IN ('admin','operador','integrante'));

CREATE TABLE IF NOT EXISTS reservas_sede (
  id             SERIAL PRIMARY KEY,
  data           DATE NOT NULL,
  usuario_id     INTEGER REFERENCES usuarios(id),   -- integrante que reservou (se tiver login)
  responsavel    TEXT NOT NULL,                     -- nome de quem reservou
  telefone       TEXT,
  finalidade     TEXT,
  valor          NUMERIC(10,2),                     -- definido pela equipe
  pagamento      TEXT NOT NULL DEFAULT 'pendente' CHECK (pagamento IN ('pendente','pago','isento')),
  pago_em        DATE,
  status         TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  observacoes    TEXT,
  criado_por     INTEGER REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelado_em   TIMESTAMPTZ
);
-- Só uma reserva ativa por dia
CREATE UNIQUE INDEX IF NOT EXISTS reserva_sede_dia_unico ON reservas_sede (data) WHERE status = 'confirmada';

-- ===== Versão 6: notificações no celular (Web Push) =====
CREATE TABLE IF NOT EXISTS push_inscricoes (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  aparelho    TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Versão 7: ficha completa do integrante =====
CREATE TABLE IF NOT EXISTS usuario_ficha (
  usuario_id           INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  apelido              TEXT,
  cpf                  TEXT,
  rg                   TEXT,
  data_nascimento      DATE,
  tipo_sanguineo       TEXT,
  profissao            TEXT,
  estado_civil         TEXT,
  cep                  TEXT,
  endereco             TEXT,
  numero               TEXT,
  complemento          TEXT,
  bairro               TEXT,
  cidade               TEXT,
  uf                   TEXT,
  contato_emergencia   TEXT,
  telefone_emergencia  TEXT,
  moto                 TEXT,
  placa                TEXT,
  conjuge_nome         TEXT,
  conjuge_cpf          TEXT,
  conjuge_nascimento   DATE,
  conjuge_telefone     TEXT,
  observacoes          TEXT,
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuario_filhos (
  id               SERIAL PRIMARY KEY,
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ordem            INTEGER NOT NULL,
  nome             TEXT NOT NULL,
  data_nascimento  DATE,
  sexo             TEXT
);
CREATE INDEX IF NOT EXISTS usuario_filhos_usuario ON usuario_filhos (usuario_id, ordem);

-- Segurança (Supabase): liga RLS sem políticas, bloqueando o acesso às tabelas pela
-- API pública do Supabase (chave anon). O sistema conecta direto como dono das
-- tabelas e por isso continua com acesso normal.
ALTER TABLE usuarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pessoas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensalidades  ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_sede ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_ficha ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_filhos ENABLE ROW LEVEL SECURITY;

-- ===== Versão 8: eventos do clube na agenda (reuniões, festas, encontros, rolês) =====
CREATE TABLE IF NOT EXISTS eventos (
  id           SERIAL PRIMARY KEY,
  data         DATE NOT NULL,
  hora         TEXT,                               -- "19:30" (opcional)
  tipo         TEXT NOT NULL CHECK (tipo IN ('reuniao','festa','encontro','role')),
  titulo       TEXT NOT NULL,
  local        TEXT,
  na_sede      BOOLEAN NOT NULL DEFAULT FALSE,     -- se for na sede, o dia fica ocupado para reservas
  descricao    TEXT,
  status       TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','cancelado')),
  criado_por   INTEGER REFERENCES usuarios(id),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eventos_data ON eventos (data) WHERE status = 'ativo';
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

-- ===== Versão 9: toda solicitação já cadastra a pessoa (backfill das solicitações antigas) =====
INSERT INTO pessoas (nome, cpf, telefone, email, endereco, observacoes)
SELECT DISTINCT ON (regexp_replace(s.cpf,'\D','','g')) s.nome, s.cpf, s.telefone, s.email, s.endereco, 'Cadastro via solicitação ' || s.protocolo
  FROM solicitacoes s
 WHERE s.pessoa_id IS NULL AND coalesce(s.cpf,'') <> ''
   AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE regexp_replace(coalesce(p.cpf,''),'\D','','g') = regexp_replace(s.cpf,'\D','','g'))
 ORDER BY regexp_replace(s.cpf,'\D','','g'), s.criado_em DESC;
UPDATE solicitacoes s SET pessoa_id = p.id
  FROM pessoas p
 WHERE s.pessoa_id IS NULL AND coalesce(s.cpf,'') <> ''
   AND p.id = (SELECT min(id) FROM pessoas x WHERE regexp_replace(coalesce(x.cpf,''),'\D','','g') = regexp_replace(s.cpf,'\D','','g'));
UPDATE arquivos a SET pessoa_id = s.pessoa_id
  FROM solicitacoes s WHERE a.solicitacao_id = s.id AND a.pessoa_id IS NULL AND s.pessoa_id IS NOT NULL;

-- ===== Versão 10: reuniões — pauta, ata, decisões e tarefas =====
CREATE TABLE IF NOT EXISTS reuniao_pauta (
  id          SERIAL PRIMARY KEY,
  evento_id   INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  ordem       INTEGER NOT NULL DEFAULT 0,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  discutido   BOOLEAN NOT NULL DEFAULT FALSE,
  criado_por  INTEGER REFERENCES usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reuniao_pauta_evento ON reuniao_pauta (evento_id, ordem);

CREATE TABLE IF NOT EXISTS reuniao_ata (
  evento_id       INTEGER PRIMARY KEY REFERENCES eventos(id) ON DELETE CASCADE,
  hora_inicio     TEXT,
  hora_fim        TEXT,
  presentes       INTEGER[] NOT NULL DEFAULT '{}',   -- ids dos usuários presentes
  convidados      TEXT,                              -- outros presentes (sem cadastro)
  texto           TEXT,                              -- relato / discussões
  secretario      TEXT,
  aprovada        BOOLEAN NOT NULL DEFAULT FALSE,    -- ata finalizada
  atualizado_por  INTEGER REFERENCES usuarios(id),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reuniao_decisoes (
  id          SERIAL PRIMARY KEY,
  evento_id   INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  texto       TEXT NOT NULL,
  criado_por  INTEGER REFERENCES usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reuniao_decisoes_evento ON reuniao_decisoes (evento_id);

CREATE TABLE IF NOT EXISTS tarefas (
  id                SERIAL PRIMARY KEY,
  evento_id         INTEGER REFERENCES eventos(id) ON DELETE SET NULL,  -- reunião onde foi passada (opcional)
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  responsavel_id    INTEGER REFERENCES usuarios(id),
  responsavel_nome  TEXT,                                               -- se não tiver login
  prazo             DATE,
  status            TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','andamento','concluida','cancelada')),
  concluida_em      DATE,
  observacao        TEXT,
  criado_por        INTEGER REFERENCES usuarios(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tarefas_status ON tarefas (status, prazo);
CREATE INDEX IF NOT EXISTS tarefas_responsavel ON tarefas (responsavel_id);
CREATE INDEX IF NOT EXISTS tarefas_evento ON tarefas (evento_id);

ALTER TABLE reuniao_pauta    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuniao_ata      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuniao_decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas          ENABLE ROW LEVEL SECURITY;

-- ===== Versão 11: transcrição de áudio das reuniões (Grok) =====
ALTER TABLE reuniao_ata ADD COLUMN IF NOT EXISTS transcricao TEXT;
