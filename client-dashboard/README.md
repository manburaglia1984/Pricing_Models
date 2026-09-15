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

## News

A published page cannot run a web search, so news is screened in a Claude session and written to the
artifact's own data store. The page declares the `db` capability and reads one document at load:

```
news/current  →  { checkedAt, windowFrom, windowTo, items[], noCoverage[] }
```

Each item carries `appliesTo`, an array of monday.com **deal item ids** — so one story can attach to
several deals (the Colombia earthquake touches six; Liberty touches three) without duplication, and
two deals on the same client share one entry.

There is no news panel. News surfaces in two places only:

- a chip on the deal's table row — reading `news` in the accent colour when the deal has a
  `signal` item, otherwise `1 item` / `3 items` in neutral;
- the full list, tiered and with sources, inside that deal's drawer.

A deal with nothing attached gets no chip, so the table stays quiet. Tiers (`signal`, `context`,
`note`) still order the drawer list and decide whether the row chip is accented.

`noCoverage` names the deals searched with nothing credible found — recorded explicitly, because
silence from a private company is not the same as no news. Every item stores a `why`: one line on
what it means for the deal, which is the part worth reading.

To re-screen, rewrite the whole document (`write_db`, `db_op: set`, collection `news`, doc `current`).
The page picks it up on next load; no republish needed.

### The daily Routine

A Routine fires at 10:30 UTC daily and rewrites `news/current`. Routine-fired sessions in this
organisation get **no connector tools**, so it cannot read the board itself. Instead:

```
roster/current  →  { updatedAt, deals: [{ id, name, client, stage, country, solution, url }] }
```

The dashboard writes that document itself on every successful load (skipping the write when nothing
changed), so the Routine's search list stays current simply because the dashboard gets used. If the
roster is ever missing the Routine stops and says so rather than guessing.

To keep a daily cadence affordable it searches Live, Implementation and Validation every day, and
Discovery on Mondays, Wednesdays and Fridays. It merges rather than replaces: `signal` and `note`
items age out after 7 days, `context` after 90, and new items are de-duplicated against what is
already stored by URL, then by client plus headline prefix. It reports only when a new `signal`
appears — on a daily schedule, silence has to be the normal outcome or the alerts stop being read.

The cron is fixed UTC, so the local fire time shifts by an hour when US daylight saving ends.

With no panel, a failed read would look exactly like a quiet week — every chip simply absent. So the
connection bar carries a third status dot: green with the item and signal counts, red with the reason
on hover when the read fails. "Nothing found" and "nothing worked" must never be the same blank space;
the first version of this shipped with a silent `return` and a silent `catch`, and nothing appeared
at all.

### A trap in the db contract

`DocumentSnapshot.data` is a **method**, not a property:

```js
var d = snap.data();        // correct
var d = snap.data;          // a function object — every field reads undefined
```

Reading it as a property is silent: `snap.data.items` is `undefined`, the array check fails, and the
panel never shows. Writes are unaffected (`set()` takes a plain object), so the roster kept saving
while news never loaded — which is exactly what made it hard to spot.

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

## The contact check

`contact/current` holds an Outlook corroboration of the board's `Date Last Contact`, one entry per
deal, written by a Claude session because a published page cannot reach the mailbox.

**The asymmetry is the whole design.** Outlook can prove the board is *behind* — a touch it can see
that the board does not know about is a fact. It can never prove the board *wrong*: a phone call, a
meeting, or mail from another account leaves no trace in a recipient search. So the date only ever
moves **forward**, never back.

| Verdict | Meaning | Effect |
|---|---|---|
| `corroborated` | Board and Outlook agree within 7 days | Nothing shown |
| `board-stale` | Outlook shows a later touch | The gap uses the Outlook date; a dashed `board stale` chip |
| `unconfirmed` | Board is more than 21 days newer than anything Outlook can see | Board date still ranks the deal; a solid `unconfirmed` chip |
| `no-trace` | Nothing credible found, or no client linked | Nothing shown |

Chips are neutral by design: the reserved amber/red belongs to the contact gap and the accent to
news, so a third hue here would muddy both. Weight carries the meaning — dashed for "the board is
behind", solid for "this needs checking".

### How the search works

Outlook's `recipient` filter matches **partial** addresses, so a client's own name token finds mail
addressed to them without needing to know their domain — the Client board's Branch contacts are
empty, so there were no domains to read. Two things this does NOT do:

- It does not filter to mail *you personally sent*. It catches the whole Silver Birch thread with
  that client, which is the better question for coverage, and the drawer names the sender so you can
  see which it was. Searching Sent Items by company name instead was tried and rejected: for Celsia
  it returned five internal emails between colleagues *about* Celsia and none to Celsia at all.
- It does not include calendar. `outlook_calendar_search` timed out at 60s.

Substring matching produces false positives — a "cantu" search returned a CEAT thread, "lla.com"
returned an unrelated one. Those are recorded as `no-trace` rather than reported as evidence.

### Refreshing it

The daily news Routine **cannot** do this: Routine-fired sessions in this organisation get no
connector tools, so they cannot reach Outlook any more than they can reach monday.com. Re-running
the check needs a session that holds Microsoft 365 — ask Claude, or create a Routine from the
claude.ai Routines UI where connectors can be attached.

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
- **Outlook as the primary contact source.** The board's `Date Last Contact` stays the system of
  record. Outlook only corroborates it — see below.
- **Automatic news refresh.** The news below is written by a Claude session, not by the page. It does
  not update itself; ask for a re-screen, or put it on a Routine.
