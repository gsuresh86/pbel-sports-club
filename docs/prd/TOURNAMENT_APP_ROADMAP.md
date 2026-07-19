# PBEL Tournament App — Product Requirements Document

| Field | Value |
| --- | --- |
| Status | **Active — Phase 1** |
| Branch | `feat/tournament-app-roadmap` |
| Created | 2026-07-19 |
| Scope | Admin console + public tournament pages |
| Stack | Next.js App Router, Firebase Auth/Firestore/Storage, TanStack Query |

---

## 1. Vision

Make the tournament platform **safe for real participant data**, **reliable on event day**, and **clear for spectators and registrants** — without losing the workflows already built (registration, pools, scoring, brackets, finance).

## 2. Goals

1. **Trust** — PII, payments, and roles cannot be abused via public rules or open APIs.
2. **Integrity** — Registration counts, winners, schedules, and activity metrics match canonical data.
3. **Event-day ops** — Admins/referees can run a tournament from one operational surface.
4. **Spectator clarity** — Public pages show live, accurate fixtures/standings/results with good SEO and a11y.
5. **Sustainable delivery** — CI, tests, env templates, and docs keep changes shippable.

## 3. Non-goals (this roadmap)

- Full multi-club SaaS / custom domains / billing (Phase 6+ only if needed).
- Replacing badminton-first scoring with a full multi-sport rules engine in Phase 1–2.
- Rebuilding the entire UI design system from scratch.

## 4. Current product snapshot

### Admin (exists today)

- Global: dashboard, tournaments CRUD, users, leads, testimonials, settings, user-activity, legacy matches
- Per tournament: overview, registrations, players, T-shirts, teams, pools, spin assignment, match generation, scoring, results, finance, tournament users/roles

### Public (exists today)

- Home, tournament discovery, tournament detail tabs (fixtures/results/pools/teams/brackets/rules), registration, live score + TV scoreboard, schedules, winners, auth/profile, host-a-tournament / leads

### Known critical gaps (evidence-based)

| Area | Issue | Primary files |
| --- | --- | --- |
| Privacy | Registrations/players publicly readable & writable (PII + payment refs) | `firestore.rules` |
| AuthZ | Users can update own user doc (incl. role/permissions risk) | `firestore.rules` `/users` |
| APIs | `/api/create-user`, `/api/send-notification`, `/api/notify-registration` lack proper auth | `app/api/**` |
| Counts | Listing counts may use legacy top-level registrations | `app/tournament/page.tsx` |
| Activity | User Activity is not a real audit log | `app/admin/user-activity/page.tsx` |
| Hosting | Competing host funnels (mailto vs `/register` leads) | `HostTournamentForm.tsx`, `app/register` |
| Delivery | `npm test` runs only one suite; no CI/emulator rule tests | `package.json` |

---

## 5. Phased roadmap

Each phase should ship as **one or more PRs** against this branch (or short-lived child branches), with acceptance criteria checked off before moving on.

### Phase status legend

- `[ ]` Not started  
- `[~]` In progress  
- `[x]` Done  

---

### Phase 1 — Security & registration integrity

**Goal:** Stop data leaks and unauthorized privilege escalation; make registration trustworthy.

**Status:** `[~] In progress`

| ID | Work item | Impact | Effort | Status |
| --- | --- | --- | --- | --- |
| P1.1 | Lock down user self-update: forbid changing `role`, `tournamentPermissions`, `tournamentRoles`, `assignedTournaments`, `isActive` on own doc | Critical | S | `[x]` |
| P1.2 | Require Firebase ID token + admin role on privileged APIs (`create-user`, `create-admin`, `send-notification`, password/disable flows) | Critical | M | `[x]` |
| P1.3 | Secure `notify-registration`: auth or signed secret + transactional participant count | Critical | M | `[~]` |
| P1.4 | Make registration/player **PII private**; introduce public projection docs (`publicPlayers` / display fields) for names/photos used on fixtures | Critical | L | `[x]` |
| P1.5 | Scope tournament-admin writes by **assignment** (not global role alone) for teams/pools/finance/brackets where still loose | Critical | M | `[~]` |
| P1.6 | Storage rules: auth + ownership / staff role (no UI-only trust) | Critical | M | `[~]` |
| P1.7 | Server-side registration API: validate deadline, category, capacity, duplicates; return receipt code | High | L | `[~]` |
| P1.8 | Auth lifecycle: disable/delete Firebase Auth when admin deactivates/deletes user; implement password reset via Admin SDK | High | M | `[x]` |
| P1.9 | Firestore + Storage **emulator rule tests** for P1 rules | High | M | `[ ]` |
| P1.10 | App Check / basic rate limiting on public write endpoints | High | M | `[ ]` |

**Acceptance criteria**

- [x] Anonymous client cannot read email/phone/address/payment fields from registrations.
- [x] Signed-in public user cannot elevate own role via Firestore update.
- [x] Unauthenticated callers cannot create users or send FCM/notifications.
- [ ] Registration create goes through a validated API (or equivalent Cloud Function) with capacity + duplicate checks.
- [ ] Rule tests pass in CI or documented emulator script.
- [x] Public fixtures/teams still show **safe** display names/photos after lockdown.

**Dependencies / risks**

- Public pages currently load full registration docs — P1.4 must ship **with** UI consumers updated, or public brackets break.
- Decide count semantics: submitted vs approved vs unique players (document decision in §7).

**Exit:** Phase 1 complete when checklist above is green on staging.

---

### Phase 2 — Data consistency & delivery baseline

**Goal:** Canonical data paths + shippable engineering baseline.

**Status:** `[ ] Not started`

| ID | Work item | Impact | Effort | Status |
| --- | --- | --- | --- | --- |
| P2.1 | Finish legacy top-level `matches` / `liveScores` / `registrations` migration; remove or quarantine fallbacks | High | M | `[ ]` |
| P2.2 | Fix tournament listing participant counts (subcollection or aggregate counters) | High | S | `[ ]` |
| P2.3 | Derive/publish winners from finalized finals (or document curated-only policy) | High | M | `[ ]` |
| P2.4 | Fix or rename User Activity (real audit vs summary stats; fix `lastSeen`, registrations=0, legacy match queries) | Medium | M | `[ ]` |
| P2.5 | Safe tournament clone defaults: config/categories/rules only — not participants/results | High | M | `[ ]` |
| P2.6 | CI: typecheck, ESLint, **all** unit test files, production build | High | M | `[ ]` |
| P2.7 | Fix `npm test` to run all `lib/*.test.ts` suites | High | S | `[ ]` |
| P2.8 | `.env.example`, emulator docs, deploy runbook | Medium | S | `[ ]` |
| P2.9 | Route-level `loading` / `error` / `not-found` for key public + admin routes | Medium | M | `[ ]` |
| P2.10 | Error reporting (e.g. Sentry) beyond Vercel Analytics | Medium | S | `[ ]` |

**Acceptance criteria**

- [ ] Public tournament cards show correct participant counts.
- [ ] No production writes to legacy top-level match collections.
- [ ] CI green on every PR.
- [ ] Clone creates a usable empty edition without copying PII/results by default.

---

### Phase 3 — Admin event-day operations

**Goal:** One place to run match day without hunting across tabs.

**Status:** `[ ] Not started`

| ID | Work item | Impact | Effort | Status |
| --- | --- | --- | --- | --- |
| P3.1 | Event-day dashboard: live / delayed / upcoming, pending lineups, pending payments, registration exceptions | High | L | `[ ]` |
| P3.2 | Court conflict detection + schedule validation | High | L | `[ ]` |
| P3.3 | Bulk reschedule + conflict warnings | High | M | `[ ]` |
| P3.4 | Optimistic concurrency / version checks on live scoring | High | M | `[ ]` |
| P3.5 | Real audit log (role, finance, registration status, schedule, score) | High | L | `[ ]` |
| P3.6 | Payment reconciliation queue + receipt attachments | High | M | `[ ]` |
| P3.7 | Replace native `confirm()` with consistent destructive dialogs | Medium | S | `[ ]` |
| P3.8 | Wire header search + profile Settings (or remove stubs) | Medium | S | `[ ]` |
| P3.9 | Check-in, walkover, postpone, waitlist flows | Medium | L | `[ ]` |

**Acceptance criteria**

- [ ] Referee/admin can answer “what’s next on court X?” from dashboard in &lt; 10s.
- [ ] Two editors cannot silently overwrite scores without conflict UX.
- [ ] Sensitive admin actions leave an audit trail.

---

### Phase 4 — Public experience, communications & SEO

**Goal:** Spectators and players get live, trustworthy pages; hosts get one lead funnel.

**Status:** `[ ] Not started`

| ID | Work item | Impact | Effort | Status |
| --- | --- | --- | --- | --- |
| P4.1 | Real-time listeners for fixtures / standings / results (not only live score page) | High | M | `[ ]` |
| P4.2 | Registration receipt + status lookup (code/phone) + edit/withdraw policy | High | L | `[ ]` |
| P4.3 | “My matches” + add-to-calendar / share | High | M | `[ ]` |
| P4.4 | Consolidate host funnels (homepage form → leads API; deprecate mailto-only success) | High | M | `[ ]` |
| P4.5 | Approval/rejection + schedule notifications (email/WhatsApp/push) | High | L | `[ ]` |
| P4.6 | Unified schedules page filters (tournament, date, court, category); public-only | Medium | M | `[ ]` |
| P4.7 | Auto winners gallery from finalized results | Medium | M | `[ ]` |
| P4.8 | SSR/ISR public tournament pages + dynamic metadata | High | L | `[ ]` |
| P4.9 | Sitemap, robots, canonicals, SportsEvent structured data | Medium | M | `[ ]` |
| P4.10 | Consent/privacy copy for photos & minors | Medium | S | `[ ]` |
| P4.11 | Accessibility pass: headings, labels, reduced-motion, mobile bracket alternative | Medium | M | `[ ]` |

**Acceptance criteria**

- [ ] Public fixture list updates without full page refresh during live play.
- [ ] Player can look up registration status without admin help.
- [ ] One host-request path creates a `tournamentLeads` record.
- [ ] Tournament detail/fixture/result routes have unique titles/descriptions; sitemap lists public tournaments only.

---

### Phase 5 — Performance & maintainability

**Goal:** Scale to larger fields without N+1 Firestore cost explosions.

**Status:** `[ ] Not started`

| ID | Work item | Impact | Effort | Status |
| --- | --- | --- | --- | --- |
| P5.1 | Aggregate counters (`registrationCount`, `approvedCount`, etc.) maintained transactionally | High | M | `[ ]` |
| P5.2 | Paginate admin lists (registrations, players, matches) | High | M | `[ ]` |
| P5.3 | Split `TournamentDetailView` (~2k lines) by tab; lazy-load brackets | High | M | `[ ]` |
| P5.4 | Remove collection-wide scans for schedules / match-by-id resolution | High | M | `[ ]` |
| P5.5 | Re-enable selective Next image optimization | Medium | S | `[ ]` |
| P5.6 | Deduplicate Firestore path helpers / converters | Medium | M | `[ ]` |
| P5.7 | Refresh README to match Next 16 / Tailwind 4 architecture | Low | S | `[ ]` |

**Acceptance criteria**

- [ ] Opening public tournament list does not query one registration collection per card.
- [ ] Lighthouse / field metrics: meaningful LCP improvement on tournament detail.
- [ ] Admin match list remains usable at 500+ matches.

---

### Phase 6 — Scale & product expansion (later)

**Status:** `[ ] Backlog`

| ID | Work item | Notes |
| --- | --- | --- |
| P6.1 | Tournament templates & season/series model | Config clone + history archive |
| P6.2 | Automated conflict-free scheduler | Courts, rest time, availability |
| P6.3 | Participant accounts, team invites, roster approval | Consent-gated profiles |
| P6.4 | Finance statements & utilization analytics | Exportable reports |
| P6.5 | Multi-org tenancy, branding, domains, billing | Only if product strategy requires |
| P6.6 | Background jobs for exports, notifications, aggregates | Cloud Functions / queues |
| P6.7 | Backup/restore, retention, DR runbooks | Ops maturity |

---

## 6. Open product decisions (resolve during Phase 1–2)

| # | Decision | Options | Owner | Status |
| --- | --- | --- | --- | --- |
| D1 | What does “participant count” mean? | submitted / approved / unique players | Product | Open |
| D2 | Are winners curated or derived from finals? | curated / derived / hybrid | Product | Open |
| D3 | Single PBEL instance vs multi-club SaaS? | single / multi | Product | Open — blocks P6.5 |
| D4 | Public display of player photos? | always / opt-in / admin-only | Product/Legal | Open |
| D5 | Duplicate registration policy | block phone / block email / allow multi-category | Product | Open |
| D6 | Scoring rules per sport | badminton-only for now / pluggable engines | Product | Open |

---

## 7. Phase 1 implementation notes (active)

### Approach for PII lockdown (P1.4)

1. Add `tournaments/{id}/publicPlayers/{playerId}` (or denormalized fields on matches/teams) with only: `displayName`, `photoURL` (if consented), `teamId`, `category`.
2. Change public UI to read projections only.
3. Tighten `registrations` / `players` rules: create via API; read for assigned staff; no public list.
4. Deploy rules + client in the **same release**.

### Approach for API auth (P1.2–P1.3)

1. Shared helper: verify `Authorization: Bearer <Firebase ID token>` via Admin SDK.
2. Role checks against Firestore `users/{uid}`.
3. Move user create/disable/password to Admin Auth APIs (avoid client `createUserWithEmailAndPassword` on server with shared client SDK).

### Suggested PR sequence inside Phase 1

1. **PR-A** — API auth + user self-update rule lock (P1.1, P1.2, P1.3 partial) — **done**
2. **PR-B** — Public projections + registration/player rule lockdown + UI switch (P1.4, P1.5, P1.6) — **in progress on this branch**
3. **PR-C** — Server registration + receipt codes + capacity (P1.7, P1.10)
4. **PR-D** — Emulator rule tests + CI hook (P1.9)

### Phase 1 progress log

| Date | Change |
| --- | --- |
| 2026-07-19 | Created PRD; started PR-A |
| 2026-07-19 | P1.1: Firestore `users` create/update privilege lockdown; signup always `public` |
| 2026-07-19 | P1.2: `/api/create-user` uses Admin SDK + caller auth; `/api/create-admin` disabled; `/api/send-notification` requires staff |
| 2026-07-19 | P1.3 (partial): `/api/notify-registration` requires `registrationId`, idempotent `notifiedAt`, transactional `currentParticipants` increment |
| 2026-07-19 | P1.4: Added `publicPlayers` projections; public UI reads projections only; registration/player PII reads locked to staff |
| 2026-07-19 | P1.5 (partial): winners/brackets writes scoped via `canManageTournamentDocument` |
| 2026-07-19 | P1.6 (partial): Storage size/type limits; banners/logos require auth; participant photo anonymous create kept for registration UX |
| 2026-07-19 | Staff tournament console auto-syncs publicPlayers once per session; `/api/tournaments/[id]/sync-public-players` |
| 2026-07-19 | P1.8: `/api/users/[id]` PATCH/DELETE disables or deletes Firebase Auth; admin password updates via Admin SDK |
| 2026-07-19 | P1.7 (partial): `/api/tournaments/[id]/registrations` + registration-stats; public register page prefers server create |

---

## 8. Success metrics

| Metric | Baseline | Target after Phase 4 |
| --- | --- | --- |
| Public exposure of registration PII | Open read | Zero anonymous PII reads |
| Unauthenticated privileged API success | Possible | Blocked (401/403) |
| Event-day “next match” lookup time | Multi-page navigation | &lt; 10s from dashboard |
| Registration support tickets (“did I register?”) | High touch | Self-serve status page |
| CI gate on main | None / partial | Required green build + tests |

---

## 9. Tracking

Update the Status column in each phase table as work lands. When a phase exits, set its header status to `[x] Done` and move the Active marker to the next phase at the top of this doc.

**Active phase:** Phase 1 — Security & registration integrity  

**Next up:** P1.1 + P1.2 (PR-A)

---

## 10. References

- Types / model: `types/index.ts`
- Permissions: `lib/permissions.ts`
- Rules: `firestore.rules`, `storage.rules`
- Public tournament UI: `components/public/TournamentDetailView.tsx`
- Admin shell: `components/AdminLayout.tsx`, `app/admin/**`
- APIs: `app/api/**`
