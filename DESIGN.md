---
name: SeedWorld
description: A warm editorial control room for building, simulating, and writing internally consistent fictional worlds.
colors:
  ink: "#171717"
  ink-home: "#161616"
  paper: "#f6f5f1"
  surface: "#ffffff"
  surface-soft: "#f8f7f3"
  surface-band: "#eeece6"
  line: "#d8d6cf"
  line-strong: "#bdbab1"
  text-muted: "#6c6a63"
  text-quiet: "#77746d"
  seed-orange: "#ed5a29"
  seed-orange-soft: "#fff3ee"
  success: "#3d8b61"
  success-soft: "#eff8f2"
  danger: "#b92c24"
  danger-soft: "#fff1ef"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(46px, 6.2vw, 86px)"
    fontWeight: 750
    lineHeight: 0.98
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(38px, 5vw, 68px)"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.05em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "18px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "normal"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  none: "0"
  status: "50%"
  seed: "10px 10px 10px 2px"
spacing:
  xs: "5px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  page-gutter: "clamp(20px, 4vw, 64px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 13px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.seed-orange}"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "34px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "11px 12px"
  badge:
    backgroundColor: "{colors.surface-band}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "5px 7px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "18px"
---

# Design System: SeedWorld

## Overview

**Creative North Star: "The Editorial Control Room"**

SeedWorld is an Operate-mode interface: it helps a writer inspect evidence, verify boundaries, advance a simulation, and compile results. Its visual world combines the warmth of an editorial desk with the precision of a technical console. Warm paper, near-black type, thin rules, compact metadata, and one vivid seed-orange accent make dense state legible without turning the workspace into a generic enterprise dashboard.

The system is expressive through proportion and structure rather than decoration. Large, tightly tracked headlines introduce a world; once inside the workspace, the typography becomes compact and instrument-like. The persistent graph/workbench split makes the product's core model visible: world evidence on the left, the current operation on the right.

**Key Characteristics:**

- Warm off-white canvases and white working surfaces separated by one-pixel neutral rules.
- Sharp editorial grids, square controls, and dense but clearly grouped operational information.
- Near-black primary actions that turn orange on hover; orange also marks focus, selection, progress, and the seed symbol.
- Inter for readable Chinese/Latin interface text, paired with a system monospace stack for IDs, counts, stages, and provenance labels.
- Minimal motion: short state transitions, one-pixel press movement, and functional progress rotation or pulse only.

**The Evidence Before Ornament Rule.** The interface should feel like a trustworthy instrument for provenance and simulation state. Decoration never competes with graph relationships, logs, stage status, or chapter content.

## Colors

The palette is warm, low-chroma, and mostly neutral; seed orange is the sole interface accent, while green and red are reserved for semantic status. The graph may use a broader categorical palette so entity types remain distinguishable, but those colors do not become general UI accents.

### Primary

- **Seed Orange:** Signals focus, active stages, running work, selected rows, directional arrows, and primary-action hover. It should remain sparse enough to preserve urgency.

### Neutral

- **Editorial Ink:** Primary text, filled buttons, active segmented controls, and dark console bands.
- **Warm Paper:** The application canvas and the stable background behind working surfaces.
- **White Surface:** Forms, toolbars, cards, active tabs, detail overlays, and inspector surfaces.
- **Soft Canvas:** Graph, event-list, and low-emphasis content backgrounds.
- **Utility Band:** Stage navigation, section bars, upload zones, and other secondary structural bands.
- **Warm Rule:** The default one-pixel border and divider used to expose the grid.
- **Muted Copy:** Supporting prose, descriptions, secondary metadata, and inactive navigation.

### Secondary

- **State Green:** Completed stages, ready/synchronized indicators, and successful results only.
- **State Red:** Failed synchronization, validation errors, and destructive/error messaging only.

**The One Orange Rule.** Orange marks a meaningful action or state; it is not a fill color for large surfaces and does not coexist with a competing general-purpose blue accent.

**The Semantic Color Rule.** Green means ready, complete, or healthy. Red means failed or invalid. Graph-category colors identify entity types and must not imply interface state.

## Typography

**Display Font:** Inter (with sans-serif fallback)  
**Body Font:** Inter (with sans-serif fallback)  
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, monospace

**Character:** Inter carries both literary calm and operational clarity across Chinese and Latin content. Tight display tracking creates an editorial voice; the small monospace layer distinguishes machine state, IDs, counts, graph layers, and provenance from authored prose.

### Hierarchy

- **Display** (750, fluid 46–86px, 0.98 line-height): Home and library statements only, generally held to two deliberate lines.
- **Headline** (750, fluid 38–68px, 1 line-height): Creation-page introductions and major entry moments.
- **Title** (750, 18px, 1.2 line-height): Workspace panels and major operational sections; library section titles may rise to 28px.
- **Body** (400, 13px, 1.8 line-height): Product explanation and longer guidance. Workbench descriptions become denser at 11px with up to 72 characters per line; compiled chapter text uses 13px at 1.95 and a 74-character measure.
- **Interface** (650–750, 10–13px): Buttons, field labels, row titles, tabs, and compact navigation.
- **Label** (600–700, 8–11px, 0.05–0.13em tracking): Uppercase English metadata, sequence numbers, graph layers, tick counts, IDs, and API/source labels.

**The Two Registers Rule.** Human-facing prose and actions use Inter; machine state and provenance use monospace. Do not render whole reading passages or primary Chinese actions in monospace.

**The Wide Headline Rule.** Display copy is large, tightly tracked, and intentionally line-broken. It should not collapse into a narrow stack of many short lines.

## Layout

Public and creation surfaces use centered editorial frames: the home and library cap at 1480px, the full creation form at 1320px, and side gutters scale fluidly from 20px to 64px. The home hero is a two-column composition with a generous gap: narrative on the left, creation console on the right. The pipeline and library use gapless, rule-divided grids rather than floating cards.

The home creation surface is a world-seed manuscript rather than a system console: a folio number, orange bookmark, ruled writing field, and source-material shelf make the action feel native to authorship while preserving operational clarity. The world workspace fills the viewport (`100dvh`) and prevents page-level scrolling. A fixed 62px header, 54px five-stage rail, flexible workspace body, and 52px footer form the vertical frame. When the graph is open, the body splits into `minmax(360px, 0.92fr)` for the graph and `minmax(480px, 1.08fr)` for the workbench, separated by a single vertical rule. Each side owns its scrolling and overflow.

At 980px, the public hero becomes one column and the five-step pipeline becomes two columns. At 900px, the workspace becomes a single pane: opening the graph shows the graph and hides the task column; closing it returns to the workbench. Stage labels shorten and the footer is removed. Below 620px, library and statistics grids collapse to one column, workbench gutters tighten from 18px to 10px, nonessential system logs disappear, and safe-area bottom padding is respected. Creation switches from main-plus-340px-sidebar to a single flow below 820px.

Spacing is intentionally compact inside operational surfaces. Repeating increments are 5px, 8px, 12px, 18px, and 24px; large public-page gaps and paddings use fluid clamps. Structural adjacency matters more than air: related cards share borders, rows meet edge-to-edge, and section bars sit directly on their content.

**The One-Pane Mobile Rule.** The graph and workbench do not squeeze side by side below 900px. Preserve each tool at usable width and let the graph toggle choose the active pane.

**The Gapless Ledger Rule.** Repeating operational records form continuous ruled lists or grids. Do not break event rows, stage cards, metrics, or worlds into isolated floating tiles.

## Elevation & Depth

The system is flat by default. Depth comes from surface tone, borders, adjacency, and the graph/workbench division. Shadows appear only on objects that genuinely sit above the plane: the home creation console uses a broad, faint ambient shadow; graph and ontology detail overlays use a tighter floating shadow. Active rows and cards use an inset 2px orange rule rather than lift.

### Shadow Vocabulary

- **Console lift** (`0 18px 50px rgba(47,44,35,.09)`): The home creation console, separating the primary action surface from the paper canvas.
- **Inspector float** (`0 12px 35px rgba(38,35,27,.12)`): Graph details floating over the canvas.
- **Overlay float** (`0 14px 38px rgba(40,37,29,.12)`): Ontology details temporarily layered above workbench cards.
- **Active inset** (`inset 2px 0 #ed5a29`): Selected event rows and the currently active workbench step.

**The Flat Until Floating Rule.** Standard cards, metrics, rows, toolbars, and navigation never receive ambient shadows. A shadow means the object overlaps another plane.

## Shapes

SeedWorld's dominant form is the square rectangle. Inputs, buttons, badges, stage tabs, cards, metric cells, and detail panels use zero corner radius and one-pixel borders. Dashed borders indicate file-drop affordances. The main rounded exceptions are tiny semantic dots, graph nodes, spinners, and the organic seed mark; their curvature communicates status, topology, or identity rather than softness.

The brand mark is a small orange leaf/seed silhouette with three rounded corners, one tighter corner, and a 35-degree rotation. Icons are Lucide-style outlines, typically 13–18px with restrained stroke weight. They support labels and state rather than serving as decorative illustrations.

**The Sharp Tool Rule.** Operational containers remain square. Do not apply blanket rounded cards or pill-shaped buttons to make the interface friendlier.

## Components

### Buttons

- **Shape:** Square, one-pixel border, compact horizontal padding; operational buttons are usually 32–42px high, while creation actions rise to 48–54px.
- **Primary:** Near-black fill with white text and a matching near-black border. The label is firm, compact, and often paired with a 15–18px outline icon.
- **Hover / Focus / Active:** Hover changes the fill and border to seed orange. Keyboard focus uses a 2px orange outline or a 2px translucent orange focus halo, depending on the surrounding surface. Active press moves down by 1px. Transitions run 150–200ms with standard ease.
- **Secondary:** White or transparent fill with an ink label and warm rule border. Hover strengthens the border or adds a white surface; footer navigation may shift its text and border to orange.
- **Disabled:** Dusty neutral fill and border with quiet text, no hover reaction, and a not-allowed cursor; navigation-only disabled controls may instead use 35% opacity.

### Chips

- **Style:** Square micro-labels with a one-pixel warm border, soft neutral fill, 5–8px padding, and 8–9px label or monospace text.
- **State:** Active/processing chips invert to orange with white text; success chips use a pale green surface and green text. Clickable entity tags shift to an orange-tinted surface and orange-brown text on hover.

### Cards / Containers

- **Corner Style:** Square with no radius.
- **Background:** White for active working surfaces; warm paper or soft canvas for passive/completed surfaces.
- **Shadow Strategy:** Flat and border-defined unless the container is a true overlay.
- **Border:** One-pixel warm rule; adjacent workbench cards share edges by dropping intermediate bottom borders.
- **Internal Padding:** 18px is the standard card inset; dense rows use 11–14px; public world rows use about 20–22px.
- **Active State:** A 2px inset orange rule on the leading edge, optionally paired with a white surface.

### Inputs / Fields

- **Style:** White or near-white fill, square corners, one-pixel warm-gray stroke, 11px by 12px inset, inherited Inter text, and muted placeholders. Textareas resize vertically.
- **Focus:** Orange border plus a subtle 2px translucent orange halo; focus is never communicated by color alone on the public and creation surfaces.
- **Error / Disabled:** Error blocks use a pale red surface, red-brown text, and a red-tinted border. Disabled inputs and actions mute toward the dusty neutral scale.
- **Upload:** A full-width dashed container with centered label/icon pairing; drag or hover changes its border to orange and its background to pale orange.

### Navigation

- **Public navigation:** A 60–68px ruled header with the seed mark and wide-tracked wordmark. Actions are compact, transparent controls that gain a white surface and border on hover.
- **Workspace header:** A 56–62px three-part grid for brand, world identity, and graph/sync controls. Long world titles truncate; the monospace ID and tick remain secondary.
- **Stage rail:** Five equal-width cells separated by rules. The active stage turns white and gains a 2px orange underline; completed stages use green. Mobile replaces full names with short labels and may hide icons below 520px.

### Graph / Workbench Split

The graph is a persistent evidence surface, not a decorative visualization. Its toolbar contains the node/edge count, Source/Evolution layer switch, refresh, and pane toggle. The canvas stays warm and low-contrast so colored nodes and relationships lead; a compact legend sits at the bottom and a floating inspector opens over the canvas.

The workbench is the operational half of the pair. It uses stacked, ruled step cards, compact state badges, numeric metric grids, ledger rows, and a dark fixed-height system log. Content scrolls inside the pane while the workspace frame remains fixed. Selection and active phase are consistently shown with the orange leading rule.

### Status & Feedback

Ready/completed uses green, processing uses orange with a pulse or rotation, and error uses red. Empty states center a thin outline icon above a short title and one restrained explanatory line. Progress feedback names the current real operation; it does not hide long-running work behind an indefinite generic loader.

Motion must respect `prefers-reduced-motion`: spinners, pulses, shimmers, and transitions collapse to effectively static behavior.

## Do's and Don'ts

### Do:

- **Do** build Operate surfaces from square, adjoining regions separated by one-pixel warm rules.
- **Do** reserve seed orange for focus, live progress, active selection, meaningful arrows, and primary-action hover.
- **Do** use monospace labels for ticks, IDs, counts, graph layers, pipeline indices, and provenance.
- **Do** keep graph state visible beside the active task on desktop and preserve each as a full-width pane on mobile.
- **Do** distinguish Source from Evolution and objective state from character knowledge with explicit labels, not color alone.
- **Do** provide visible keyboard focus, disabled, loading, empty, success, and error states, and honor reduced-motion preferences.
- **Do** let large editorial type introduce a world, then reduce scale and density inside the working console.

### Don't:

- **Don't** turn the shipped warm ink/paper/orange system into a blue/slate SaaS dashboard.
- **Don't** add default rounded cards, pill buttons, gradients, glass effects, or decorative shadows to operational surfaces.
- **Don't** use the graph's categorical node colors as general interface accents or semantic status colors.
- **Don't** squeeze graph and workbench into unusably narrow side-by-side columns below the 900px breakpoint.
- **Don't** float repeated records as disconnected cards; preserve continuous ledgers, rails, and ruled grids.
- **Don't** animate for atmosphere. Keep motion short, functional, and removable under reduced-motion settings.
- **Don't** allow decorative copy or oversized chrome to obscure provenance, current stage, synchronization state, or the next available action.
