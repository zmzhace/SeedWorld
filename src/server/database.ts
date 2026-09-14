import 'server-only'

import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

let database: DatabaseSync | undefined

export function getDatabase(): DatabaseSync {
  if (database) return database

  const dataRoot = process.env.SEEDWORLD_DATA_DIR || path.resolve(process.cwd(), 'data')
  mkdirSync(dataRoot, { recursive: true })
  const databasePath = path.join(dataRoot, 'seedworld.sqlite')
  const migrationMarker = path.join(dataRoot, '.narrative-v2-backup-complete')
  if (existsSync(databasePath) && !existsSync(migrationMarker)) {
    const backupRoot = path.join(dataRoot, 'backups', `narrative-v2-${new Date().toISOString().replace(/[:.]/g, '-')}`)
    mkdirSync(backupRoot, { recursive: true })
    for (const suffix of ['', '-wal', '-shm']) {
      const source = databasePath + suffix
      if (existsSync(source)) copyFileSync(source, path.join(backupRoot, `seedworld.sqlite${suffix}`))
    }
    writeFileSync(migrationMarker, backupRoot, 'utf8')
  }
  database = new DatabaseSync(databasePath)
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
      archive_status TEXT NOT NULL DEFAULT 'empty',
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
    CREATE TABLE IF NOT EXISTS chapter_runs (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      progress INTEGER NOT NULL,
      message TEXT NOT NULL,
      tick_from INTEGER NOT NULL,
      tick_to INTEGER NOT NULL,
      chapter_id TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_world ON jobs(world_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases_json TEXT NOT NULL DEFAULT '[]',
      properties_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      actionable INTEGER NOT NULL DEFAULT 0,
      provenance_json TEXT NOT NULL DEFAULT '{}',
      origin TEXT NOT NULL DEFAULT 'source',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object_id TEXT,
      value_json TEXT,
      claim_scope TEXT NOT NULL DEFAULT 'objective',
      believer_id TEXT,
      truth_status TEXT NOT NULL DEFAULT 'asserted',
      valid_from TEXT,
      valid_until TEXT,
      confidence REAL NOT NULL DEFAULT 1,
      provenance_json TEXT NOT NULL DEFAULT '{}',
      origin TEXT NOT NULL DEFAULT 'source',
      parent_claim_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      actor_ids_json TEXT NOT NULL DEFAULT '[]',
      location TEXT,
      cause_event_id TEXT,
      origin TEXT NOT NULL DEFAULT 'simulation',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_states (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      holder_type TEXT NOT NULL CHECK(holder_type IN ('actor','faction','public')),
      holder_id TEXT,
      claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      stance TEXT NOT NULL CHECK(stance IN ('believed','doubted','rejected')),
      confidence REAL NOT NULL DEFAULT 0,
      learned_at_tick INTEGER NOT NULL,
      learned_from_event_id TEXT,
      learned_from_transmission_id TEXT,
      secrecy REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, holder_type, holder_id, claim_id)
    );
    CREATE TABLE IF NOT EXISTS transmissions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      source_holder_type TEXT NOT NULL,
      source_holder_id TEXT,
      recipient_holder_type TEXT NOT NULL,
      recipient_holder_id TEXT,
      claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      derived_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
      channel TEXT NOT NULL,
      scene_id TEXT,
      succeeded INTEGER NOT NULL DEFAULT 0,
      distortion REAL NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wiki_pages (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      page_type TEXT NOT NULL,
      subject_id TEXT,
      markdown TEXT NOT NULL,
      source_watermark INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(world_id, slug)
    );
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('proposed','active','resolved','abandoned')),
      time_label TEXT NOT NULL DEFAULT '',
      location_entity_id TEXT,
      objective TEXT NOT NULL,
      conflict TEXT NOT NULL,
      entry_cause TEXT,
      exit_condition TEXT,
      anchor_event_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS story_threads (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'open_question',
      status TEXT NOT NULL CHECK(status IN ('dormant','active','escalating','split','merged','resolved','failed','frozen')),
      goal TEXT NOT NULL,
      pressure REAL NOT NULL DEFAULT 0,
      owner_entity_ids_json TEXT NOT NULL DEFAULT '[]',
      parent_thread_id TEXT REFERENCES story_threads(id) ON DELETE SET NULL,
      anchor_event_ids_json TEXT NOT NULL DEFAULT '[]',
      last_advanced_tick INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actor_runtime (
      actor_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      lifecycle TEXT NOT NULL CHECK(lifecycle IN ('mentioned','candidate','active','background','dormant','retired','dead')),
      agency_score REAL NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      current_scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL,
      last_active_tick INTEGER,
      promotion_reason TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scene_participants (
      scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      role TEXT,
      reason TEXT,
      joined_tick INTEGER NOT NULL,
      left_tick INTEGER,
      PRIMARY KEY(scene_id, actor_id)
    );
    CREATE TABLE IF NOT EXISTS story_thread_links (
      thread_id TEXT NOT NULL REFERENCES story_threads(id) ON DELETE CASCADE,
      linked_thread_id TEXT NOT NULL REFERENCES story_threads(id) ON DELETE CASCADE,
      relation TEXT NOT NULL CHECK(relation IN ('split','merged','depends_on','conflicts_with')),
      PRIMARY KEY(thread_id, linked_thread_id, relation)
    );
    CREATE TABLE IF NOT EXISTS chapter_events (
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('core','supporting','reference')),
      PRIMARY KEY(chapter_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS workflow_checkpoints (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      run_kind TEXT NOT NULL CHECK(run_kind IN ('tick','chapter','scene')),
      run_id TEXT NOT NULL,
      step TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      UNIQUE(run_id, step, input_hash)
    );
    CREATE TABLE IF NOT EXISTS projection_jobs (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      watermark_tick INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS book_foundations (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','confirmed')),
      foundation_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      UNIQUE(world_id, version)
    );
    CREATE TABLE IF NOT EXISTS story_compasses (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      compass_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, version)
    );
    CREATE TABLE IF NOT EXISTS story_engines (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      foundation_version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','confirmed','stale')),
      engine_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      UNIQUE(world_id, version)
    );
    CREATE TABLE IF NOT EXISTS reader_questions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planted',
      importance TEXT NOT NULL DEFAULT 'arc',
      question_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reader_revelations (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      chapter_id TEXT,
      question_id TEXT,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS character_decision_signatures (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      signature_json TEXT NOT NULL,
      author_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, actor_id, version)
    );
    CREATE TABLE IF NOT EXISTS story_engine_usage (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      engine_version INTEGER NOT NULL,
      tick INTEGER NOT NULL,
      conflict_pattern TEXT,
      escalation_axis TEXT,
      local_payoff INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, tick)
    );
    CREATE TABLE IF NOT EXISTS reader_comprehension_reviews (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL,
      review_json TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS volumes (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      title TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      UNIQUE(world_id, ordinal)
    );
    CREATE TABLE IF NOT EXISTS story_arcs (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      volume_id TEXT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      title TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      summary_json TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(volume_id, ordinal)
    );
    CREATE TABLE IF NOT EXISTS chapter_outlines (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      arc_id TEXT NOT NULL REFERENCES story_arcs(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      outline_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      UNIQUE(arc_id, ordinal)
    );
    CREATE TABLE IF NOT EXISTS evolution_contracts (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      volume_id TEXT,
      arc_id TEXT,
      chapter_outline_id TEXT,
      scene_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('draft','active','fulfilled','blocked')),
      contract_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, tick, id)
    );
    CREATE TABLE IF NOT EXISTS narrative_obligations (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      due_arc_id TEXT,
      planted_chapter_id TEXT,
      resolved_chapter_id TEXT,
      source_foundation_version INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chapter_reviews (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      chapter_id TEXT,
      run_id TEXT NOT NULL REFERENCES chapter_runs(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      review_json TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      average_score REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_intents (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      actor_id TEXT NOT NULL,
      intent_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposed',
      created_at TEXT NOT NULL,
      UNIQUE(world_id, tick, actor_id)
    );
    CREATE TABLE IF NOT EXISTS scene_beats (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      beat_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, tick, ordinal)
    );
    CREATE TABLE IF NOT EXISTS narrative_gate_reviews (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      review_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, tick)
    );
    CREATE TABLE IF NOT EXISTS writers_room_sessions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      contract_id TEXT NOT NULL,
      round INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'proposing',
      brief_hash TEXT NOT NULL,
      selected_proposal_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(world_id, tick, contract_id)
    );
    CREATE TABLE IF NOT EXISTS scene_proposals (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES writers_room_sessions(id) ON DELETE CASCADE,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      premise TEXT NOT NULL,
      proposal_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposed',
      created_at TEXT NOT NULL,
      UNIQUE(session_id, id)
    );
    CREATE TABLE IF NOT EXISTS writers_room_opinions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES writers_room_sessions(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      role TEXT NOT NULL,
      actor_id TEXT,
      proposal_id TEXT NOT NULL,
      opinion_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, round, role, actor_id, proposal_id)
    );
    CREATE TABLE IF NOT EXISTS writers_room_resolutions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES writers_room_sessions(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      resolution_json TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, round)
    );
    CREATE TABLE IF NOT EXISTS narrative_horizons (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      phase TEXT NOT NULL CHECK(phase IN ('exploration','development','convergence','finale')),
      horizon_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, version)
    );
    CREATE TABLE IF NOT EXISTS future_trajectories (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      horizon_version INTEGER NOT NULL,
      viability TEXT NOT NULL CHECK(viability IN ('possible','supported','endangered','ruled_out')),
      confidence REAL NOT NULL DEFAULT 0.5,
      trajectory_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mainline_health_reports (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      healthy INTEGER NOT NULL,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS state_conditions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      owner_kind TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      condition_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS state_deltas (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      contract_id TEXT NOT NULL,
      delta_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','published','discarded')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_transitions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      contract_id TEXT NOT NULL,
      base_state_hash TEXT NOT NULL,
      mainline_health_report_id TEXT NOT NULL,
      transition_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('proposed','validated','publishing','published','discarded')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(world_id, tick)
    );
    CREATE TABLE IF NOT EXISTS chapter_state_evidence (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      chapter_id TEXT,
      run_id TEXT NOT NULL,
      delta_id TEXT NOT NULL,
      quote TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      passed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(run_id, delta_id)
    );
    CREATE TABLE IF NOT EXISTS arc_snapshots (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      arc_id TEXT NOT NULL,
      ending_tick INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(world_id, arc_id)
    );
    CREATE TABLE IF NOT EXISTS trajectory_reviews (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      volume_id TEXT NOT NULL,
      review_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finale_contracts (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      horizon_version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','active','completed')),
      contract_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      tick INTEGER NOT NULL,
      foundation_version INTEGER NOT NULL,
      horizon_version INTEGER NOT NULL,
      outline_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK(status IN ('queued','running','blocked','completed','failed')),
      current_step TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      lease_owner TEXT,
      lease_expires_at TEXT,
      attempt INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(world_id, tick)
    );
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
      step TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed')),
      output_json TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      attempt INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(run_id, step, input_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_entities_world_type_v2 ON entities(world_id, type);
    CREATE INDEX IF NOT EXISTS idx_claims_world_subject ON claims(world_id, subject_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_holder ON knowledge_states(world_id, holder_type, holder_id, learned_at_tick);
    CREATE INDEX IF NOT EXISTS idx_transmissions_world_tick ON transmissions(world_id, tick);
    CREATE INDEX IF NOT EXISTS idx_events_world_tick ON events(world_id, tick);
    CREATE INDEX IF NOT EXISTS idx_scenes_world_tick ON scenes(world_id, tick);
    CREATE INDEX IF NOT EXISTS idx_threads_world_status ON story_threads(world_id, status);
    CREATE INDEX IF NOT EXISTS idx_actor_runtime_world_lifecycle ON actor_runtime(world_id, lifecycle);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON workflow_checkpoints(run_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_foundations_world_version ON book_foundations(world_id, version DESC);
    CREATE INDEX IF NOT EXISTS idx_story_engines_world_version ON story_engines(world_id, version DESC);
    CREATE INDEX IF NOT EXISTS idx_reader_questions_world_status ON reader_questions(world_id, status);
    CREATE INDEX IF NOT EXISTS idx_decision_signatures_actor ON character_decision_signatures(world_id, actor_id, version DESC);
    CREATE INDEX IF NOT EXISTS idx_contracts_world_tick ON evolution_contracts(world_id, tick DESC);
    CREATE INDEX IF NOT EXISTS idx_reviews_run_revision ON chapter_reviews(run_id, revision DESC);
    CREATE INDEX IF NOT EXISTS idx_writers_room_world_tick ON writers_room_sessions(world_id, tick);
    CREATE INDEX IF NOT EXISTS idx_scene_proposals_session ON scene_proposals(session_id, status);
    CREATE INDEX IF NOT EXISTS idx_writers_room_opinions_session ON writers_room_opinions(session_id, round);
    CREATE INDEX IF NOT EXISTS idx_horizons_world_version ON narrative_horizons(world_id, version DESC);
    CREATE INDEX IF NOT EXISTS idx_trajectories_world_viability ON future_trajectories(world_id, viability);
    CREATE INDEX IF NOT EXISTS idx_mainline_health_world_tick ON mainline_health_reports(world_id, tick DESC);
    CREATE INDEX IF NOT EXISTS idx_pending_transition_world_tick ON pending_transitions(world_id, tick);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status, lease_expires_at);
  `)
  const ensureColumn = (table: string, name: string, definition: string) => {
    const columns = database!.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === name)) database!.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
  }
  ensureColumn('events', 'narrative_purpose', 'TEXT')
  ensureColumn('events', 'contract_id', 'TEXT')
  ensureColumn('events', 'published_chapter_id', 'TEXT')
  ensureColumn('chapters', 'contract_id', 'TEXT')
  ensureColumn('chapters', 'generation_kind', "TEXT NOT NULL DEFAULT 'legacy_generation'")
  ensureColumn('chapters', 'content_hash', 'TEXT')
  ensureColumn('chapter_runs', 'tick', 'INTEGER')
  ensureColumn('chapter_runs', 'contract_id', 'TEXT')
  ensureColumn('chapter_runs', 'revision_count', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('chapter_runs', 'draft_path', 'TEXT')
  ensureColumn('reader_comprehension_reviews', 'chapter_id', 'TEXT')
  ensureColumn('book_foundations', 'constraint_version', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn('book_foundations', 'validation_issues', 'TEXT NOT NULL DEFAULT \'[]\'')
  ensureColumn('chapter_outlines', 'state_before_json', 'TEXT NOT NULL DEFAULT \'{}\'')
  ensureColumn('chapter_outlines', 'state_after_json', 'TEXT NOT NULL DEFAULT \'{}\'')
  ensureColumn('chapter_outlines', 'obligation_ids_json', 'TEXT NOT NULL DEFAULT \'[]\'')
  ensureColumn('chapter_outlines', 'constraint_version', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn('simulation_ticks', 'replan_count', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('simulation_ticks', 'block_reason', 'TEXT')
  ensureColumn('worlds', 'archive_status', "TEXT NOT NULL DEFAULT 'empty'")
  database.exec(`
    UPDATE chapter_outlines SET status='stale',outline_json=json_set(outline_json,'$.status','stale')
      WHERE status NOT IN ('completed','stale') AND json_type(outline_json,'$.horizonVersion') IS NULL;
    UPDATE chapter_outlines SET status='stale',outline_json=json_set(outline_json,'$.status','stale')
      WHERE status NOT IN ('completed','stale') AND (
        json_type(outline_json,'$.immediateGoal') IS NULL OR
        json_type(outline_json,'$.centralObstacle') IS NULL OR
        json_type(outline_json,'$.difficultChoice') IS NULL OR
        json_type(outline_json,'$.concretePayoff') IS NULL OR
        json_type(outline_json,'$.nextPressure') IS NULL OR
        json_type(outline_json,'$.engineFunction') IS NULL
      );
    UPDATE simulation_ticks SET status='blocked',block_reason='WORKFLOW_MIGRATION_REQUIRED'
      WHERE status NOT IN ('published','blocked') AND NOT EXISTS (
        SELECT 1 FROM workflow_runs WHERE workflow_runs.world_id=simulation_ticks.world_id AND workflow_runs.tick=simulation_ticks.tick
      );
  `)
  // One-time migration for databases created before the local fact ledger.
  // Copy first, then remove the obsolete graph/outbox tables in the same
  // process so fresh installs never recreate the old contract.
  const legacyEntities = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='graph_entities'").get()
  if (legacyEntities) {
    database.exec(`
      INSERT OR IGNORE INTO entities (id,world_id,type,name,aliases_json,properties_json,status,actionable,provenance_json,origin,created_at,updated_at)
        SELECT id,world_id,type,name,aliases_json,properties_json,status,actionable,provenance_json,
          CASE WHEN graph_layer='evolution' THEN 'simulation' ELSE 'source' END,created_at,updated_at FROM graph_entities;
      INSERT OR IGNORE INTO claims (id,world_id,subject_id,predicate,object_id,value_json,claim_scope,believer_id,valid_from,valid_until,confidence,provenance_json,origin,created_at)
        SELECT id,world_id,subject_id,predicate,object_id,value_json,claim_scope,believer_id,valid_from,valid_until,confidence,provenance_json,
          CASE WHEN graph_layer='evolution' THEN 'simulation' ELSE 'source' END,created_at FROM graph_facts;
      DROP TABLE IF EXISTS graph_facts;
      DROP TABLE IF EXISTS graph_entities;
    `)
  }
  database.exec(`
    UPDATE worlds SET archive_status='ready'
      WHERE archive_status='empty' AND (
        EXISTS (SELECT 1 FROM jobs WHERE jobs.world_id=worlds.id AND jobs.status='completed')
        OR EXISTS (SELECT 1 FROM entities WHERE entities.world_id=worlds.id)
      );
    UPDATE worlds SET archive_status='extracting'
      WHERE archive_status='empty' AND EXISTS (
        SELECT 1 FROM jobs WHERE jobs.world_id=worlds.id AND jobs.status NOT IN ('completed','failed')
      );
    UPDATE worlds SET archive_status='error'
      WHERE archive_status='empty' AND EXISTS (
        SELECT 1 FROM jobs WHERE jobs.world_id=worlds.id AND jobs.status='failed'
      );
    UPDATE scenes SET
      objective=COALESCE((SELECT COALESCE(json_extract(e.contract_json,'$.mainlineObjective'),json_extract(e.contract_json,'$.coreEvent')) FROM evolution_contracts e WHERE e.scene_id=scenes.id ORDER BY e.created_at DESC LIMIT 1),objective),
      conflict=COALESCE((SELECT json_extract(e.contract_json,'$.coreEvent') FROM evolution_contracts e WHERE e.scene_id=scenes.id ORDER BY e.created_at DESC LIMIT 1),conflict),
      entry_cause=COALESCE(entry_cause,(SELECT json_extract(e.contract_json,'$.causalPrerequisite') FROM evolution_contracts e WHERE e.scene_id=scenes.id ORDER BY e.created_at DESC LIMIT 1))
      WHERE status='active' AND (conflict='尚未形成明确冲突' OR length(objective)>300 OR objective LIKE '# %') AND EXISTS (SELECT 1 FROM evolution_contracts e WHERE e.scene_id=scenes.id);
    UPDATE scenes SET time_label='Tick ' || tick
      WHERE status='active' AND time_label LIKE '1970-%';
  `)
  database.exec(`DROP TABLE IF EXISTS outbox; INSERT OR REPLACE INTO schema_meta(key,value,updated_at) VALUES ('archive_schema','2',datetime('now')); INSERT OR REPLACE INTO schema_meta(key,value,updated_at) VALUES ('narrative_schema','2',datetime('now'));`)
  return database
}

export function closeDatabaseForTests(): void {
  database?.close()
  database = undefined
}
