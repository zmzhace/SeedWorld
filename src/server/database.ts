import 'server-only'

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

let database: DatabaseSync | undefined

export function getDatabase(): DatabaseSync {
  if (database) return database

  const dataRoot = process.env.SEEDWORLD_DATA_DIR || path.resolve(process.cwd(), 'data')
  mkdirSync(dataRoot, { recursive: true })
  database = new DatabaseSync(path.join(dataRoot, 'seedworld.sqlite'))
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  database.exec(`
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      title TEXT,
      summary TEXT,
      prompt TEXT NOT NULL DEFAULT '',
      snapshot_json TEXT,
      writing_settings_json TEXT NOT NULL,
      writing_settings_version INTEGER NOT NULL DEFAULT 1,
      source_graph_id TEXT,
      evolution_graph_id TEXT,
      graph_sync_status TEXT NOT NULL DEFAULT 'empty',
      visibility_confirmed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      original_path TEXT,
      extracted_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, sha256)
    );
    CREATE TABLE IF NOT EXISTS source_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      content TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      episode_id TEXT,
      UNIQUE(source_id, ordinal)
    );
    CREATE TABLE IF NOT EXISTS ontologies (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      definition_json TEXT NOT NULL,
      rationale TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, version)
    );
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      source_graph_id TEXT,
      remote_batch_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(world_id, content_hash)
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      progress INTEGER NOT NULL,
      message TEXT NOT NULL,
      error TEXT,
      remote_batch_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS graph_entities (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      graph_layer TEXT NOT NULL,
      external_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases_json TEXT NOT NULL,
      properties_json TEXT NOT NULL,
      status TEXT NOT NULL,
      actionable INTEGER NOT NULL DEFAULT 0,
      provenance_json TEXT NOT NULL,
      import_id TEXT REFERENCES imports(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(world_id, graph_layer, external_id)
    );
    CREATE TABLE IF NOT EXISTS graph_facts (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      graph_layer TEXT NOT NULL,
      external_id TEXT,
      subject_id TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object_id TEXT,
      value_json TEXT,
      claim_scope TEXT NOT NULL,
      believer_id TEXT,
      valid_from TEXT,
      valid_until TEXT,
      confidence REAL NOT NULL DEFAULT 1,
      provenance_json TEXT NOT NULL,
      import_id TEXT REFERENCES imports(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, graph_layer, external_id)
    );
    CREATE TABLE IF NOT EXISTS visibility_rules (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      target_kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      effect TEXT NOT NULL,
      subject_kind TEXT NOT NULL,
      subject_id TEXT,
      condition_json TEXT,
      priority INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS world_rules (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      condition_json TEXT NOT NULL,
      effect_json TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      scope_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS simulation_ticks (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, tick)
    );
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      chapter_number INTEGER NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      pov_entity_id TEXT,
      tick_from INTEGER NOT NULL,
      tick_to INTEGER NOT NULL,
      markdown_path TEXT NOT NULL,
      validation_json TEXT NOT NULL,
      settings_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, chapter_number, version)
    );
    CREATE TABLE IF NOT EXISTS compass (
      world_id TEXT PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
      long_json TEXT NOT NULL,
      current_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entities_world_type ON graph_entities(world_id, type);
    CREATE INDEX IF NOT EXISTS idx_facts_world_subject ON graph_facts(world_id, subject_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_world ON jobs(world_id, updated_at DESC);
  `)
  return database
}

export function closeDatabaseForTests(): void {
  database?.close()
  database = undefined
}
