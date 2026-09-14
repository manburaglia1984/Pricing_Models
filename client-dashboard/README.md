# Americas Origination Desk

A client-tracking dashboard for the Americas Originate to Distribute book: Global Pipeline by
stage, 2026 revenue against forecast, contact recency and documentation state, in one page.

**It holds no data.** Every figure is read live from monday.com with the viewer's own credentials
when the page loads, and again when they press Refresh. There is no snapshot to go stale and
nothing confidential is stored in the file.

---

## How it works

The page is published as a private Artifact and declares the `mcp` runtime capability:

```
capabilities: { mcp: { servers: [ { server: "monday.com", tools: ["get_board_items_page"] } ] } }
```

At load it calls `claude.use("mcp")` and then issues two `get_board_items_page` calls — one for
deals, one for 2026 trade subitems — joining them on `parent_item_id`. Calls run with the viewer's
monday.com credentials; the page never sees a token.

Because of this it **only works when opened from claude.ai**. Opened as a local file or from a
share it has no `window.claude`, and says so rather than appearing broken.

### Refresh

The Refresh button re-issues both calls with `{cache: {refresh: true}}`, bypassing the cache. On
load the calls use a 2-minute `staleTime`, so reopening the page is instant but never more than two
minutes behind. The two dots in the header show each source independently, with the time its data
was actually produced (`result.cache.storedAt`, not the clock).

If one of the two calls fails the other still renders — a revenue failure leaves pipeline, stage and
contact figures live, with a banner naming what is missing.

---

## monday.com mapping

Workspace **SilverBirchFinance** (`9845168`).

| What | Board | Id |
|---|---|---|
| Deals | Global Pipeline | `18299408349` |
| Trades (revenue) | Subitems of Global Pipeline | `18299408615` |
| Group | Americas | `group_mkx6kssm` |

Deals are filtered to the Americas group and to `Status` label ids `[0, 1, 2, 8]`.

> **The status filter matches on label *id*, not index.** Live = `1`, Implementation = `0`,
> Validation = `8`, Discovery = `2`. Passing indices silently returns Prospect and drops Validation.

### Deal columns

| JSON field | Column | Id |
|---|---|---|
| `client` | Client (board relation → Global Database) | `board_relation_mkx6fyx4` |
| `solution` | Solution | `dropdown_mkxjs6dq` |
| `subSol` | Sub Solution | `dropdown_mkxj8y3q` |
| `o2d` | O2D | `multiple_person_mkx6qm8z` |
| `stage` | Status | `color_mkx6xtq7` |
| `country` | Country | `country_mkx6d0kq` |
| `lastContact` | Date Last Contact | `date_mkxjfs3x` |
| `days` | Days since last contact | `formula_mkxsfck2` |
| `calls` | Number of calls | `numeric_mm3tx17x` |
| `facility` | Facility Amount, falling back to Indicative Facility Size | `numeric_mm07p198`, `numeric_mm3mn6g7` |
| `indRev` | Indicative Revenue | `numeric_mm3mr3bc` |
| `legalDoc` | Legal Documentation | `color_mkxvykz6` |
| `termSheet` | Term Sheet | `color_mm2p96gr` |
| `afl` | AFL Deal? | `dropdown_mkx6a8g2` |

### Revenue columns (subitems, filtered to trade dates in 2026)

| JSON field | Column | Id |
|---|---|---|
| `booked` | Total Revenue (Booked) 2026 | `formula_mkzd8c7v` |
| `forecast` | Total Revenue Estimated 2026 | `formula_mkxft3xn` |
| — | Exp Trade Date (drives the monthly chart) | `date_mkwx4xga` |

### Two traps in the monday MCP responses

1. **Mirror (`lookup_*`) columns are unreadable.** They return the literal string
   `"Column value type is not supported"`. That rules out the roll-ups on the deal row —
   `Total Revenue (Booked) 2026 Top`, `Total Revenue (Estimated) 2026 Top`, `Budget vs. Exec 2026` —
   which is why the page sums the underlying subitem formulas itself. Formula columns *do* resolve.
2. **An empty dropdown returns an object, not null** — `{"ids":[],"changed_at":"…"}`. Anything not a
   non-empty string is treated as absent.

---

## Revenue: read this before trusting the number

The board has no absolute per-deal budget column. What it has is **Booked** (revenue with a linked
row on the Trades board) and **Estimated/Forecast** for 2026. The dashboard shows booked against
forecast, and the pace marker is *forecast dated on or before today* — not a straight-line share of
the year, because this book's forecast is heavily back-loaded.

**Booked revenue only appears once a trade subitem is linked to the Trades board.** Several Live
deals carry forecast with zero booked. That is either genuinely unbilled or a missing trade link,
and the dashboard cannot tell which — so any deal in that state gets a "Worth checking" note in its
drawer rather than being presented as a zero-revenue client.

---

## Stage tolerances

Set in the page, not on the board:

| Stage | Tolerance | Rationale |
|---|---|---|
| Implementation | 10 days | Live documentation and onboarding; silence is where slippage starts |
| Live | 14 days | Revenue-generating; needs a rhythm, not constant contact |
| Validation | 21 days | Structuring work, slower cadence |
| Discovery | 30 days | Early, low intensity |

Past tolerance is **Watch**, past double is **Overdue**, and a deal with no `Date Last Contact` is
ranked Overdue until the column is filled. "Current" is deliberately uncoloured so only what needs
attention reads as coloured.

---

## Design notes

- **Stage is ordinal, not categorical** — a single teal ramp from light (Discovery) to dark (Live):
  darker means closer to revenue. Four unrelated hues would throw that ordering away.
- **Attention ranking** is contact gap ÷ stage tolerance, weighted by 2026 forecast at risk, so a
  large Live account outranks a small Discovery name at the same number of days.
- Palette validated for colour-vision deficiency and contrast in both themes.
- Every connector error branches on its own code — `needs_reauth`, `server_not_connected`,
  `selection_required`, `blocked_by_policy` and the rest each get the copy that names the fix.
  Only `retryable` errors auto-retry, once.

---

## Not built, deliberately

- **Write-back to monday.com.** The board stays the system of record. A dashboard you can edit
  becomes a second source of truth that silently disagrees with the board.
- **Outlook last-contact.** Superseded: the board's own `Date Last Contact` column is maintained by
  the deal owner and is more reliable than inferring contact from mail traffic.
- **Client news.** A published page cannot run a web search. It needs either an agent writing news
  into the artifact's `db` store on a schedule, or a scheduled refresh that rewrites the page.
