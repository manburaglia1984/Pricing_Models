# Cantu Pricing Model — HTML version

A browser implementation of **Cantu Pricing Model 07222026.xlsx**, built to the `Spec – …` tabs
in that workbook.

Open `index.html` in any modern browser. No server, no build step, no network access — it is a
single self-contained file that works offline and can be emailed or dropped on a share.

---

## Parity with the workbook

The calc engine reproduces **all 26 output cells** of the `Cantu` tab exactly, plus the
`Offer File`, `SOFR Interpolation` and `BD Dates` derivations. Open the **Parity tests** tab and
press *Run tests* — 39 assertions, each labelled with its source cell.

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

## What is implemented

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

Deals live in this browser's `localStorage` only — nothing is transmitted anywhere. Use
*Deals → Export all data* to move a deal set between machines. Note that browser storage is not a
system of record: it is cleared by "clear site data" and is not backed up.
