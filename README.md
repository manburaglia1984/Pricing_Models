# Cantu Pricing Model — HTML version

A browser implementation of **Cantu Pricing Model 07222026.xlsx**, built to the `Spec – …` tabs
in that workbook.

Open `index.html` in any modern browser. No server, no build step, no network access — it is a
single self-contained file that works offline and can be emailed or dropped on a share.

---

## Parity with the workbook

The calc engine reproduces **all 26 output cells** of the `Cantu` tab exactly, plus the
`Offer File`, `SOFR Interpolation` and `BD Dates` derivations. Open the **Parity tests** tab and
press *Run tests* — 148 assertions, each labelled with its source cell.

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

A trade belongs to a deal, so it is a drill-down from one rather than a tab of its own. Top-level tabs
are **Deals & Trades**, **Reference data**, **Audit log**, **Parity tests** and **Spec & traceability**; the page
header carries no deal or trade controls at all.

**Deals & Trades** is the landing tab. Click any deal row to select it and *Trades on this deal* below updates to
that deal's trades. Row actions are **Configure** and **Delete**; the configuration panel opens on the
right only when Configure is clicked, closes from its own button, and always shows whichever deal is
selected.

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
| | **Supplier invoices** — one or many, summed to `Cantu!B10` |
| Transaction Code — `Cantu!B4` | **Trade Date** — selects the base rate curve |
| | **Funder** — names the Settlement Date, Margin and Cost of Funds fields |
| | Relevant Obligor — `Offer File!A3` |
| Currency → base rate index + day count | The invoice/pricing blocks |
| Pro forma invoices used, yes/no | Pro forma dates and margins, when used |
| Associated jurisdictions | Lifecycle, rate snapshot, Offer File, audit |

This matches the SharePoint layout, where `Trade 1 - DRC` holds SB01 / SB02 / SB03 under one facility.

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

## Supplier invoices

Panel 1 holds **a list of supplier invoices, not one**. Each row carries an Invoice Number, a Supplier
Name, a Supplier Jurisdiction, an Issue Date, a tenor and an amount, and derives its own Payment Date
(issue + tenor). The four totals sit in a strip under the table rather than stacked beside it, so the
list gets the vertical space.

The trade prices off the **totals**, which are what the workbook's single-invoice cells become:

| Total | Is | Workbook cell |
|---|---|---|
| Total Supplier Invoice Amount | Σ of every invoice amount | `B10` — every downstream block reads this |
| Earliest Issue Date | `min` of the invoice issue dates | `B8` |
| Latest Payment Date | `max` of the invoice payment dates | `B9` |
| Supplier invoices | how many rows the trade carries | — |

Nothing downstream changed: `B10` is the only supplier figure panels 2–5 and the Offer File ever read,
so three invoices totalling 850,000 price identically to one of 850,000 — asserted in the parity tests.
The date totals are deliberately the outer envelope; what the individual dates should drive is still open,
so they are reported rather than acted on.

**Upload invoices (CSV)** loads a batch through the same reader as the curve upload — delimiter
sniffing, quoted fields, BOMs, and Excel-mangled dates resolved across the whole file. Columns are
matched by header, not position:

| Column | Header spellings accepted |
|---|---|
| Invoice Number | `invoice number`, `invoice no`, `invoice #`, `number`, `ref`, `document number` |
| Supplier Name | `supplier name`, `supplier`, `vendor`, `beneficiary`, `payee`, `counterparty` |
| Jurisdiction | `jurisdiction`, `country`, `country code`, `domicile` — takes a code (`BR`) or a calendar name (`Brazil`) |
| Issue Date | `issue date`, `invoice date`, `date`, `document date` |
| Tenor | `tenor days`, `tenor`, `days`, `term` |
| Payment Date | `payment date`, `due date`, `maturity date` — **used to derive the tenor when there is no tenor column** |
| Amount | `amount`, `invoice amount`, `value`, `total`, `gross` |

Only Issue Date and Amount are mandatory. Amounts are read however the exporting system wrote them —
`850000`, `"850,000.00"`, `850.000,00`, `R$ 850 000` — with the last separator group deciding: exactly
three digits after it reads as a thousands separator, anything else as a decimal. A row with an
unreadable date, a non-positive amount, or neither tenor nor payment date is skipped and named in the
confirmation; a jurisdiction that matches no calendar is left blank and reported rather than invented.
If the trade already holds invoices you are asked whether the file replaces them or is added to them —
untouched blank rows are replaced without asking. *CSV template* emits the exact shape.

Name and jurisdiction are **flagged, not enforced**: a blank name or jurisdiction raises
`NOTE.SUP_NAME` / `NOTE.SUP_NUMBER` / `NOTE.SUP_JURISDICTION` but still prices, because a trade
migrated from the single-invoice model has none of them and must not be blocked by the upgrade. Two
rows quoting **the same invoice number for the same supplier** raise `NOTE.SUP_DUPLICATE` — that is how
one invoice gets funded twice — but it stays a warning, since a genuine invoice can arrive in tranches. A jurisdiction outside the
deal's associated jurisdictions is called out too — its calendar is not being checked. Issue date, tenor
and a positive amount stay hard errors, per invoice, naming the row that fails. Removing the last
invoice is refused; removing a filled one asks first and writes the old values to the audit log.

A trade saved before this change is migrated on load: its flat `supplierIssueDate` / `supplierTenorDays`
/ `supplierAmount` become the first row and the old keys are dropped, so there is one source of truth.
The pricing engine reads both shapes through one reducer, `supplierTotals`, which is what keeps the
golden master honest.

**Still one payment leg.** `B51` remains a single Supplier Payment and the Offer File a single row —
splitting the payment per supplier is a separate change, not implied by this one.

## Base rate management

**One dated curve history per index** — there is no separate "pro forma" curve. The workbook's two
interpolation tabs were never two curves; they were the same index read at two different dates, which its
own notes say outright: `B16` is annotated *"Issuance Date Pro Forma"* and `B29` *"Prior Funding"*. A
spreadsheet needed two tabs because it cannot hold a history. With one, the split disappears:

| Block | Reads the curve as at |
|---|---|
| Panel 2 — TradeCo Pro Forma | the **Pro Forma Issue Date** (`Cantu!B13`) |
| Panel 3 — TradeCo Invoices, and Panel 4 — IAA | the **Trade Date** |

A curve applies from its business date until the next one supersedes it, so a trade prices off the
**latest curve published on or before** the date in question. A trade struck last month keeps last
month's rate however many newer curves arrive, and re-pricing it later reproduces the same number.

This still reproduces the workbook exactly: its two tabs become two dated curves — 22-Jun-2026 with a 6m
of 3.85550%, and 16-Jul-2026 with 3.87550% — and the golden master lands on the same $853,302.69.

The Reference data tab's **Base rate curves** card manages the history:

- **Every rate is editable in place.** Each cell in the history table is an input, as are the business
  date and the note. Edits commit on blur, so typing and tabbing between cells are never interrupted, and
  each one is audited with its old and new value. Re-dating a curve onto a date that already has one is
  refused rather than silently merging.
- **Add / update** — key in a dated curve, or **a single data point**: fill only the tenors you have and
  the rest are left exactly as they were. Adding just a 6m fixing for a date that already carries a curve
  updates the 6m and nothing else. A new date can hold one point on its own.
- **Upload history (CSV/JSON)** — bulk-load past curves. CSV columns are `date` plus the pillars the
  selected index publishes (`date,1m,3m,6m,12m` for Term SOFR, `date,28d,91d,182d` for TIIE), rates as
  percentages; blank cells are left untouched, so partial rows are fine. A recognised tenor column that
  the selected index does not publish is ignored and named in the confirmation rather than stored where
  no column could show it — if a whole file is off-grid the upload is refused and says which index it
  looks like it belongs to. JSON restore stays permissive for round-trip fidelity, and any off-grid
  pillar it carries gets its own column in the table, marked *off-grid*, so nothing loaded under an
  older tenor list becomes invisible. Rows with no date or no rates at
  all are skipped and reported rather than half-loaded. *Download CSV template* gives the exact shape;
  *Export history* round-trips everything.
- **The upload reads the file Excel actually produces, not just the template.** A template that has been
  opened and saved comes back with its dates rewritten to the machine's locale, so the parser accepts
  `2026-06-22`, `6/22/2026`, `22/06/2026`, `22-Jun-2026`, `Jun 22, 2026`, `20260622` and bare Excel
  serials, along with `;`- or tab-separated files, a UTF-8 BOM, quoted fields, `3,64338` decimal commas,
  a trailing `%`, and header spellings such as `Business Date`, `1M`, `1Y`, `O/N`, `overnight` or `91d`. **Day/month order is settled
  from the column as a whole** — one unambiguous row like `6/22/2026` fixes the reading for `6/7/2026`
  further down. A file that argues both ways (`22/06` next to `06/22`) is refused outright rather than
  guessed at, and a column that is ambiguous end to end is read month-first and says so in the
  confirmation. Rejected rows are now named with the reason instead of a bare "no usable rows".
- The history table shows each curve's rates, source and **which trades read it, and in which role**
  ("trade date" or "pro forma"), so you can see what a curve is load-bearing for before deleting it.
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
rate sends you to the pro forma issue date, not the trade date.

Only the two curves the workbook carries are seeded. No historical market data is invented: everything
else has to be uploaded.

## Currency and base rate

Currency is a deal-level choice. It selects the base-rate index **and the day-count basis** — the
workbook hardcodes `/360`, which is correct for Term SOFR and EURIBOR but wrong for a 365-basis index.
The basis travels with the currency through all four factor formulas (`B20`, `B33`, `B46`, `B52`).

| Currency | Index | Day count | Published pillars |
|---|---|---|---|
| USD | Term SOFR | ACT/360 | 1m, 3m, 6m, 12m |
| EUR | EURIBOR | ACT/360 | 1w, 1m, 3m, 6m, 12m |
| GBP | Term SONIA | ACT/365 | 1m, 3m, 6m, 12m |
| MXN | TIIE | ACT/360 | 28d, 91d, 182d |
| COP | IBR | ACT/360 | O/N, 1m, 3m, 6m |
| CHF | SARON | ACT/360 | O/N, 1m, 3m, 6m, 12m ‡ |
| BRL | CDI | ACT/360 † | O/N, 1m, 3m, 6m, 12m ‡ |

**Each index carries its own pillar grid**, not the workbook's fixed 1m/3m/6m/12m. Only Term SOFR and
Term SONIA quote that set: EURIBOR adds a 1-week fixing, Banxico publishes TIIE at 28, 91 and 182 days
with no 1-year point at all, and IBR stops at 6m. The entry form, the history table, the CSV template
and the CSV importer all follow the selected index's grid, so a TIIE curve is entered and uploaded as
`28d, 91d, 182d` and a gap in a curve means a fixing is genuinely missing rather than a column that
never existed. `RATE.PARTIAL_CURVE` names the pillars that index actually publishes.

Interpolation is unchanged and grid-agnostic — it reads whatever pillars are present and reports
`EXACT_PILLAR`, `LINEAR_INTERP`, `LINEAR_EXTRAP` or `SINGLE_PILLAR` — so a 300-day MXN tenor is
extrapolated beyond TIIE's 182-day top pillar and flagged as off-curve rather than quietly quoted. The
grids live in one table, `RATE_INDICES` in `index.html`; changing a list there changes the entry form,
the table, the template and the importer together, and touches no pricing code.

‡ SARON and CDI are overnight fixings; their term pillars are the compounded SARON rates
(`SAR1MC … SAR12MC`) and the DI-futures-implied CDI terms respectively.

The first five are the currencies on your monday.com Trades board (`dropdown_mkxxanzq`).

† **BRL is indicative only.** CDI is quoted on a 252-business-day compounded basis, not a simple
ACT/360 discount. The model applies the workbook's simple-discount formula and raises a
`CCY.CONVENTION` warning; confirm the convention with Bladex before pricing BRL for real.

**Only USD ships with a loaded curve** — the pillars from the workbook. Every other index starts empty
and a Rates Admin must enter its pillars on the Reference data tab before a trade in that currency can
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

- Calendars marked **rules** in the Reference data tab are national/bank-holiday defaults derived from
  the rules above. Only US, GB, BR and TARGET2 are marked **verified** (against the workbook or a
  fixed six-rule definition). Check the others against the publisher link before relying on them, and
  note that sub-national holidays — German *Länder*, Swiss cantons, Australian states — are not modelled.
- **Dominican Republic** carries one modelling gap, flagged in the Reference data tab: Restoration Day
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

Refresh it three ways, from the **Reference data** tab:

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
