-- SGF-JFAL Database Schema
-- PostgreSQL

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  usuario VARCHAR(100) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('admin','recepcao','perito','conciliador')),
  ativo BOOLEAN DEFAULT true,
  criado_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  andar VARCHAR(50) DEFAULT '',
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('pericia','audiencia')),
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS periciados (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  cpf VARCHAR(14) DEFAULT '',
  tipo_pericia VARCHAR(100) DEFAULT '',
  prioridade VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'aguardando',
  perito_id INTEGER REFERENCES usuarios(id),
  sala_designada VARCHAR(200) DEFAULT '',
  sala_atendimento VARCHAR(200),
  registrado_at TIMESTAMP DEFAULT NOW(),
  chegada_at TIMESTAMP,
  chamado_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pautas (
  id SERIAL PRIMARY KEY,
  processo VARCHAR(100) NOT NULL,
  sala_id INTEGER REFERENCES salas(id) ON DELETE SET NULL,
  sala_nome VARCHAR(200) DEFAULT '',
  status VARCHAR(20) DEFAULT 'aguardando',
  criado_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partes (
  id SERIAL PRIMARY KEY,
  pauta_id INTEGER REFERENCES pautas(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(20) DEFAULT 'autor',
  ordem INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'aguardando'
);

CREATE TABLE IF NOT EXISTS testemunhas (
  id SERIAL PRIMARY KEY,
  parte_id INTEGER REFERENCES partes(id) ON DELETE CASCADE,
  pauta_id INTEGER REFERENCES pautas(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  ordem INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'aguardando'
);

CREATE TABLE IF NOT EXISTS historico_chamadas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  sala VARCHAR(200) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  processo VARCHAR(100) DEFAULT '',
  chamado_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config (
  chave VARCHAR(100) PRIMARY KEY,
  valor TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  usuario_nome VARCHAR(200),
  acao VARCHAR(100) NOT NULL,
  detalhes TEXT,
  ip_address VARCHAR(50),
  criado_at TIMESTAMP DEFAULT NOW()
);

-- Default config
INSERT INTO config (chave, valor) VALUES ('youtube_url', '') ON CONFLICT DO NOTHING;

-- Default users (passwords are bcrypt hashed)
-- admin123, recepcao123, perito123, conciliador123
