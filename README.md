# Cantu Pricing Model — HTML version

A browser implementation of **Cantu Pricing Model 07222026.xlsx**, built to the `Spec – …` tabs
in that workbook.

Open `index.html` in any modern browser. No server, no build step, no network access — it is a
single self-contained file that works offline and can be emailed or dropped on a share.

---

## Parity with the workbook

The calc engine reproduces **all 26 output cells** of the `Cantu` tab exactly, plus the
`Offer File`, `SOFR Interpolation` and `BD Dates` derivations. The suite sits at the foot of
**Settings → Spec & traceability** — press *Run tests* — and runs on every load whether or not anyone
opens it, which is the only regression net a single emailed file can carry.

**169 assertions**, each labelled with its source. 63 tie to a workbook artifact (47 `Cantu` cells,
9 `SOFR Interpolation`, 5 `BD Dates`, 2 `Offer File`); the rest cover behaviour the workbook never had —
decimal invariants and the `pow`/`ln`/`exp` primitives, both discount conventions, calendar edits and
estimate handling, multi-invoice aggregation, the supplier CSV parser, curve interpolation and
`putCurve` merges, and the v1 → v2 migration.

| | Workbook | This app |
|---|---|---|
| Pro Forma Total (B23) | $880,625.97 | $880,625.97 |
| TradeCo Total (B36) | $880,717.21 | $880,717.21 |
| IAA Purchase Price (B47) | $853,302.69 | $853,302.69 |
| Payment to Cantu Supplier (B51) | $850,000.00 | $850,000.00 |
| Payment to Cantu — Agency Fee (B52) | $440.36 | $440.36 |
| Payment to TradeCo (B53) | $2,862.33 | $2,862.33 |

Arithmetic is **fixed-point decimal** (BigInt, 20 dp) rather than floating point, as
*Spec – Overview §6* requires. Rounding to 2 dp happens only at the presentation and
document-generation boundaries. `price(inputs, rateQuote)` is pure — no I/O, no DB, no clock reads —
which is what makes the golden-master tests meaningful.

## Navigation

A trade belongs to a deal, so it is a drill-down from one rather than a tab of its own. There are two
top-level tabs — **Deals & Trades**, where the work happens, and **Settings**, a menu of everything the
work reads from. The page header carries no deal or trade controls at all.

**Deals** is the landing tab. Click any deal row to select it and *Trades on this deal* below updates to
that deal's trades. Row actions are **Configure** and **Delete**; the configuration panel opens on the
right only when Configure is clicked, closes from its own button, and always shows whichever deal is
selected.

### Settled vs. outstanding, per deal

Each deal row splits its book across four columns — **Settled**, **Settled value**, **Not settled** and
**Not settled value** — so the count of trades and the money they carry are both readable per deal
without opening anything. Value is the **IAA Purchase Price (B47)** of each trade, the same figure the
trade list shows, summed in the deal's own currency.

- *Settled* is the SETTLED state. *Not settled* is everything still live: DRAFT, PRICED, APPROVED, ISSUED.
- **Cancelled trades are on neither side.** A cancelled trade will never settle, so counting it as
  outstanding would overstate what is still to come; it is tallied beside the outstanding count as
  `n cancelled` so the row still reconciles against the deal's full trade list.
- A trade that cannot be priced right now — no base-rate curve published on or before its Trade Submission Date, or
  inputs that do not compute — is counted but adds no money, and says so as `+n not priced` rather than
  being silently read as zero.

A footer row totals the whole book. Money there is listed one currency at a time: this model holds no FX
rate, so a BRL total and a USD total are never added into a single number.

**Open** on a trade raises the **trade workspace** — a full overlay carrying everything specific to that
trade:

- a header with the trade identifier, its deal, the state badge, and every trade action (Price, Approve,
  Issue, Mark settled, Cancel, Duplicate, New version, Edit deal configuration);
- a **Pricing** pane — the deal's configuration read-only, the trade's own fields, the five panels and the
  validation / rate-quote / business-day / summary rail;
- an **Offer File** pane, since the Offer File describes one trade and belongs with it.

Close it with the Close button, `Esc`, or a click on the backdrop. It is an in-page overlay rather than a
real browser window: a popup would be blocked by default and could not share state with the page.

## Deleting deals

**Delete** on a deal row removes the deal and its trades outright, after a confirmation and a mandatory
reason. It is refused if any trade has reached APPROVED, ISSUED or SETTLED — those are records the
spec requires be retained; cancel the trades instead, which is a soft-delete that keeps the history.
Every deletion writes a snapshot of the deal and its trade states to the audit log, so what was removed
is still answerable. Deleting the last deal leaves the app in a clean empty state rather than breaking.

## Deal → trades

A **deal** holds everything its trades share. A **trade** is what gets priced, approved and issued.

| Deal (shared) | Trade (per trade) |
|---|---|
| Client | Trade Identifier — `Cantu!B5` |
| Transaction Code — `Cantu!B4` | **Trade Submission Date** — selects the base rate curve |
| | **Funder** — names the Settlement Date, Margin and Cost of Funds fields |
| | Relevant Obligor — `Offer File!A3` |
| Currency → base rate index + day count | The invoice/pricing blocks |
| Pro forma invoices used, yes/no | Pro forma dates and margins, when used |
| Associated jurisdictions | Lifecycle, rate snapshot, Offer File, audit |

This matches the SharePoint layout, where `Trade 1 - DRC` holds SB01 / SB02 / SB03 under one facility.

### Settings

**Settings** is a menu of six sets, each opening in its own window (`Esc` or the backdrop closes it), so
no single screen carries the currency history, the client book and every holiday calendar at once. Each
tile shows a live count, and the long-form guidance inside each window sits behind a collapsed *How…*
summary instead of standing open.

The tiles are grouped by what they are: the first four are lookups that get edited, the last two are
records that do not.

| Set | Holds |
| --- | --- |
| **Currencies & Base Rates** | The index and day count per currency, plus the dated curve history and its upload/export |
| **Clients** | The client book from the monday.com Global Pipeline; **Use** picks the client for the current deal |
| **Jurisdictions & Holiday Calendars** | The shipped calendars, and the form that adds one (below) |
| **Investors** | The funding counterparties a trade can name as its Funder |
| **Audit log** | Append-only history, scoped to a trade, a deal or the whole book, with CSV download |
| **Spec & traceability** | What this model is, the workbook cell map, and the parity suite |

Two shortcuts land directly in a window: the **Add the … curve for …** button on a trade's rate banner
opens *Currencies & Base Rates* with that date queued, and **+ New jurisdiction** on a deal's picker opens
*Jurisdictions* with the add form already showing.

#### Investors

An investor is a funding counterparty. Naming one makes it a suggestion on a trade's **Funder** field —
the field that titles that trade's Settlement Date, Margin and Cost of Funds rows. The field stays free
text, so a one-off funder can still be typed straight into a trade without being added here first, and an
unlisted funder raises a note rather than an error.

Each investor records:

| | |
| --- | --- |
| **Currencies it can fund** | A capability, not a preference. Leave it empty and nothing is checked; list currencies and a trade whose deal is in any other currency is **blocked outright**. |
| **Discount** | The shape of the arithmetic panels 4 and 5 apply. The rate and the day count still come from the trade's own panels. |
| **Settled / Not settled** | Trades naming this investor, split by state, with the money each side carries — per currency, since there is no FX rate in this model. |

##### Discount conventions

| Convention | Purchase Price | Used by |
| --- | --- | --- |
| **Simple discount** | `Face Value × (1 − (Base + Margin) × Days ÷ Basis)` | Bladex — and the workbook's own `Cantu!B46 → B47` |
| **Compound monthly** | `Face Value ÷ (1 + (Base + Margin) ÷ 12) ^ (Days ÷ 30)` | IDB Invest |

A funder not on the investor list prices under the **simple** convention, which is what every trade did
before conventions existed — so adding this repriced nothing. Compound discounting needs a fractional
power, so `D` gained `ipow`, `ln`, `exp` and `pow`: a whole exponent (a round 30-day tenor) is exact
repeated multiplication, and a fractional one goes through `exp(f · ln x)` in the same 20 dp fixed point
as everything else. Both paths are asserted in the parity suite.

Changing an investor's convention reprices every **DRAFT** trade naming it, and asks before doing so;
priced trades keep their bound snapshot until re-priced. Renaming is refused while a trade names the old
name, since that trade would stop matching the record. Everything needs **Rates Admin** and is audited.

### Adding a jurisdiction without a new build

29 holiday calendars ship with the file. A deal in a country outside those 29 needs a calendar, not
a new version of this file, so **Settings → Jurisdictions & Holiday Calendars → + Add jurisdiction** takes one:
a code, a name, a region, a source URL, and the publisher's holiday list pasted in.

- Dates are read as loosely as on the curve upload — `2027-01-01`, `01/01/2027`, `1-Jan-2027` and Excel
  serials all work — and day-first vs month-first is settled across the whole list at once, so a list
  mixing both orders is refused rather than silently misread. A live count shows what parsed before you
  commit, and anything unreadable is named and confirmed rather than dropped quietly.
- **Weekends are already handled**, so holidays alone are enough.
- **Coverage runs to the last date given.** A maturity date beyond it reports `CHECK LIST` — the same
  hard stop as a shipped calendar past its coverage, never a silent pass.
- Added calendars live **in the book**, beside the deals: they save with it, and travel through
  **Export / Import JSON** so a colleague opening your file gets your jurisdictions too.
- Requires the **Rates Admin** role, as every other reference-data edit does, and both adding and
  removing are written to the audit log with the source you name. The deal's own picker carries a
  **+ New jurisdiction** shortcut so a deal in a new country does not have to go hunting for the tab.
- A code already in use is refused, and removal is refused while any deal still lists it — those deals'
  maturity dates are being checked against it.

#### Editing a calendar, and holidays that are estimates

**Edit** on any row opens the calendar — one the build ships as much as one added here. Name, region,
source URL and note are editable, and holidays are edited **a year at a time**: a rules calendar carries
250-odd dates, and nobody wants to hunt one down in a wall of text.

Edits **layer over the shipped build** rather than replacing it. The book stores only the difference —
which dates were added, which removed — so a rules calendar keeps generating every other year out to
2040, and **Revert to shipped** drops the difference and puts the build's own calendar back. An edited
row is tagged `edited`, and a calendar change sends any priced trade on a deal using it back to DRAFT
rather than leaving a snapshot taken under the old calendar.

**Estimates.** Put `?` after a date — `2027-02-08 ?` — for a holiday that is on the calendar but not yet
confirmed: a lunar or Islamic date, or a year the publisher has not gazetted. Both the add form and the
editor read the marker.

An estimate still counts as a non-business day, but it is deliberately not the same as a confirmed one:

| Maturity date lands on | Result |
| --- | --- |
| A confirmed holiday | Blocking error — pricing stops |
| An **estimated** holiday | Acknowledgeable warning, and the business-day panel reads `No?` in amber |

Unmark it once the publisher confirms and it blocks like any other. The verdict line distinguishes them
too: `CHECK DATE!` for a confirmed problem, `CHECK — ESTIMATED` when only provisional dates are involved.

### Branding

The header carries the Silver Birch lockup, and the browser tab the mark on the brand purple. The mark is
an inline SVG `<symbol>` defined once and referenced by `<use>`, single-colour with `fill-rule="evenodd"`,
so one fill paints it at any size. `--brand` and `--silver` are the logo's own two colours and never vary
by theme — the badge behind the mark stays the deep purple the silver was drawn against. `--accent` is
that same purple doing the interface's work, so it lightens in dark mode as an accent must. **New trade**
is teal rather than a second purple: with the accent now brand purple, two purple primary buttons a card
apart is exactly what invites a mis-click.

### What a new deal or trade starts with

**Nothing carried over.** **New deal** and **New trade** open empty: no client, code or jurisdictions on
the deal; no obligor, funder, dates, tenors, margins, agency fees, supplier invoice number, name or
amount on the trade. The validation rail names every field still needed, so a blank trade cannot price
by accident on a figure nobody entered. **Duplicate** and **New version** are the deliberate opposite —
those copy their source.

#### The agreed rates

The two Margins, the two Agency Fees and the Funder Margin start blank, and **blank blocks pricing**.
`price()` reads an empty rate as zero, which would drop the margin straight out of the markup and hand
back a purchase price that looks finished, so each empty field raises a blocking `RATE.REQUIRED` instead.

- **Blank is not zero.** Clearing a field writes blank back, not `0`, and a blank survives a reload
  rather than being read in as `0.00000`. An explicit `0%` is a real rate: it prices, and it raises the
  standing-terms warning like any other departure.
- **The standing terms appear as placeholders**, in lighter italic so a hint is never mistaken for a
  keyed figure. They are read from `MARKET_DEFAULTS`, so the hint cannot drift from the value
  `NOTE.STANDARD_TERMS` compares against.
- `NOTE.STANDARD_TERMS` only fires on a rate that **has** been entered and differs. Warning that an
  empty field "is 0%, not 3%" would put five acknowledgements in front of every new trade for figures
  nobody had typed.

Three things stay set, none of them another deal's data:

| Stays set | Why |
| --- | --- |
| Legal / structuring fees at `0` | Zero is the true default; `NOTE.LEGAL_FEES` fires only above it. |
| Supplier row tenor at `30` days | The workbook's own hardcoded B9, documented as such on the field. |
| Trade Submission Date at today, deal currency at USD | A trade is submitted now, and that date selects the curve; the currency drives every index and day-count label and so needs a valid value. |

An empty jurisdiction list is now left empty on load rather than backfilled to `US, GB, BR, HK` — on a new
deal it is a selection not yet made, and the validation rail already flags it. Only a **migrated v1
record** gets those four back, because v1 had no picker and genuinely ran on `BD Dates!B4:B13`.

First run still seeds the workbook's reference deal, so the app opens on a trade that prices to B47.

### Trade identifiers

New trades are numbered `<Transaction Code>-NN`, taking the **lowest unused number** rather than a
running count — so deleting or cancelling a trade frees its number and the sequence never gains a gap.
Delete `…-02` from `01, 02, 03` and the next trade you add is `…-02` again.

Identifiers are unique on **(identifier, version)**, which means successive versions of one trade
correctly share an identifier, and a cancelled trade releases its identifier for reuse while staying
on the record. Trade lists sort by identifier numerically, so `-02` precedes `-10`.

**Delete** on a trade row removes it after a confirmation and a mandatory reason, with a snapshot to
the audit log. It is refused for APPROVED, ISSUED and SETTLED trades — cancel those instead, which
keeps the record *and* frees the identifier.

**Editing a deal's configuration** behaves differently depending on what its trades have reached:

| Trades are | Configuration is |
|---|---|
| DRAFT only | editable straight away |
| PRICED | editable straight away; editing returns them to DRAFT and voids their rate snapshots |
| APPROVED / ISSUED / SETTLED | guarded — a banner names the blocking trades and offers **Unlock for editing** |

Unlocking asks for confirmation and a reason, both audited. Approved trades return to DRAFT and lose
their approval; **issued and settled trades are left alone** — their dispatched Offer File keeps the
terms it was issued with, and the Offer File tab shows that stored payload rather than a recomputation,
flagging "Deal amended since issue" when the current configuration would produce a different record.
The unlock lasts for the session only; reloading restores the guard.

*Download deal CSV* in the workspace's Offer File pane emits one Offer File row per trade, which is what
the workbook's single-row `Offer File` tab had to be re-copied by hand to produce.

## Base rate management

**One dated curve history per index** — there is no separate "pro forma" curve. The workbook's two
interpolation tabs were never two curves; they were the same index read at two different dates, which its
own notes say outright: `B16` is annotated *"Issuance Date Pro Forma"* and `B29` *"Prior Funding"*. A
spreadsheet needed two tabs because it cannot hold a history. With one, the split disappears:

| Block | Reads the curve as at |
|---|---|
| Panel 2 — TradeCo Pro Forma | the **Pro Forma Issue Date** (`Cantu!B13`) |
| Panel 3 — TradeCo Invoices, and Panel 4 — IAA | the **Trade Submission Date** |

A curve applies from its business date until the next one supersedes it, so a trade prices off the
**latest curve published on or before** the date in question. A trade struck last month keeps last
month's rate however many newer curves arrive, and re-pricing it later reproduces the same number.

This still reproduces the workbook exactly: its two tabs become two dated curves — 22-Jun-2026 with a 6m
of 3.85550%, and 16-Jul-2026 with 3.87550% — and the golden master lands on the same $853,302.69.

**Settings → Currencies & Base Rates** manages the history:

- **Every rate is editable in place.** Each cell in the history table is an input, as are the business
  date and the note. Edits commit on blur, so typing and tabbing between cells are never interrupted, and
  each one is audited with its old and new value. Re-dating a curve onto a date that already has one is
  refused rather than silently merging.
- **Add / update** — key in a dated curve, or **a single data point**: fill only the tenors you have and
  the rest are left exactly as they were. Adding just a 6m fixing for a date that already carries a curve
  updates the 6m and nothing else. A new date can hold one point on its own.
- **Upload history (CSV/JSON)** — bulk-load past curves. CSV columns `date,1m,3m,6m,12m`, rates as
  percentages; blank cells are left untouched, so partial rows are fine. Rows with no date or no rates at
  all are skipped and reported rather than half-loaded. *Download CSV template* gives the exact shape;
  *Export history* round-trips everything.
- The history table shows each curve's rates, source and **which trades read it, and in which role**
  ("trade submission date" or "pro forma"), so you can see what a curve is load-bearing for before deleting it.
  Rows missing pillars say which.

Partial curves are **allowed and flagged, never silently wrong**. A curve interpolates on whatever
pillars it has, and pricing warns when the one it used is incomplete (`RATE.PARTIAL_CURVE`). The sharp
case is a curve holding a single point: reading a 90-day rate off a lone 6m fixing is a flat read, not an
interpolation, so it is labelled `SINGLE_PILLAR` and warned about explicitly rather than being passed off
as an exact hit.

**The model asks for what it is missing.** No curve on or before a date blocks pricing (`RATE.NO_CURVE`,
`RATE.NO_CURVE_PF`); a curve that merely predates it prices but warns (`RATE.NOT_CURRENT`,
`RATE.NOT_CURRENT_PF`) naming the gap in days. Each surfaces its own banner in the trade workspace with a
button that jumps to the curve entry pre-filled with **that** index and date — so a missing pro forma
rate sends you to the pro forma issue date, not the submission date.

Only the two curves the workbook carries are seeded. No historical market data is invented: everything
else has to be uploaded.

## Currency and base rate

Currency is a deal-level choice. It selects the base-rate index **and the day-count basis** — the
workbook hardcodes `/360`, which is correct for Term SOFR and EURIBOR but wrong for a 365-basis index.
The basis travels with the currency through all four factor formulas (`B20`, `B33`, `B46`, `B52`).

| Currency | Index | Day count |
|---|---|---|
| USD | Term SOFR | ACT/360 |
| EUR | EURIBOR | ACT/360 |
| GBP | Term SONIA | ACT/365 |
| MXN | TIIE | ACT/360 |
| COP | IBR | ACT/360 |
| CHF | SARON | ACT/360 |
| BRL | CDI | ACT/360 † |

The first five are the currencies on your monday.com Trades board (`dropdown_mkxxanzq`).

† **BRL is indicative only.** CDI is quoted on a 252-business-day compounded basis, not a simple
ACT/360 discount. The model applies the workbook's simple-discount formula and raises a
`CCY.CONVENTION` warning; confirm the convention with Bladex before pricing BRL for real.

**Only USD ships with a loaded curve** — the pillars from the workbook. Every other index starts empty
and a Rates Admin must enter its pillars under Settings before a trade in that currency can
be priced. Seeding invented rates for EUR or GBP would be worse than blocking: someone would price off
them. Pricing is hard-blocked with `RATE.NO_CURVE` until a curve is loaded.

## Jurisdictions

**29 jurisdictions**, selected per deal and checked against every trade's maturity date. The picker is a
region-grouped dropdown that adds one at a time, with the chosen jurisdictions shown as removable chips.
Selecting none is a blocking error, not a silent pass.

Business days are **derived from rules**, not transcribed tables — fixed dates, nth-weekday, Easter
offsets, Monday-on-or-after (Colombia's Emiliani law), nearest-Monday (the Dominican Ley 139-97),
weekday-in-range (Nordic midsummer), plus each market's weekend-observance convention (the Fed's
Sunday→Monday, the UK's substitute-day). Calendars are generated for **2024–2040**, so there is no
transcription cliff and no annual refresh to forget.

The engine is validated against the workbook itself: it reproduces `BD Dates` columns B (US, 44 days),
C (UK, 32 days) and D (Brazil, 52 days) for 2026–2029 **exactly**, and those three assertions run in
the parity tests.

| Region | Jurisdictions |
|---|---|
| Americas | US, CA, MX, BR, CL, CO, PE, PA, DO |
| EMEA | GB, IE, FR, DE, ES, IT, NL, BE, PT, CH, AT, SE, NO, DK, FI, PL, ZA, TARGET2 (EU) |
| APAC | AU, HK |

Two caveats worth reading before go-live:

- Calendars marked **rules** under Settings are national/bank-holiday defaults derived from
  the rules above. Only US, GB, BR and TARGET2 are marked **verified** (against the workbook or a
  fixed six-rule definition). Check the others against the publisher link before relying on them, and
  note that sub-national holidays — German *Länder*, Swiss cantons, Australian states — are not modelled.
- **Dominican Republic** carries one modelling gap, flagged in its calendar row: Restoration Day
  (16 Aug) is observed on the date itself in presidential-inauguration years — 2028, 2032, 2036, 2040 —
  rather than shifted to the nearest Monday. The rules always shift it, so check those four years against
  the Banco Central calendar.
- **Lunar and Islamic calendars cannot be derived from rules.** Hong Kong therefore ships as a published
  list covering only to 27-Dec-2027, and hard-blocks beyond that. The same limitation applies to any
  jurisdiction whose holidays follow the Chinese, Islamic or Hebrew calendar (SG, AE, CN, IN, IL, MY) —
  these need a published list loaded rather than a rule set, and are not offered until one is.

## What is implemented

- **Client selection, sourced from monday.com.** The Deal Header carries a client dropdown built from
  the distinct values of the **Client** column on the *Global Pipeline* board — 269 clients, grouped
  by pipeline status, each showing country and deal count. Picking a client renames every
  client-named label in the model: the page title, the two payment legs in panel 5, the settlement
  and confirmed-days notes, the standard-terms warnings and Offer File column H. See
  *Client list* below.
- **An optional Pro Forma block, set per deal.** Not every facility uses a TradeCo pro forma invoice,
  so it is a deal-level switch — every trade on a deal agrees on it. When off, panel 2 is removed from
  the pricing screen entirely and excluded from pricing, validation and the rate snapshot (no pro forma
  curve is quoted or bound). Panel 2 is a leaf — panels 3 to 5 and the Offer File never read it — so
  B27:B53 stay bit-for-bit identical either way. The parity tests assert that on every downstream
  output. The pro forma dates and margins remain per trade, for deals that do use them.
- **Five pricing panels** in the same vertical order as the `Cantu` tab (*Spec – Overview §7*),
  carrying the workbook's visual grammar: yellow cells are editable inputs, grey cells are
  computed and show their source cell plus a formula tooltip on hover, and the purple italic
  column-C notes are inline help text.
- **Both SOFR curves** (`CME_TERM_SOFR`, `CME_TERM_SOFR_PF`) with editable pillars, an
  `EXACT_PILLAR / LINEAR_INTERP / LINEAR_EXTRAP` method badge, business date and source. Curve
  editing is gated to the **Rates Admin** role and every edit writes a `RATE_OVERRIDE` audit event.
- **Business-day validation** against the US / UK / Brazil / Hong Kong calendars transcribed from
  `BD Dates`, with an explicit `coverage_through` per jurisdiction.
- **Deal lifecycle** `DRAFT → PRICED → APPROVED → ISSUED → SETTLED` (+ `CANCELLED`), with the rate
  snapshot frozen and bound at PRICED, four-eyes approval (an approver who is not the originator),
  inputs locked from APPROVED, and versioning for post-approval changes.
- **Validation** split into blocking errors and acknowledgeable warnings; acknowledgement requires
  a reason and is itself an audit event.
- **IAA Offer File** — the 12-field record with its source-cell mapping, exportable as TSV, CSV,
  JSON or print-to-PDF, hashed with SHA-256 and stored immutably on the deal at ISSUED.
- **Append-only audit log** at field-level granularity — who changed what, when, from what to what,
  and why. No hard deletes anywhere: cancelling is a soft-delete.

## Client list

Seeded from monday.com at build time:

| | |
|---|---|
| Board | *Global Pipeline* — `18299408349` |
| Column | `board_relation_mkx6fyx4` ("Client") → *Global Database* `1462356365` |
| Captured | 269 distinct clients from 308 pipeline deals — 86 active, 103 prospect, 80 lost |
| Per client | name, monday item id, strongest deal status, country, region, deal count |

Refresh it three ways, from **Settings → Clients**:

1. **Refresh from monday.com** — Rates Admin only. Prompts for an API token, uses it for that one
   request and never stores it, anywhere. Two caveats: a personal token grants full account access,
   so don't paste one into a copy of this file you don't control; and browsers block the call from a
   `file://` page, so the page must be served over http(s) for it to work.
2. **Import JSON** — accepts either the exported shape or a bare array of
   `{id, name, status, country, region}`. This is the right path for shared copies, and needs no token.
3. **Export JSON** — hand the current list to someone else, or diff it.

Both refresh paths write an audit event recording the before and after counts.

The proper long-term fix is a server-side sync holding the token in a secret manager, per
*Spec – Overview §6*. That is the same shape as the CME rate feed and belongs in the same job runner.

## Deliberate departures from the workbook

These are places where the workbook and the spec disagree, and the spec wins.

1. **Calendar coverage.** `BD Dates!B17:K17` derives coverage from `YEAR(MAX(B19:B52))`. That range
   stops at row 52, so Brazil was reported as covered through 2028 when its list actually runs to
   25-Dec-2029. This app takes `coverage_through` from the full list and **hard-blocks** a maturity
   date beyond it, rather than letting it pass — *Spec – Data Model*, `holiday_calendar.coverage_through`.
2. **Interpolation below the shortest pillar.** `'SOFR Interpolation'!C9` contains an unreachable
   branch — `AND(B9>B7, B9<=B6)` tests for days > 360 *and* ≤ 180 — so any tenor under 30 days
   silently falls through to the 6m→1y line. This app brackets the tenor against the pillar set
   instead. **For every tenor at or above the shortest pillar the two agree exactly**, so no live
   deal is affected; Bladex Days has always been ~180.
3. **Supplier tenor.** `B9 = B8+30` hardcodes a business assumption. It is an editable field here,
   per `deal.supplier_invoice_tenor_days` in the Data Model tab.
4. **Blank identifiers.** The workbook prints `0` on the Offer File when Transaction Code or Trade
   Identifier are empty (visible in the source file). Both are required before a deal can be priced.
5. **The client is a field, not a hardcoded name.** The workbook is a Cantu-only file. Here the client
   is selected per deal and every client-named label follows it. One thing is deliberately *not*
   renamed: source-cell references such as `Cantu!B47` or `Cantu!A12:C23`. Those point at a sheet in
   the source workbook and must stay literal, or traceability breaks.
6. **The Pro Forma block is optional**, where the workbook always computes it.
7. **Day count follows the currency** rather than being hardcoded to 360. USD is unaffected.
8. **Jurisdictions are per deal and rule-derived**, replacing the ten fixed rows of `BD Dates!B4:B13` —
   which capped out at ten, could not vary by facility, and expired in 2027–2029.
9. **One workbook file per trade becomes one deal with many trades**, so the shared fields are entered
   once instead of being re-keyed (and drifting) across SB01 / SB02 / SB03.

## Not built here

PostgreSQL persistence, OIDC SSO, the CME rate feed, the scheduled calendar-refresh job and
server-side PDF rendering are server-side concerns from the spec and are out of scope for a single
HTML file. Their local stand-ins:

| Spec component | Stand-in here |
|---|---|
| PostgreSQL `NUMERIC(20,10)` | BigInt fixed-point decimal + `localStorage` |
| OIDC SSO role claims | Role selector in the header |
| CME daily rate fetch | Rates-Admin-gated manual curve entry (the spec's override path) |
| Annual calendar refresh job | Static calendars + a forward-coverage warning under 180 days |
| Server-side PDF + document hash | Browser print-to-PDF + pure-JS SHA-256 |
| Scheduled monday.com client sync | Seeded list + token-per-request refresh / JSON import |

## Open items — spec tabs that could not be read

The workbook has 11 sheets. This build is traceable to `Cantu`, `Offer File`, both SOFR
interpolation tabs, `BD Dates`, **Spec – Overview** and **Spec – Data Model**. Four later spec tabs
could not be retrieved — the OneDrive reader truncates the workbook before reaching them. Referenced
by name from the tabs that were readable:

- **Spec – Validation & Outputs** — validation rules and the Offer File field mapping.
- **Spec – Rates & Calendars** — curve feed design and holiday-calendar sourcing.
- **Spec – Test Cases** — the full parity case list and precision bar.
- One further tab, name unknown.

Consequences, and what to check when those tabs are available:

- The **Offer File field mapping** was reconstructed directly from the `Offer File` tab formulas
  (`B3 = Cantu!B4`, `F3 = Cantu!B51`, …), so it should be exact — worth confirming against the
  Validation & Outputs tab.
- The **validation rules** in `validate()` are derived from the workbook's own column-C notes, the
  lifecycle table in Spec – Overview §3 and the constraints in Spec – Data Model. They are a
  reasonable reconstruction, not a transcription. Each carries a rule code (`FACTOR.PF`,
  `CAL.COVERAGE`, `NOTE.STANDARD_TERMS`, …) so they can be reconciled line by line.
- One threshold is a judgement call: the note on `Cantu!C13` says the Pro Forma Issue Date should be
  "around 5 days" before the Supplier Invoice Maturity Date, but the workbook's own reference deal
  runs 24 days. The warning is set to fire above 30 days so it does not flag the golden case.
  Tighten it once the real rule is known.
- **Holiday calendar source URLs** are the official publishers, not the verbatim URLs recorded as
  cell notes on `BD Dates!B19:E19` — those notes were not exposed by the reader. Replace them if
  they differ.

Everything above is surfaced in-app under the **Spec & traceability** tab.

## Data handling

An earlier single-level store (`cantu-pricing-model-v1`) is migrated automatically on first load: each
flat record becomes one deal carrying one trade, and the migration itself is written to the audit log.

Deals live in this browser's `localStorage` only — nothing is transmitted anywhere. Use
*Deals → Export all data* to move a deal set between machines. Note that browser storage is not a
system of record: it is cleared by "clear site data" and is not backed up.
