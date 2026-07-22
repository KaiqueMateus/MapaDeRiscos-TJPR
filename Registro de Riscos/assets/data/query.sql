-- ============================================================
-- SISTEMA DE GESTÃO DE RISCOS - TJPR
-- Criação completa: 8 tabelas + triggers
-- ============================================================

-- 1. USUÁRIOS
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  divisao_sigla TEXT NOT NULL,
  is_gestor BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_usuarios_matricula ON usuarios(matricula);
CREATE INDEX idx_usuarios_divisao ON usuarios(divisao_sigla);

-- 2. PROCESSOS (Registros)
CREATE TABLE processos (
  id BIGSERIAL PRIMARY KEY,
  divisao_sigla TEXT NOT NULL,
  equipe TEXT,
  processo TEXT NOT NULL,
  objetivo TEXT,
  compilado_por TEXT,
  analisado_por TEXT,
  data_registro DATE,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_processos_divisao ON processos(divisao_sigla);
CREATE INDEX idx_processos_criado_por ON processos(criado_por);

-- 3. RISCOS
CREATE TABLE riscos (
  id BIGSERIAL PRIMARY KEY,
  processo_id BIGINT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  causa_fonte TEXT,
  causa_vulnerabilidade TEXT,
  consequencia TEXT,
  prob INT CHECK (prob BETWEEN 1 AND 5),
  imp INT CHECK (imp BETWEEN 1 AND 5),
  desc_controle TEXT,
  nivel_controle NUMERIC(3,2) CHECK (nivel_controle IN (0.5, 0.75, 1)),
  tratar TEXT CHECK (tratar IN ('Sim', 'Não')),
  prioritario TEXT CHECK (prioritario IN ('Sim', 'Não')),
  justificativa_nao_tratar TEXT,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_riscos_processo ON riscos(processo_id);

-- 4. TRATAMENTO_ETAPAS
CREATE TABLE tratamento_etapas (
  id BIGSERIAL PRIMARY KEY,
  risco_id BIGINT NOT NULL REFERENCES riscos(id) ON DELETE CASCADE,
  numero_etapa INT NOT NULL,
  opcao TEXT CHECK (opcao IN ('Evitar', 'Transferir', 'Mitigar', 'Aceitar')),
  custo_beneficio TEXT CHECK (custo_beneficio IN ('Favorável', 'Desfavorável')),
  responsavel TEXT,
  prazo DATE,
  descricao TEXT,
  nivel_monitoramento NUMERIC(3,2) CHECK (nivel_monitoramento IN (0.5, 0.75, 1)),
  monitoramento_obs TEXT,
  reaberta BOOLEAN DEFAULT false,
  concluido BOOLEAN DEFAULT false,
  concluido_em TIMESTAMPTZ,
  concluido_por UUID REFERENCES usuarios(id),
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(risco_id, numero_etapa)
);
CREATE INDEX idx_etapas_risco ON tratamento_etapas(risco_id);
CREATE INDEX idx_etapas_prazo ON tratamento_etapas(prazo) WHERE NOT concluido;

-- 5. ORGANOGRAMAS
CREATE TABLE organogramas (
  id BIGSERIAL PRIMARY KEY,
  processo_id BIGINT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  nome_original TEXT NOT NULL,
  tipo_mime TEXT,
  tamanho_bytes INT,
  storage_path TEXT NOT NULL,
  upload_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_organogramas_processo ON organogramas(processo_id);

-- 6. LOGS_AUDITORIA
CREATE TABLE logs_auditoria (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  divisao_sigla TEXT,
  acao TEXT NOT NULL,
  entidade_tipo TEXT,
  entidade_id BIGINT,
  detalhes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX idx_logs_criado_em ON logs_auditoria(criado_em DESC);
CREATE INDEX idx_logs_divisao ON logs_auditoria(divisao_sigla);

-- 7. SNAPSHOTS_KPI
CREATE TABLE snapshots_kpi (
  id BIGSERIAL PRIMARY KEY,
  divisao_sigla TEXT,
  data_snapshot DATE NOT NULL,
  total_riscos INT DEFAULT 0,
  total_planos INT DEFAULT 0,
  total_concluidos INT DEFAULT 0,
  total_atrasos INT DEFAULT 0,
  exposicao_percent NUMERIC(5,2),
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(divisao_sigla, data_snapshot)
);
CREATE INDEX idx_snapshots_data ON snapshots_kpi(data_snapshot DESC);

-- 8. SESSOES
CREATE TABLE sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  ip_origem TEXT,
  user_agent TEXT,
  iniciada_em TIMESTAMPTZ DEFAULT now(),
  finalizada_em TIMESTAMPTZ
);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX idx_sessoes_ativas ON sessoes(usuario_id) WHERE finalizada_em IS NULL;

-- ============================================================
-- TRIGGER: atualiza automaticamente o campo atualizado_em
-- ============================================================
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_processos_upd BEFORE UPDATE ON processos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER trg_riscos_upd BEFORE UPDATE ON riscos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER trg_etapas_upd BEFORE UPDATE ON tratamento_etapas
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- FIM