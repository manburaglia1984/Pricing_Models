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

## Two screens

Configuring a facility and pricing a trade are separate jobs, so they are separate screens.

- **Deals** — the landing tab. Lists every deal, and configures the selected one: client, Transaction
  Code, currency, whether pro forma invoices apply, and the associated jurisdictions. Its trades are
  listed beside it; *Price* on any of them opens the trade.
- **Trade pricing** — shows the deal's configuration read-only, with an *Edit deal configuration*
  button back to the Deals tab, then the trade's own fields and the pricing panels.

The deal and trade pickers in the header switch context from anywhere.

## Deal → trades

A **deal** holds everything its trades share. A **trade** is what gets priced, approved and issued.

| Deal (shared) | Trade (per trade) |
|---|---|
| Client | Trade Identifier — `Cantu!B5` |
| Transaction Code — `Cantu!B4` | Relevant Obligor — `Offer File!A3` |
| Currency → base rate index + day count | The invoice/pricing blocks |
| Pro forma invoices used, yes/no | Pro forma dates and margins, when used |
| Associated jurisdictions | Lifecycle, rate snapshot, Offer File, audit |

This matches the SharePoint layout, where `Trade 1 - DRC` holds SB01 / SB02 / SB03 under one facility.

Deal configuration is **frozen once any trade on it reaches APPROVED** — changing it would invalidate a
signed-off price. While trades are only PRICED, editing deal config returns them to DRAFT and voids
their rate snapshots, with an audit event per trade. Trade identifiers must be unique within a deal.

*Download deal CSV* on the Offer File tab emits one Offer File row per trade, which is what the
workbook's single-row `Offer File` tab had to be re-copied by hand to produce.

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
and a Rates Admin must enter its pillars on the Reference data tab before a trade in that currency can
be priced. Seeding invented rates for EUR or GBP would be worse than blocking: someone would price off
them. Pricing is hard-blocked with `RATE.NO_CURVE` until a curve is loaded.

## Jurisdictions

Set per deal, checked against every trade's maturity date. US / GB / BR / HK are transcribed from
`BD Dates`; **TARGET2 (EU)** is computed from the Easter algorithm — six rules a year — so it covers
through 2035 and never hits a transcription cliff. Selecting none is a blocking error, not a silent pass.

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
8. **Jurisdictions are per deal**, replacing the ten fixed rows of `BD Dates!B4:B13` — which capped out
   at ten and could not vary by facility.
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
