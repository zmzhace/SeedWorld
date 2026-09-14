# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Long-form fiction writers who need to turn source material, world rules, and simulated character decisions into logically consistent chapters.

## Product Purpose

SeedWorld is a general-purpose long-form fiction workspace. It compiles work-specific facts and knowledge boundaries, lets characters and a writers room determine the next necessary story movement, and turns that approved movement into one reviewed chapter.

## Positioning

Each work owns a dynamic ontology. SeedWorld separates immutable source canon from evolving simulation facts and separates objective truth from public narrative and character belief.

## Operating Context

Authors create a work, organize source material in the setting library, verify secrets and character awareness, then generate the next chapter from the current story arc. Simulation and prose generation are one continuous operation; published Markdown is collected in the chapter library.

## Capabilities and Constraints

- Next.js web application with server-only model credentials.
- SQLite is the canonical world archive; no remote graph service is required.
- SQLite is the local structured store; chapters and source copies live under the per-world data directory.
- Source facts are never overwritten by generated story changes.
- Ontologies are work-specific and dynamic. No genre-specific entity types are platform constants.
- Every formal generation run corresponds to one reviewed chapter; historical manual compilation is retained only as legacy data.

## Evidence on Hand

- Existing SeedWorld simulation engine and interface.
- No testimonials, usage metrics, or marketing claims are established.

## Product Principles

- Preserve provenance for every extracted fact.
- Never give a character knowledge it cannot access.
- Prefer recoverable asynchronous work over hidden long-running requests.
- Introduce story information through viewpoint and action, not setting dumps.
- Keep platform mechanisms generic and put genre rules inside each world.

## Accessibility & Inclusion

Interactive surfaces must support keyboard operation, responsive layouts, reduced motion, and WCAG AA contrast.
