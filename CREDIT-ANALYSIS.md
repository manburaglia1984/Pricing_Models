# Credit Analysis Model — financial spreading → credit ratios → memo

A browser tool that takes a company's financial statements as they arrive — audited PDFs, an
`.xlsx` pack, a CSV — spreads them into one canonical layout, computes the credit ratios off that
spread, and writes a credit memo with an indicative bankability grade.

Open `credit-analysis.html` in any modern browser. No server, no build step, **no network access at
all** — one self-contained file that works offline and can be emailed or dropped on a share.

Built for the question "how bankable is this private company?" rather than for taking risk. We
distribute everything we originate, so this is a view, not an approval: the output is an internal
read of the numbers that tells you where the credit is tight, what structure would make it work,
and what to go back and ask for.

---

## The three stages, deliberately separate

```
  files  →  extraction  →  canonical spread  →  ratios  →  memo
            (assistant)      (the record)       (pure)
```

1. **Extraction is an assistant, never an authority.** Every figure it lifts shows where it came
   from and can be typed over. Nothing reaches the ratios until the spread has been looked at.
2. **The spread is the record.** One fixed layout, 73 lines, whatever the statement's own
   presentation was.
3. **`analyse(spread, opts)` is pure** — no DOM, no clock, no storage. Same spread in, same numbers
   out, which is what makes the self-tests worth anything. Change one figure on the Spread tab and
   every ratio, flag and paragraph of the report moves with it.

A wrong number that is visible is a nuisance. A wrong number that is invisible is a bad credit
decision. That distinction is the reason the spread exists as a separate, editable stage rather
than the files feeding the ratios directly.

## Reading the files

| Format | How it is read |
|---|---|
| **`.pdf`** (text-based) | Objects are found by scanning for `N G obj`, not by trusting the xref table — incrementally-updated and lightly-corrupt PDFs, which is most of what arrives by email, have xref tables that no longer agree with the file. Object streams are expanded, `/ToUnicode` CMaps are honoured per font, and the text matrix is tracked properly so a figure's x position is trustworthy. |
| **`.xlsx` / `.xlsm`** | Read from the zip's central directory; shared strings, inline strings, **cached formula results**, and date-formatted serials (`45291` → `2023-12-31`) all resolve. |
| **`.csv` / `.tsv`** | Delimiter sniffed from the first dozen lines; RFC 4180 quoting. |
| **Scanned PDFs** | **Not supported — there is no OCR here.** The tool detects when almost no text came out of a PDF and says so, rather than producing a plausible-looking empty spread. Type those in on the Spread tab. |
| **Encrypted PDFs** | Detected and reported. Print an unprotected copy. |
| **`.xls`** (old binary) | Not supported. Save as `.xlsx`. |

DEFLATE is decoded in-process rather than through `DecompressionStream`, for two reasons: the
browser API is async, which would push the async colour through every parser and out into the test
harness, and it rejects the trailing bytes that real-world PDF streams are full of. The in-process
version recovers what it can from a truncated stream — half an income statement beats none.

### Column structure comes from x position

Financial figures are right-aligned, so a figure's **right edge** is its column; the left edge
moves with the digit count and is worthless for this. Right edges are clustered into bands per
page, and every cell — including the `31 Dec 2025` in the header and the `Audited` underneath it —
is assigned to a band. A cell only joins a column if it both ends on it and starts near it, which
stops a long row label whose tail happens to finish under a column from being read as a figure.

### Numbers

`236.400` is two hundred thousand in Frankfurt and two hundred and thirty-six in New York, and no
amount of staring at one cell settles it. The separator convention is decided **per document**,
from the frequency of each pattern across it, and shown on the Sources tab where it can be
overridden. Brackets mean negative, a lone dash means nil, footnote markers and currency symbols
are stripped, and a trailing minus is honoured.

### Ambiguous labels are resolved by section

The extractor tracks which section each row sits under (`Non-current liabilities`, `Current
assets`, `Operating activities`, …). So a balance sheet that lists **Lease liabilities** twice
lands one in `leaseCurrent` and one in `leaseNonCurrent`, and a bare **Borrowings** becomes
short-term debt under current liabilities and long-term debt anywhere else. Where a mapping was
decided by section rather than by the label alone, it is marked *med* confidence on the
**Extraction detail** panel — those are the ones worth a glance.

## Periods, and the LTM bridge

Every `(table, column)` pair that reads as a period becomes a candidate, and candidates describing
the same period are merged — so the income statement on page 1, the balance sheet on page 2 and
the cash flow on page 3 arrive as **one** column. A stated end date is authoritative; a bare
"2025" joins the annual column of that year.

Confirm or correct all of it on the Sources tab before applying it to the spread.

**LTM** is built when the pack has a current-year interim and the same interim a year earlier:

```
LTM = last full year  +  current interim  −  same interim last year
```

Balances come from the most recent balance sheet there is — which for an interim pack is usually
the year-end one, since interims often ship without a balance sheet. The model says so out loud
rather than quietly assuming it: the LTM column names the balance sheet it used, and a flag
appears in the report.

Interim columns are **annualised** wherever a full year of earnings is needed (leverage, FFO to
debt, returns) and left alone where they are not (margins are ratios of two same-period flows).
Annualising a seasonal half-year is a lie, so the column is always marked; prefer LTM.

## The spread

73 lines across income statement, balance-sheet assets, liabilities, equity and cash flow.

- **Costs are held as positive magnitudes** and subtracted by the model, so a cost printed as
  `(341,672)` and one printed under a "less:" heading land on the same line with the same sign.
  Results (EBITDA, net income) and net cash flows keep their reported sign.
- **Reported beats derived.** Where a statement reports a subtotal, that figure is used;
  derivation only fills gaps. Derived cells show in a dashed box and can be overridden by typing
  over them.
- Derivation runs **both directions** — gross profit from revenue and cost of sales, but also cost
  of sales from revenue and gross profit; equity from its components, but also from total assets
  less total liabilities — to a fixed point in at most four passes.
- **EBITDA is never silently equal to EBIT.** If D&A is not disclosed, EBITDA is `—`, not EBIT.
  The same discipline runs through everything: a company with no disclosed inventory reports no
  DIO rather than lightning-fast inventory turns.
- A subtotal built from a **single** component is computed (plenty of companies hold nothing but
  property in non-current assets) but recorded as *thin*, and the report says which ones — correct
  if that really is the only line, understated if the extractor missed the others.
- Every cell carries provenance: **blue** lifted from a file (hover for the file, the row label and
  the figure as printed), **yellow** entered or corrected by hand, **dashed grey** derived.
  Re-applying an extraction never overwrites a figure entered by hand.

### Integrity checks

What an analyst runs their pen down before trusting a spread. Tolerance is 0.2% of the reference
figure with a floor of one unit: inside that is rounding, a few multiples of it means a line was
mis-read, double-counted or missed.

| | Check |
|---|---|
| 1 | Total assets = total liabilities + equity |
| 2–5 | Current assets, non-current assets, current liabilities, non-current liabilities each = the sum of their components |
| 6 | Equity = capital + reserves + retained earnings |
| 7 | Gross profit = revenue − cost of sales |
| 8 | EBIT ties to the cost build-up *(a gap here usually means an expense line was double-counted — a "total operating expenses" row on top of its parts — or one was missed)* |
| 9 | EBITDA = EBIT + D&A |
| 10 | Profit before tax ties to EBIT less net interest |
| 11 | Net income = profit before tax − tax |
| 12 | Operating + investing + financing + FX = net change in cash |
| 13 | Movement in balance-sheet cash = net change in the cash flow statement |
| 14 | Movement in retained earnings = net income − dividends |

13 and 14 compare a period with the one ending exactly its own length earlier, so an interim
sitting between two year-ends does not break the pairing. A failed check reaches the report as a
serious flag: *the spread does not tie out — fix it before relying on any ratio below*.

## The ratios

All of them are in the app under **Method & definitions** with their formulas, generated from the
same constants the engine uses so the documentation cannot drift from the arithmetic.

| Group | Metrics |
|---|---|
| **Scale, growth & margins** | Revenue, revenue growth, gross margin, EBITDA, EBITDA margin, EBITDA growth, EBIT, EBIT margin, net income, net margin, opex/revenue, effective tax rate |
| **Returns** | ROE, ROA, ROCE, ROIC, asset turnover |
| **Debt & leverage** | Total debt, net debt, total debt/EBITDA, net debt/EBITDA, debt/equity, debt/total capital, liabilities/equity, net gearing, equity/assets, tangible net worth, liabilities/TNW, short-term share of debt, debt payback in years, implied interest rate on debt |
| **Debt service** | EBITDA/interest, EBIT/interest, (EBITDA − capex)/interest, DSCR, CFO/interest, FFO, FFO/debt, CFO/debt |
| **Working capital & liquidity** | Working capital, operating working capital, trade working capital, current ratio, quick ratio, cash ratio, TWC/revenue, **DSO**, **DIO**, **DPO**, **CCC**, change in CCC, inventory turns, cash/daily cash costs |
| **Cash flow & earnings quality** | CFO, CFO/EBITDA, capex, capex/revenue, capex/depreciation, FCF, FCF after distributions, FCF/debt, self-funding ratio, accrual ratio |
| **Distress & trade finance** | Altman Z′ (private-company variant), revenue per month, (receivables + inventory)/short-term debt, receivables/total debt |

A few definitions worth being explicit about, because reasonable people differ:

- **Total debt** = short-term debt + current portion of long-term debt + long-term debt + lease
  liabilities *(switchable)* + shareholder loans *(unless treated as quasi-equity)*. Excluding
  leases gives the pre-IFRS 16 view many bank covenants are still written on; treating shareholder
  loans as equity is only right where they are formally subordinated. Both are toggles, and the
  report states which way they were set.
- **DSCR** = EBITDA ÷ (interest + the current portion of long-term debt **on the opening balance
  sheet**) — that is the principal that actually came due in the period.
- **DPO** uses cost of sales as a proxy for purchases, which overstates DPO where inventory is
  being built and understates it where stock is being run down.
- **Turnover ratios** run on closing balances by default, or the average of opening and closing,
  over the days the period actually covers.
- **CCC** — DSO + DIO − DPO — is the number of days of working capital the trading cycle has to be
  funded for. A single balance-sheet date can flatter a seasonal business badly; the year-end is
  often the low point of the cycle.

## Bankability scorecard

Each metric maps to a 0–100 sub-score along a published piecewise-linear curve. Pillars are the
weighted mean of whichever of their metrics have data; a missing metric is dropped and the rest
renormalised, and **the share of weight that actually had data is reported as coverage**. A score
built on a third of its inputs is not a score, and the report says so.

| Pillar | Weight | Metrics |
|---|---|---|
| Leverage & capital structure | 30% | net debt/EBITDA, debt/equity, equity/assets, short-term share of debt, debt payback |
| Debt service capacity | 22% | EBITDA/interest, DSCR, FFO/debt |
| Profitability & scale | 15% | EBITDA margin, EBITDA growth, net margin, ROCE |
| Liquidity & working capital | 18% | current ratio, quick ratio, CCC, cash days, TWC/revenue |
| Cash generation & earnings quality | 15% | CFO/EBITDA, FCF/debt, accrual ratio, Altman Z′ |

Weights are adjustable on the Method tab; thresholds are fixed in the model so two reviews of the
same company are comparable.

| Score | Grade | Reading |
|---|---|---|
| 80+ | **A** | Strongly bankable — would be lent to unsecured by most banks on the numbers alone |
| 65–79 | **B** | Bankable — a conventional facility on standard terms and covenants looks supportable |
| 50–64 | **C** | Bankable with structure — security, tighter covenants, or a shorter tenor |
| 35–49 | **D** | Needs credit enhancement — a self-liquidating or secured structure, a guarantee, or credit insurance |
| < 35 | **E** | Not bankable on these numbers |

**Hard caps override the score**, because an average will happily smooth over the two or three
things that actually stop a bank lending:

- **E** — negative equity; EBITDA below interest; negative EBITDA; an adverse opinion or disclaimer.
- **D** — interest cover below 1.5×; net debt above 6× EBITDA; a qualified opinion; a going-concern
  uncertainty; a current ratio below 0.8.

### Sector presets

The method does not change by sector; the goalposts do. A commodity trader on 2% EBITDA margins at
5× debt is ordinary, and a software business on the same numbers is in trouble. Each preset
stretches the value axis of specific curves and drops metrics that do not apply — inventory
metrics are not scored for an asset-light services business. Presets: general corporate, commodity
trading / distribution, manufacturing, services, construction / contracting, retail, agriculture.
Every adjustment is listed on the Method tab.

## The report

A memo laid out to print onto A4 and drop into a file:

- verdict box — grade, score, the pillar bars, any caps, and the coverage behind it;
- headline metrics across every period;
- **what the numbers say** — paragraphs assembled from the figures, each sentence written only if
  its inputs exist. A first draft for the analyst, not a conclusion;
- credit issues, split into *serious* / *to watch* / *supporting the credit*, each naming the
  number that triggered it, because "leverage is high" is an opinion and "net debt is 5.1× EBITDA
  against a 3.5× covenant" is a fact somebody can check;
- four charts — revenue and EBITDA, leverage and cover, the working-capital cycle, cash flow;
- condensed financial summary, and debt capacity at 3.0×–4.5×;
- three **analyst commentary** boxes — assessment, structure and mitigants, conclusion — which are
  the only part of the memo the model does not write, and are saved with the file;
- **information to request**, generated from what is actually missing from this file rather than
  from a standard checklist;
- an appendix: which file each figure came from, how many were entered by hand, which integrity
  checks failed, the conventions in force, and the limitations.

Exports: print / save as PDF, a standalone report `.html`, the memo as Markdown to the clipboard,
the ratios as CSV, and the spread as CSV with a provenance column.

### The trade-finance read-across

Because origination here is mostly receivables, the analysis carries a short lens on it: revenue
per month (the usual first cut at a revolving purchase limit), the receivables balance and what
DSO it represents, (receivables + inventory) / short-term debt — whether the trading assets
already cover the short-term debt, which is the basis on which a self-liquidating facility gets
done — and receivables / total debt. Alongside it, supportable net debt at a range of target
leverage multiples, and headroom against any covenant you enter.

## Deliberate choices, and what this will not do

- **Floating-point arithmetic, not the fixed-point decimal of `index.html`.** The pricing model has
  to reproduce a workbook cell for cell, so it uses BigInt fixed point. A ratio is analytical: 3.53×
  and 3.5300000000000002× are the same credit view. Rounding happens only at the display boundary.
- **The grade is an internal view, not a rating**, and not a recommendation. It is a weighted read
  of the financial statements alone. It knows nothing about management, market position, group
  support, the sector cycle, order books, or anything in the notes that was not typed in. Two
  companies with identical ratios can be very different credits and a scorecard cannot tell them
  apart — which is what the commentary boxes are for.
- **"Operating income"** is read as EBIT, the US convention. Some IFRS filers use it to mean
  revenue. Check that one on the Extraction detail panel.
- **No consolidation logic.** If the statements are consolidated, the ratios are the group's; which
  entity in the group would actually be the obligor is a question the model asks and does not
  answer.
- **No peer or sector benchmarking**, no rating-agency mapping, and no probability of default. The
  sector presets move thresholds; they are not a comparables set.
- **One balance-sheet date per period.** For a seasonal business the year-end can be the most
  flattering day of the year, and the model can only see the day it is given.

## Self-tests

**Self-tests** tab, *Run tests* — **137 assertions**, no fixtures on disk. Three kinds:

- the parsers against inputs built byte by byte in the test itself: a raw DEFLATE stream, a
  stored-method zip holding real SpreadsheetML, and a one-page PDF assembled as text with
  right-aligned figures, so the whole extraction path is exercised in the browser;
- the derivation rules and the label dictionary against cases with a known answer — including the
  ones that have bitten: *Intangible assets* must not become PP&E (the word "tangible" sits inside
  "intangible"), *Accumulated depreciation* must not become retained earnings, and *Lease
  liabilities* must land in the right half of the balance sheet;
- the ratio engine against a **golden company** with round numbers, where every ratio can be
  checked with a pencil — 40-odd metrics, plus the option switches, the annualisation, the LTM
  bridge, the scoring curves and the grade caps.

The same suite runs headlessly: extract the `<script>` block, `runTests()`, and the file needs no
build step to be exercised in CI.

## Data handling

Files are read in this browser using its own APIs. **There is no network request anywhere in this
page** — no upload, no analytics, no fonts fetched from anywhere.

The spread, the engagement details and the commentary live in this browser's `localStorage` under
a single key so the work survives a reload. **Save file** writes the same thing to a JSON file you
control, **Open file** reads it back, and **Clear** removes it. The statement files themselves are
never stored: reopening a saved model restores the spread and the extraction record, not the PDFs.

Browser storage is not a system of record — it is cleared by "clear site data" and is not backed
up. Use *Save file* for anything you need to keep.

Financial statements of a private company are confidential. Nothing here changes where the file
came from or who is allowed to see it; it only means the model is not a second place the data
leaks from.
