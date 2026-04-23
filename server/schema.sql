-- ContractGen-IT — Schéma PostgreSQL
-- Usage: psql $DATABASE_URL -f server/schema.sql

CREATE TABLE IF NOT EXISTS articles (
  id                   VARCHAR(50)  PRIMARY KEY,
  categorie            TEXT         NOT NULL,
  titre                TEXT         NOT NULL,
  contenu              TEXT,
  condition_generation TEXT         NOT NULL DEFAULT 'TOUJOURS_INCLURE',
  variables            JSONB        NOT NULL DEFAULT '[]',
  ordre_affichage      INTEGER,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sous_articles (
  id                   VARCHAR(80)  PRIMARY KEY,
  parent_id            VARCHAR(50)  NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  titre                TEXT         NOT NULL,
  contenu              TEXT,
  condition_generation TEXT         NOT NULL DEFAULT 'TOUJOURS_INCLURE',
  variables            JSONB        NOT NULL DEFAULT '[]',
  ordre                INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS definitions (
  id         VARCHAR(20)  PRIMARY KEY,
  terme      TEXT         NOT NULL,
  aliases    JSONB        NOT NULL DEFAULT '[]',
  categorie  TEXT,
  definition TEXT         NOT NULL,
  source     TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_categorie     ON articles (categorie);
CREATE INDEX IF NOT EXISTS idx_articles_ordre         ON articles (ordre_affichage);
CREATE INDEX IF NOT EXISTS idx_sous_articles_parent   ON sous_articles (parent_id);
CREATE INDEX IF NOT EXISTS idx_definitions_terme      ON definitions USING gin (to_tsvector('french', terme));
