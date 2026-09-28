# Mizan HSE — Project Plan

> **Follow the latest update of this context.**  
> The app is a **mobile-friendly, offline inspection system for multiple sites**, covering **hydrants, APAR, P3K, and safety patrols**, with **compliance dashboards** for management.

---

## 1. Vision and purpose

The app should help **HSE staff conduct audits and follow up findings**, while giving **HSE managers and management a clear view of risks, overdue actions, and improvement progress**.

### Core workflow

```
Plan audit → Complete checklist → Record findings → Assign actions → Verify closure → Report results
```

The main opportunity is to **capture answers, measurements, and photos once**, then automatically produce reports and management scores.

---

## 2. Scope decisions (latest)

| Decision | Status |
|---|---|
| Platforms | **Android and iPhone** for field work; **desktop web** for management |
| Connectivity | **Offline inspections in the first release** |
| Sites | **Multiple sites** |
| Modules | Three equipment inspection modules + a flexible safety patrol module |
| Follow-up | One shared findings and corrective-action system |
| Corrective-action verifier | **HSE Manager** verifies actions completed by the HSE Supervisor |
| Self-verification | **Not allowed** — the HSE Supervisor cannot verify their own corrective action |
| Inconsistency handling | Flag for review; **never silently correct** records |
| Scoring | Checklist compliance **and** inspection completion shown together |
| History | Corrective actions update **current verified condition**; they **do not rewrite** the original inspection score |

### Action owners

Findings often need someone in operations, maintenance, or another department to fix them. Two options were considered:

1. Give action owners limited app access to update their own actions.
2. Have HSE staff update everything on their behalf.

**First-release decision:** corrective actions are assigned to the **HSE Supervisor**. The HSE Supervisor completes the work and submits evidence; the **HSE Manager** verifies closure.

### Out of scope for v1

Leave these for later unless they become essential to the audit process:

- Incident reporting
- Permit-to-work
- Training records
- PPE inventory

Each adds a separate workflow and would make the first release harder to finish.

---

## 3. Roles and workflow

| Role | Responsibilities |
|---|---|
| **HSE Staff** | Conduct inspections, capture evidence, submit findings |
| **HSE Supervisor** | Receive findings, complete corrective actions, submit completion evidence |
| **HSE Manager** | Review corrective-action evidence, verify closure, or return it for further work |
| **Management** | View compliance scores, trends, and reports |

### Inspection / audit review

- Submit inspection
- Return for correction
- Approve

APAR reports today include **Dibuat Oleh**, **Diketahui Oleh**, and **Disetujui Oleh**. Make these approval roles **configurable by site**.

### Corrective actions

```
Open → In progress → Awaiting verification → Closed
```

- If the HSE Manager rejects the evidence, the action returns to **In progress**, with a reason.
- The HSE Supervisor **cannot verify their own corrective action**.
- Completing an action still requires **verification** before closure.
- Keep a record of **who changed each status**.

---

## 4. Starting feature set (audit platform)

| Area | Features | Main users |
|---|---|---|
| **Audit planning** | Schedule audits, select site or department, assign auditors, send reminders | HSE manager |
| **Digital checklists** | Reusable templates, sections, required questions, Yes/No/N/A or scored answers, comments | HSE staff |
| **Field inspections** | Mobile-friendly forms, photo evidence, autosave, draft audits, offline capability if sites have poor connectivity | HSE staff |
| **Findings & risk** | Record nonconformities, location, severity, supporting evidence, and recommended actions | HSE staff |
| **Corrective actions** | Assign a responsible person, set deadlines, track progress, attach completion evidence, flag overdue work | HSE staff and action owners |
| **Review & closure** | Review submitted audits, return them for correction, verify action evidence, approve or reject closure | HSE manager |
| **Dashboards** | Audit completion, open and overdue findings, high-risk issues, repeat findings, trends by site or department | HSE manager and management |
| **Reports & records** | Generate PDF reports, export data, search past audits, retain evidence and change history | All roles, based on access |

### First-version priority (platform)

1. **Users, roles, sites, and departments** — control who can view, submit, review, and close records.
2. **Checklist templates** — including template versions so edits don’t change historical audits.
3. **Audit execution** — answers, photos, comments, drafts, and submission.
4. **Findings and corrective actions** — ownership, deadlines, evidence, and status.
5. **Manager review and verified closure** — completing an action should still require verification.
6. **Basic dashboards and automatic PDF reports** — reduce manual reporting immediately.
7. **Reminders and activity history** — make follow-up and accountability easier.

---

## 5. Tailored first-release features (this operation)

This product is tailored around existing paper/PDF forms for **APAR, Hydrant, P3K, and Safety Patrol**.

| Feature | What it should do |
|---|---|
| **Sites and locations** | Organize inspections and equipment by site, building, floor, or area. |
| **Equipment register** | Give every hydrant, APAR, and P3K kit an equipment ID, location, inspection schedule, and inspection history. |
| **QR scanning** | Scan an equipment label to open its checklist and past findings. |
| **Four inspection templates** | Separate checklists for hydrants, APAR, P3K, and safety patrols, based on existing forms. |
| **Offline inspections** | Download assigned site data and checklists, complete inspections and capture photos without internet, then synchronize when connected. |
| **Findings and follow-up** | Turn failed checklist items into findings. Assign corrective actions to the HSE Supervisor with a deadline and completion evidence. |
| **Review and closure** | Track findings through open, in progress, awaiting verification, and closed. Keep a record of who changed each status. |
| **Inspection schedules** | Show upcoming, completed, missed, and overdue inspections by site and equipment type. |
| **Compliance dashboard** | Show scores by site, inspection type, and period, with access to the failed items behind each score. |
| **Reports** | Generate inspection reports with answers, photos, findings, and follow-up status; export to PDF or Excel. |

### Recommended first-release features (detailed)

1. **Site and equipment management**  
   Site → zone/area → equipment. Each asset gets a unique ID, optional QR label, location, and inspection history.

2. **Digital inspections**  
   Staff select or scan equipment, complete the relevant checklist, enter measurements, and attach photos. Keep **scheduled period** and **actual inspection date** separate.

3. **Offline operation**  
   Download assigned sites and templates before fieldwork. Save answers and photos locally, show pending uploads, retry synchronization, and flag conflicting edits without silently overwriting work.

4. **Findings and corrective actions**  
   Failed checks create findings assigned to the HSE Supervisor. Include deadline, progress, before/after evidence, and verification. If a patrol identifies an existing equipment problem, staff can **link it to the open finding** instead of duplicating it.

5. **Review and approval**  
   Support submission, return for correction, and approval. Configurable approval roles by site (Dibuat Oleh / Diketahui Oleh / Disetujui Oleh).

6. **Management dashboard**  
   Filter by site, month, and inspection type. Show checklist compliance, inspection completion, critical findings, overdue actions, and upcoming expiries.

7. **Automatic reports**  
   Generate monthly equipment reports, annual P3K matrix, and patrol photo reports directly from inspection records.

---

## 6. Source forms

The app needs **three equipment inspection modules** and a **flexible safety patrol module**, connected to **one findings and follow-up system**.

| Module | Current form | Features needed in the app |
|---|---|---|
| **APAR** | 20 equipment records, zones, expiry dates, checklist-card photos, CO₂ weighing photos, inspection photos, and three approval fields | Equipment register, digital checklist, expiry reminders, numeric CO₂ weight entry with photo evidence, and report approval |
| **Hydrant** | 8 hydrants checked across 6 components: box, fire hose, hose coupling, hose rack, nozzle, and valve/pillar | Component-level condition, missing-item status, remarks, photos, and findings linked to each hydrant |
| **P3K** | 21 supply items with required quantities and monthly results across a year | Each kit’s inventory, required versus actual quantities, expiry tracking, replenishment needs, and annual inspection history |
| **Safety patrol** | Photo observations covering both good conditions and problems | Add observations with photos, location, category, description, severity, and optional equipment links |

**Source files:**

- APAR: `tmp/pdfs/source/Inspeksi APAR Juni 2026.pdf`
- Hydrant: `tmp/pdfs/source/Checklist Hydrant  Bulanan September - ITJ JPM Dukuh Atas.pdf`
- P3K: `tmp/pdfs/source/Inspeksi Kotak P3K JPM Dukuh Atas - September 2026.pdf`
- Safety patrol: `tmp/pdfs/source/Safety Patrol Juni - ITJ JPM Dukuh Atas.pdf`

---

## 7. Inspection modules and checklists

### 7.1 APAR (fire extinguisher)

Operational **monthly visual inspection**. Servicing and technical testing remain **separate activities**. Manufacturer guidance supports checking pressure indications, leaks, dents, and corrosion ([Kidde inspection guidance](https://www.kidde.com/support/fire-extinguishers/service)).

**Header fields:** site, zone, equipment ID, APAR type, capacity, serial number, inspection period, actual inspection date, inspector.  
**Stored separately:** service dates and any manufacturer-specified expiry date.

#### Standard APAR checklist

| Inspection item | Expected condition |
|---|---|
| Equipment presence | APAR is present at its registered location |
| Access | Accessible and unobstructed |
| Identification and signage | Equipment ID and location sign are visible |
| Operating instructions | Label is present, readable, and facing outward |
| Cylinder condition | No visible corrosion, dents, leakage, or damage |
| Handle and lever | Present and visibly undamaged |
| Safety pin and seal | Present and intact |
| Hose/nozzle/horn | Present where applicable, visibly undamaged, and unobstructed |
| Pressure indicator | Within the manufacturer’s operating range, where fitted |
| Mounting or cabinet | Secure, accessible, and in good condition |
| Service status | Required service or testing is not overdue |
| CO₂ weight check | Where required, measured weight meets the equipment-specific acceptance criteria |

**CO₂ weighing:** record measured weight, reference weight, units, and weighing photo. **Do not** apply one universal weight threshold to every model.

**Answers:** Pass / Fail / N/A.

- Reasons required for N/A.
- Notes plus evidence for failures.
- Missing equipment has a **dedicated outcome** so staff don’t need to answer every component question.

**Note:** APAR checklist questions on the source PDF are embedded in small photos and are not reliably readable. A blank checklist or a clear close-up would let us reproduce them more accurately. Until then, this standard operational checklist is the agreed template.

### 7.2 Hydrant

Eight hydrants checked across six components:

| # | Component |
|---|---|
| 1 | Box hydrant |
| 2 | Fire hose |
| 3 | Hose coupling |
| 4 | Hose rack |
| 5 | Nozzle |
| 6 | Valve / pillar hydrant |

Capture component-level condition, missing-item status, remarks, photos, and findings linked to each hydrant.

### 7.3 P3K (first aid kit)

21 supply items with required quantities and monthly results across a year. Track required versus actual quantities, expiry, replenishment needs, and annual inspection history.

| # | Supply item | Required qty |
|---|---|---|
| 01 | Kasa steril terbungkus | 20 |
| 02 | Perban 5 cm | 2 |
| 03 | Perban 10 cm | 2 |
| 04 | Plester 1,25 cm | 2 |
| 05 | Plester cepat | 10 |
| 06 | Kapas 25 gram | 1 |
| 07 | Kain segitiga / mittela | 2 |
| 08 | Gunting | 1 |
| 09 | Peniti | 12 |
| 10 | Sarung tangan sekali pakai | 2 |
| 11 | Masker | 2 |
| 12 | Pinset | 1 |
| 13 | Lampu senter | 1 |
| 14 | Gelas untuk cuci mata | 1 |
| 15 | Kantong plastik bersih | 1 |
| 16 | NaCl | 1 |
| 17 | Povidone | 1 |
| 18 | Alkohol 70% | 1 |
| 19 | Buku panduan P3K | 1 |
| 20 | Buku catatan | 1 |
| 21 | Daftar isi kotak | 1 |

Expiry tracking is especially relevant for items that expire (for example items 1, 16, 17, 18).

### 7.4 Safety patrol

Photo observations covering both good conditions and problems.

Each observation: photos, location, category, description, severity, and optional equipment links.

The patrol report is a collection of observations, so it **does not yet provide a reliable denominator for a compliance percentage**. Add a **standard patrol checklist for scoring**, while keeping **free-form observations** available.

#### Proposed baseline patrol checklist (for scoring)

| # | Check item |
|---|---|
| 01 | Emergency equipment accessible |
| 02 | Escape routes and exits clear |
| 03 | Housekeeping / 5R satisfactory |
| 04 | No visible unsafe cables or electrical conditions |
| 05 | Waste stored in the designated area |
| 06 | Safety signs visible and legible |

Free-form observations remain available in addition to this checklist.

---

## 8. Compliance scoring

Keep these measures **separate**:

| Measure | Proposed calculation or display |
|---|---|
| **Checklist compliance** | Passed applicable items ÷ total applicable items × 100%. Exclude N/A answers. |
| **Inspection completion** | Completed inspections ÷ scheduled inspections × 100%. |
| **Critical findings** | Open critical findings displayed prominently beside the score. |
| **Corrective-action progress** | Open, overdue, and verified closed actions. |
| **Site comparison** | Compare sites over the same period, showing inspection counts alongside scores. |

### Scoring rules

- **An uninspected asset must not count as compliant.** Showing inspection completion beside compliance prevents a site with very few inspections from appearing stronger than it really is.
- Missing, expired, and below-standard results count as **failures**.
- N/A requires a reason; unanswered required checks **prevent submission**.
- Weights may be finalized after further form review if some items need different weights.
- Corrective actions should improve the **current verified condition**, without rewriting the original inspection score. This preserves an honest history.
- Management scores use **synchronized, approved inspection records** and display **coverage** and **last-update time**.

---

## 9. Data integrity — inconsistency flags

Some source dates need validation: the APAR report shows a May period with a June inspection date, and the P3K form contains an apparent year typo. The app should flag inconsistencies for review.

| Trigger | App behavior |
|---|---|
| Inspection period differs from actual inspection month | Ask for an explanation; allow legitimate late inspections |
| Future inspection date or suspicious device time | Flag for review and retain device and synchronization timestamps |
| Duplicate equipment inspection for the same period | Flag potential duplication; allow a linked reinspection |
| “Pass” conflicts with entered measurement or overdue service date | Require correction or documented review |
| Equipment ID and selected site do not match | Ask staff to confirm the asset or location |
| Two offline users edit the same record | Preserve both versions and send the conflict for resolution |
| Required answer or evidence is missing | Save as draft; prevent final submission |

Flags appear in a **Review queue**, with the reason, reviewer, resolution, and change history. The app should **never silently correct** inspection records.

---

## 10. Platforms, devices, and offline

### Experience

| Surface | Capabilities |
|---|---|
| **Android and iPhone** | Inspections, QR scanning, photos, offline drafts, and synchronization |
| **Desktop web dashboard** | Site comparisons, compliance scores, review queues, corrective actions, and reports |

### Visible sync status

Staff should see whether an inspection is:

- **Saved on the device**
- **Waiting to sync / pending upload**
- **Successfully synchronized**
- **Needs attention**

Photos must synchronize too. Reconnecting must **not create duplicate inspections**. Conflicting edits are never silently overwritten.

### Offline (first release)

- Download assigned sites and templates before fieldwork.
- Complete inspections and capture photos without internet.
- Retry synchronization.
- Flag conflicting edits without silently overwriting work.

---

## 11. Questions used to tailor the product

These questions shaped the scope:

- Which audits are performed today? (routine workplace inspections, contractor audits, internal HSE system audits, or equipment inspections)
- Are there existing paper or Excel checklists the app should follow?
- One site or multiple sites, and do staff need to work without internet?
- Who fixes audit findings, and who has authority to approve closure?
- What does management want to see most: risk exposure, compliance scores, overdue actions, site comparisons, or monthly progress?

**Resolved for this operation:**

- Audits: **hydrants, APAR, P3K, and safety patrols**
- Existing forms: **four PDFs** (see section 6)
- Coverage: **multiple sites**, **offline required**
- Fix + close: **HSE Supervisor** completes actions; **HSE Manager** verifies
- Management view: **compliance, completion, critical findings, overdue actions, site comparison**

### Remaining / still useful to confirm

1. **Frequency:** How often is each inspection required, and does this vary by site?
2. **APAR wording:** A blank checklist or clear close-up of the card photos would confirm exact question text.
3. **Date quirks in source PDFs:** keep flagging; do not auto-fix.
4. **Patrol scoring:** baseline checklist is proposed so patrols can produce a percentage; free-form observations stay.

---

## 12. First-release scope (locked)

Defined first-release scope:

- Four inspection modules
- Multi-site equipment registers
- Offline mobile use (Android and iPhone)
- Corrective actions with Manager verification
- Data review / inconsistency flags
- Compliance dashboards
- Automatic reports

---

## 13. Technical architecture (Next.js + Neon + Vercel)

This section describes the app as it exists in this repository.

### Stack

| Component | Technology |
|---|---|
| **App framework** | Next.js 15 (App Router), deployed to **Vercel** |
| **Database** | **Neon** Postgres via `@neondatabase/serverless` |
| **Frontend** | Field PWA: vanilla JS (`public/app.js`) + IndexedDB offline queue |
| **Offline caching** | Service Worker (`public/sw.js`) |
| **Auth** | PBKDF2 password hashing, HttpOnly `mizan_session` cookie (SameSite=Strict) |

### Project structure

```
Apps Mizan K3/
├── PLAN.md
├── package.json
├── next.config.ts
├── vercel.json
├── .env.example
├── src/app/          # Next.js UI shell and /api routes
├── src/lib/          # Neon schema, auth, inspection operations
└── public/           # PWA assets (app.js, styles, service worker)
```

### Neon tables

`users`, `sessions`, `sites`, `assets`, `inspections`, `findings`, `flags`, `activity`, `operations`, `workspace_meta`

Schema and demo seed run automatically on the first API request if the database is empty.

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check and schema ensure |
| GET | `/api/session` | Validate current session |
| GET | `/api/state` | Fetch workspace state for the PWA |
| POST | `/api/login` | Authenticate and create session |
| POST | `/api/logout` | End session |
| POST | `/api/operations` | Apply a mutation (idempotent by operation ID) |

### Frontend pages

Overview, Inspections, Equipment, Corrective actions, Review queue, Reports, Sync center, Settings.

### Supported operations

| Operation | Allowed roles | Description |
|---|---|---|
| `create_inspection` | Staff, Manager, Supervisor | Submit a completed inspection |
| `review_inspection` | Manager, Supervisor | Approve or return a submitted inspection |
| `finding_action` | HSE Supervisor (internal `manager` ID: start/complete), HSE Manager (internal `supervisor` ID: verify/reject) | Progress corrective actions |
| `resolve_flag` | Manager, Supervisor | Document resolution of a data flag |
| `create_asset` | Manager, Supervisor | Register new equipment |

### Local development

1. Create a Neon project and copy the connection string.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL`.
3. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (required) |
| `MIZAN_DEMO_PASSWORD` | Override demo password (default `MizanDemo2026!`) |
| `MIZAN_SECURE_COOKIE` | Set to `1` to force the cookie `Secure` flag |

### Deploy on Vercel

1. Import this project in Vercel (framework: Next.js).
2. Add `DATABASE_URL` from Neon (and optionally `MIZAN_DEMO_PASSWORD`).
3. Deploy. Sign-in or `/api/health` creates tables and demo data.

Demo accounts: `staff`, `manager`, `supervisor`, `management` — password `MizanDemo2026!` unless overridden.

---

*Last updated: 2026-09-26 — Next.js + Neon on Vercel.*
