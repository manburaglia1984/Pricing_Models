# Cantu Pricing Model — HTML version

A browser implementation of **Cantu Pricing Model 07222026.xlsx**, built to the `Spec – …` tabs
in that workbook.

Open `index.html` in any modern browser. No server, no build step, no network access — it is a
single self-contained file that works offline and can be emailed or dropped on a share.

---

## Parity with the workbook

The calc engine reproduces **all 26 output cells** of the `Cantu` tab exactly, plus the
`Offer File`, `SOFR Interpolation` and `BD Dates` derivations. Open the **Parity tests** tab and
press *Run tests* — 341 assertions, each labelled with its source cell.

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
are **Deals**, **Reference data**, **Audit log**, **Parity tests** and **Spec & traceability**; the page
header carries no deal or trade controls at all.

**Deals** is the landing tab. Click any deal row to select it and *Trades on this deal* below updates to
that deal's trades. Row actions are **Configure** and **Delete**. **Configure** opens the deal
configuration as its own **window**, the same overlay treatment as the trade workspace: it carries the
client, the currency, three billing switches, the issuing entity and its account, four blocks of
document text and the jurisdiction picker, which is more than fits down one side of a screen. Close it
with its own button, `Esc`, or a click on the backdrop.

**Open** on a trade raises the **trade workspace** — a full overlay carrying everything specific to that
trade:

- a header with the trade identifier, its deal, the state badge, and every trade action (Price, Approve,
  Issue, Mark settled, Cancel, Duplicate, New version, Edit deal configuration);
- a **Pricing** pane — the deal's configuration read-only, the trade's own fields, the five panels and the
  validation / rate-quote / business-day / summary rail;
- a **Documents** pane, since every document a trade issues describes that trade and belongs with it.

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
| Transaction Code — `Cantu!B4` | **Trade Date** — selects the base rate curve |
| | **Funder** — names the Settlement Date, Margin and Cost of Funds fields |
| | Relevant Obligor — `Offer File!A3` |
| Currency → base rate index + day count | The invoice/pricing blocks |
| Pro forma invoices used, yes/no | Pro forma dates and margins, when used |
| Agency fee charged, yes/no | The agency fee rate, when charged |
| Invoice-to name and address, and the agreement the TradeCo invoice is issued under | The invoice's own numbers, dates and number |
| TradeCo invoices per trade — one or two | The amounts on them |
| The TradeCo that issues, and the account it is paid into | — |
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

*Download deal CSV* in the workspace's Documents pane emits one Offer File row per trade, which is what
the workbook's single-row `Offer File` tab had to be re-copied by hand to produce.

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
- **Upload history (CSV/JSON)** — bulk-load past curves. CSV columns `date,1m,3m,6m,12m`, rates as
  percentages; blank cells are left untouched, so partial rows are fine. Rows with no date or no rates at
  all are skipped and reported rather than half-loaded. *Download CSV template* gives the exact shape;
  *Export history* round-trips everything.
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
- **An agency fee set per deal, keyed once per trade.** Whether a facility carries one at all is a
  deal-level switch, so every trade on a deal agrees on it. When off, the rate disappears from the
  trade window entirely — the field on the Trade box, the mark-up component in panels 2 and 3, and
  the payment leg in panel 5 — and reads as zero everywhere rather than being dropped from some
  expressions and not others. Unlike the pro forma block this is *not* a leaf: `B18`/`B31` sit
  inside `B32`, so turning it off genuinely reprices the trade, and flipping the switch voids the
  rate snapshot of every trade on the deal. When on, the rate is keyed once on the **Trade Info**
  box under TradeCo Fee and both panels display what they read.
- **Five pricing panels** in the same vertical order as the `Cantu` tab (*Spec – Overview §7*),
  carrying the workbook's visual grammar: yellow cells are editable inputs, grey cells are
  computed and show their source cell plus a formula tooltip on hover.
- **The workbook's column-C notes are comments on a field, not lines of the form.** Thirty of them
  spelled out down a four-column screen was most of the ink on it, so each one collapses to a small
  `i` beside its label and opens in a floating panel when the pointer reaches **that badge** — not
  the row, since pointing at a field is not asking for its comment, and treating it as though it
  were opened a panel every time the pointer crossed a panel on its way somewhere else. A caret
  landing in a field opens its comment too, that being the keyboard's only way to reach one: a 14px
  badge is not a tab stop and should not become one. The panel is anchored to the row and ticks back at it, flips
  above when the space below runs out, and follows the row on scroll rather than vanishing. The note
  text stays in the DOM where it always was, so a screen reader still reads it inside its own label
  and nothing is lost to anyone who was relying on it. Notes that are a table's own content — an
  investor's description, a discount formula, a curve's *off-grid* marker — stay on the page: those
  annotate data rather than label a field.
- **Supplier invoices as a list, each with its own item detail.** Panel 1 holds only the four
  figures the pricing blocks read (B8, B9, B10 and the invoice count); the list itself opens as a
  window from *Open invoice list*, so a trade with twenty invoices lays out like a trade with one.
  Each invoice carries invoice number, supplier, jurisdiction, issue date, tenor, derived payment
  date and total, and opens a **Detail** row holding its line items — item name, quantity, price
  per item, and the line total those two give — plus **VAT, Freight Cost, Insurance Cost** and
  **Other Costs**, applied one value each on top of the item subtotal. The build-up beside the
  items writes that arithmetic out line by line, so a wrong total shows which line it is in.
  Items are edited in place and deleted individually; the invoice total is derived from them and
  becomes read-only once an invoice is itemised, since two places to key one number is how B10
  ends up disagreeing with the lines under it.
- **Two CSV uploads for invoice data**, because the detail arrives both ways. At the **invoice
  group level**, one file carries several invoices *and* their items: rows sharing an invoice
  number fold into one invoice, one item per row, and a group with no item rows falls back to its
  `amount` cell — so itemised and flat invoices travel in the same file. Inside an open **Detail**
  row, the same item columns load that one invoice's lines with no invoice columns needed. Both
  readers sniff the delimiter, read amounts however the exporting system wrote them
  (`850.000,00`, `R$ 850 000`), settle day-first vs month-first dates across the whole file, accept
  any pair of quantity / price / line total that determines the third, and read a line named *VAT*,
  *Freight*, *Insurance* or *Other costs* as that charge rather than as goods — which is how most
  invoice extracts print them. Every row that cannot be read is reported with its reason rather
  than dropped, and a stated invoice amount that disagrees with the detail is flagged, not used.
- **Both SOFR curves** (`CME_TERM_SOFR`, `CME_TERM_SOFR_PF`) with editable pillars, an
  `EXACT_PILLAR / LINEAR_INTERP / LINEAR_EXTRAP` method badge, business date and source. Curve
  editing is gated to the **Rates Admin** role and every edit writes a `RATE_OVERRIDE` audit event.
- **Business-day validation** against the US / UK / Brazil / Hong Kong calendars transcribed from
  `BD Dates`, with an explicit `coverage_through` per jurisdiction.
- **Deal lifecycle** `DRAFT → PRICED → APPROVED → ISSUED → SETTLED` (+ `CANCELLED`), with the rate
  snapshot frozen and bound at PRICED, four-eyes approval (an approver who is not the originator),
  inputs locked from APPROVED, and versioning for post-approval changes.
- **Validation** split into blocking errors and acknowledgeable warnings; acknowledgement requires
  a reason and is itself an audit event. A rate is checked against **the last trade on the same
  deal**, not against a market-wide figure: a number this desk agreed once is what makes the next
  one worth a second look. The first trade on a deal has no baseline, so its rates are not checked
  at all. Cancelled trades are not a baseline — they are the ones that did not happen.
- **One way of writing a figure, everywhere it is written.** Money carries thousands separators and
  two decimals, rates five. That holds for the fields those are typed into as well as the cells they
  are computed in: a rate or an amount is rewritten in that shape once the field is left, never
  while it is being typed, and an amount keyed as `1,234.5` is stored as `1234.5`. An empty field
  shows a greyed **zero** rather than a suggested figure — it used to show standing market terms,
  which put a number nobody had agreed in front of whoever was keying the trade and read as a value
  already entered.
- **A Documents pane per trade**, since a trade issues more than one document off the same numbers.
  A picker names them and each has its own pane.
- **IAA Offer File** — the 12-field record with its source-cell mapping, exportable as TSV, CSV,
  JSON or print-to-PDF, hashed with SHA-256 and stored immutably on the deal at ISSUED.
- **TradeCo Invoice** — the invoice TradeCo issues to the buyer, built from the trade's own supplier
  invoices. Every item line they carry becomes a line on it; freight, insurance and other costs
  become lines of their own from the trade summary; and the VAT sits in the form's TOTAL VAT row,
  where the form puts it. Per-line VAT stays at zero as the Word form's own sample row has it —
  VAT is held per invoice, not per item, and splitting one figure across the lines would put an
  allocation nobody agreed on a document that goes to a counterparty. A supplier invoice with no
  item detail contributes one line for its keyed amount rather than being dropped.

  **How many invoices a trade is billed on is set per deal.** The workbook splits the amount from
  the financial cost — the goods at `B34` and the financial cost at `B35` — and some clients want
  exactly that. Others want one invoice for the two together, so the deal chooses: *Two — amount,
  then financial cost*, or *One — billed together*, whose single invoice carries the goods lines,
  their charges **and** the financial cost as a further line, and comes to `B34 + B35`.

  That is the same `B36` the trade is priced on either way. The choice is how the amount is
  documented and never what it is, so it reaches no figure in the calc engine: panels 2 and 3 show
  the same three numbers whichever way the deal bills, and only their labels change — billing on
  one makes the sum the invoice and the two above it its components, billing on two makes each of
  them an invoice and the sum a total. The financial cost stays on screen either way, because a
  client billed on one still wants to see what it is. The parity tests assert each invoice comes to
  its own cell, that the single invoice equals the pair, and that neither billing choice moves
  `B36` or `B47`.

  It renders on screen exactly as it prints — a print stylesheet drops the app around it, so the
  page that comes out is the document and not a screenshot of the tool — and downloads as a **.docx**
  that can be edited and sent. The `.docx` is written by hand: the app ships as one file with no
  libraries, so it packs its own ZIP with stored (uncompressed) members, which needs nothing but a
  CRC-32. The output validates against the OOXML schema.

  **Who issues it comes from the TradeCo register** (below), and where it is paid from the account
  that entity's deal names. Everything else that varies by facility is a deal field: who the invoice
  is billed to, their address, and the agreement it is issued under. Only the wording is fixed. A
  field the deal has not been given is named in red on the page and listed above it, rather than
  left as a silent gap.
- **A TradeCo register**, in *Settings → TradeCos*. A TradeCo is the entity the TradeCo invoice is
  issued *from*: its legal name, jurisdiction of incorporation, registered address, company number
  and tax ID fill that document's `INVOICE FROM` block. Each entity holds **any number of bank
  accounts** — a facility funded in USD through New York and one funded in EUR through Frankfurt are
  the same company and two accounts — and a deal names one entity and one of its accounts.

  It is a register rather than a set of deal fields because one entity issues across many
  facilities, and a company number that has to be re-keyed per deal is a company number that will
  disagree with itself. Only the account a deal names is printed, and it is never inferred: no
  account, no bank block, and the invoice says so. An account is dropped when the deal's entity
  changes, since an account belongs to one company. Rows that would print empty are left out, so a
  US account shows no IBAN line and a European one no CHIPS ABA. An account held in a currency other
  than the invoice's is flagged — the kind of thing only noticed after the money has gone somewhere
  else. Removing an entity is refused while a deal names it; removing an account warns which deals
  it leaves with none. Editing is gated to the **Rates Admin** role and every change is audited.

  It is seeded with the entity and account on the attached standard form, so the invoice it already
  produced still produces the same document and there is a worked example to copy.
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
   The workbook also holds exactly one supplier invoice, keyed as a single amount in `B10`. Here a
   trade carries a list of them, and each may be broken down into item lines plus VAT, freight,
   insurance and other costs. None of that changes the arithmetic downstream: `B10` is the sum of
   the invoice totals, `B8` the earliest issue date and `B9` the latest payment date, and the
   parity tests assert that an invoice itemised to a given total prices bit-for-bit as the flat one
   the golden master uses.
4. **Blank identifiers.** The workbook prints `0` on the Offer File when Transaction Code or Trade
   Identifier are empty (visible in the source file). Both are required before a deal can be priced.
5. **The client is a field, not a hardcoded name.** The workbook is a Cantu-only file. Here the client
   is selected per deal and every client-named label follows it. One thing is deliberately *not*
   renamed: source-cell references such as `Cantu!B47` or `Cantu!A12:C23`. Those point at a sheet in
   the source workbook and must stay literal, or traceability breaks.
6. **The Pro Forma block is optional**, where the workbook always computes it.
   The **agency fee is optional too**, and set per deal — the workbook always charges one. It is
   also keyed **once** rather than twice: `B18` (pro forma) and `B31` (TradeCo) are separate cells
   in the workbook, but a facility charges one agency fee, so two fields only created the chance of
   the two disagreeing. Both panels read the single rate and show it against their own cell
   reference, exactly as they already did for the margin. A trade stored with the two keyed apart
   migrates to the one that drove the payment leg — `B52` read the TradeCo rate — so it keeps the
   figure it was actually paying out on.
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
