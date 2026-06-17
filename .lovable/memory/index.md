# Project Memory

## Core
Bilingual (CAT default, ES). Premium minimalist aesthetic (Cormorant Garamond, dark greens/gold/cream). No emojis.
Stableford scoring. 3 fixed categories: Low HCP (≤15.4), High HCP (≥15.5), Female. (Senior category removed.)
Season score: sum of best 8 results. MASTER rounds = 1.25x points.
HCP is fixed to the first round played for category assignment, but round-specific HCP is used for points.
Picked-up balls display as '—', are excluded from total strokes, and count as Par + 4 for hole difficulty.

## Memories
- [Visual Identity](mem://style/identidad-visual) — Bilingual (CAT/ES), minimalist premium aesthetic, Cormorant Garamond, no emojis
- [Scorecard Visualization](mem://features/visualizacion-scorecard) — Complex scorecard UI rules, handicap dots, Stableford colors, picked-up balls
- [AI Field Management](mem://features/gestion-campos-ia) — AI extraction of par/hcp from URLs/PDFs/photos
- [Scoring Rules](mem://features/reglas-puntuacion) — Season scoring formula (best 8 rounds) and MASTER multiplier
- [Scoring Categories](mem://features/categorias-puntuacion) — Category thresholds and assignment rules
- [Match Tracking UI](mem://features/interfaz-seguimiento) — UI states for played vs pending matches, grouped by category
- [Results Import](mem://features/importacion-resultados) — Engine for GolfDirecto/Teeone, clears duplicates, consolidates multi-day
- [Excel Import](mem://features/importacion-excel) — Excel specifics: HPU column, alternate rows, empty cells as picked-up
- [AI News](mem://features/noticias-ia) — AI generator for CAT/ES news highlighting winners and birdies
- [Admin Match Management](mem://admin/gestion-jornadas) — Draft/Published states, 18-hole card UI for manual entry
- [Handicap Management](mem://features/gestion-handicaps) — Historical integrity of HCP per round vs last HCP in profile
- [Home Interface](mem://features/interfaz-home) — Top 5 players per category by total points, quick access links
- [Player Profile](mem://features/perfil-jugador) — Accordion UI for match history with Stableford totals
- [Player Stats](mem://features/estadisticas-jugador) — Averages for birdies/pars/bogeys, avg stableford, best score
- [Global Stats](mem://features/estadisticas-globales) — Top 10 rankings for best round, regularity, ranking rise, birdies
- [Course & Hole Analysis](mem://features/analisis-campos-hoyos) — Hole difficulty (picked-up = Par+4), name normalization
