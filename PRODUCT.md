# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Long-form fiction writers who need to turn source material, world rules, and simulated character decisions into logically consistent chapters.

## Product Purpose

SeedWorld is a general-purpose novel simulation and writing workspace. It extracts a work-specific knowledge graph, simulates only what each actor can know and do, and compiles selected simulation events into editable chapters.

## Positioning

Each work owns a dynamic ontology. SeedWorld separates immutable source canon from evolving simulation facts and separates objective truth from public narrative and character belief.

## Operating Context

Authors create a world, upload or paste reference material, wait for graph extraction, verify information visibility, run ticks, and turn a selected tick range into Markdown chapters.

## Capabilities and Constraints

- Next.js web application with server-only model and Zep credentials.
- Zep Cloud is the graph extraction and remote graph service.
- SQLite is the local structured store; chapters and source copies live under the per-world data directory.
- Source and evolution graphs are separate. Source facts are never overwritten by simulation.
- Ontologies are work-specific and dynamic. No genre-specific entity types are platform constants.
- Manual chapter compilation is the default; automatic serialization is optional.

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
