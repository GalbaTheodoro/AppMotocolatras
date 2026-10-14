-- Motocólatras - estrutura do banco (PostgreSQL / Neon)
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
-- Um equipamento só pode ter um empréstimo em aberto
CREATE UNIQUE INDEX IF NOT EXISTS emprestimo_ativo_unico
  ON emprestimos (equipamento_id) WHERE data_devolucao IS NULL;

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
