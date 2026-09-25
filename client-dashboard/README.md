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

At load it calls `claude.use("mcp")` and then issues four `get_board_items_page` calls — one for
pipeline deals, one for 2026 trade subitems (joined on `parent_item_id`), one for the Prospect
and Lost cohort behind the **Re-engage** view, and one for the **Investor Distribution** board. Calls run with the viewer's monday.com credentials;
the page never sees a token.

Because of this it **only works when opened from claude.ai**. Opened as a local file or from a
share it has no `window.claude`, and says so rather than appearing broken.

### Refresh

The Refresh button re-issues both calls with `{cache: {refresh: true}}`, bypassing the cache. On
load the calls use a 2-minute `staleTime`, so reopening the page is instant but never more than two
minutes behind. The two dots in the header show each source independently, with the time its data
was actually produced (`result.cache.storedAt`, not the clock).

Each call fails on its own. A revenue failure leaves pipeline, stage and contact figures live; a
Prospect-and-Lost failure leaves the whole Pipeline view untouched; an Investor Distribution failure shows
a dash in the Investors column and says so in the feedback panel, rather than reading as "no
investors". Each names what is missing in a
banner inside the view that lost it, rather than taking the page down.

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

## An intermediary, not a missing domain

A large part of the Americas book is transacted **through Bladex**, with IADB and Kapital on some
Colombian deals. For those, correspondence goes to the partner and never to a client address, so a
client-domain search structurally under-reports them.

Vitali is the clearest case: Trade #24 documentation went to the Bladex team on 24 Aug — the deal is
plainly active — while a client-domain search sees nothing at all and the deal reads as `no-trace`.

**Deal activity and client contact are different signals and are kept apart.** `activity/current`
holds the second one: the newest message whose subject carries the deal or programme name, classified
as `client`, `partner` or `internal`.

It is **context only**. It never shortens a contact gap and never changes a verdict — a deal worked
internally for months with no client contact is exactly what the contact check should be flagging, so
letting activity mask that would defeat the purpose. It renders as a muted line under the day count
("deal active 16 Sep - internal only"), not as a competing number.

The pattern it exists to catch: **deal moving, client silent**. Flexdomes was discussed internally
this morning while reading as a no-trace deal with no Client linked. Grupo Penoles has no Date Last
Contact at all on the board, and a Call Report documenting a call on 27 Aug.

A deal whose client has no usable search key now shows a dotted `no key` chip rather than rendering
identically to a genuine contact gap. Those mean opposite things.

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
- **Calendar is included**, and outranks mail. `outlook_calendar_search` with `query: "*"` plus an
  `attendee` filter returns the full attendee list, so the client is *verifiably* in the room rather
  than inferred from a name appearing in an address. The earlier timeout came from a wide free-text
  search; the attendee filter is fast.
- A **future** meeting is never counted as last contact. It is recorded separately as `nextMeeting`
  and shown as its own chip — a meeting already in the diary says more than any gap number.

Substring matching produces false positives — a "cantu" search returned a CEAT thread, "lla.com"
returned an unrelated one. Those are recorded as `no-trace` rather than reported as evidence.
Calendar later proved Cantu's real domains are `cantustore.com.br` and `cantu.inc`, which is exactly
why calendar outranks mail.

**Microsoft Graph rate-limits concurrent mailbox calls** (`ApplicationThrottled`, MailboxConcurrency).
Run at most three in parallel and honour `retryAfterSeconds`; a full sweep takes several rounds.

### Refreshing it

Routine-fired **fresh** sessions in this organisation get no connector tools, so the daily news
Routine cannot do this. The weekly contact Routine works around that by binding to an existing
session (`persistent_session_id`) rather than spawning a new one: it resumes a session that already
holds monday.com and Microsoft 365 instead of creating one that holds neither.

That workaround depends on the bound session still existing when the Routine fires. The durable
alternative is a Routine created from the claude.ai Routines UI, where connectors can be attached to
fresh sessions directly — that cannot be done through the API in this organisation.

### Search keys

Token matching on client names was the weak link, and it is what produced the CEAT and `lla.com`
false positives. `domains/current` in the artifact database now holds a per-client search key, seeded
from the first sweep:

| Status | Count | Key used |
|---|---|---|
| `confirmed` | 18 | A real domain seen in mail or on a meeting invitation — exact, needs no corroboration |
| `token-only` | 15 | A name token — works, but a hit must be tied to the client before it counts |
| `unknown` | 4 | No usable key; recorded as `no-trace` rather than guessed |

Four keys that no search could recover were supplied directly and are now confirmed: Liberty Costa
Rica (`libertycr.com`, `lla.com`), C&W Panama (`cwpanama.com`), AG Group (`somosgrupoag.com`) and
Nativa Agronegocios (`agroamazonia.com` — it trades as Agroamazonia, which is why no name-derived
token could ever have found it). The four remaining unknowns are two deals with no Client linked on
the board, and two where the counterparty is only ever reached through a partner.

Each weekly run is told to add any new client address it discovers, so the map improves on its own.

This lives in the artifact store rather than on monday.com deliberately. The Global Database Branch
subitems do carry an `email` column, but it is empty for **all 1,152 clients** on the board, not just
these 35 — the structure has never been used. Filling it would be org-wide manual data entry to
recover information the Outlook sweep already produces.

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

- **Stage is ordinal, not categorical** — a single ramp in the brand purple from light (Discovery)
  to dark (Live): darker means closer to revenue. Four unrelated hues would throw that ordering away.
- **Attention ranking** is contact gap ÷ stage tolerance, weighted by 2026 forecast at risk, so a
  large Live account outranks a small Discovery name at the same number of days.
- **The accent is not the ramp endpoint.** The stage ramp is validated as an ordinal ramp (monotone
  lightness, visible step gaps, one hue). The accent is validated separately as a categorical colour
  against the two reserved status colours, which is a stricter test — it has to clear a lightness
  band, a chroma floor and colour-vision separation from Watch amber and Overdue red. No single
  value passes both, so `--accent` (`#563aa6` light, `#9a7fe0` dark) sits inside the ramp's hue but
  is picked on its own. `--brand` is the wordmark purple and is display-only.
- Palette validated for colour-vision deficiency and contrast in both themes. The brand purple is a
  material improvement on the teal it replaced, which collided with Overdue red under protanopia
  (ΔE 2.4, well under the floor); purple against the same red scores ΔE 12.9.
- Every connector error branches on its own code — `needs_reauth`, `server_not_connected`,
  `selection_required`, `blocked_by_policy` and the rest each get the copy that names the fix.
  Only `retryable` errors auto-retry, once.

---

## Watch-outs on the live book

The Re-engage view asks whether adverse news should stop us approaching. The Pipeline view asks a
harder question: does it threaten something we are already committed to. Same lane, different
ranking.

Items in `news/current` carrying `tone: "risk"` are pulled out of the news chips entirely and
rendered in a **Watch-outs — live book** panel above the fold, one compact row per deal, ordered
by **exposure**, then risk kind, then recency (see *Alerts* below for the row and the alert centre).
A table row with a risk gets a red `risk` chip beside (never folded into) its news count, and the
drawer splits Watch-outs above In the news.

### Exposure

Stage alone is too blunt — a Discovery name with a signed mandate and executed documentation is
further along than a Live name with neither — so `exposure()` scores what it would cost to be
caught out:

| Component | Points |
|---|---|
| Live or Implementation | 4 |
| Validation | 2 |
| Discovery | 1 |
| Mandate signed | +2 |
| Term sheet shared | +1 |
| Legal documentation executed | +2 (in progress: +1) |

Bands: high ≥ 6, mid ≥ 3, low below. The score, band and a plain-English `exposureWhy` ride on
`roster/current`, so the daily screen can rank and write its email without recomputing anything.

> **The threshold is set by the case it must not get wrong.** Live plus executed documentation
> scores exactly 6. If high started at 7 that deal would read as merely "mid" unless a mandate date
> were also on the board — and the oldest, most committed deals are precisely the ones whose
> earlier columns were never filled in. Set the band by the case that matters, not by the midpoint
> of the range.

### What this caught

On 17 September the daily screen searched **Liberty Latin America** and filed a preferred dividend
as a routine note. It never saw the creditor restructuring counterproposal at **Liberty Puerto
Rico** on 11 September — USD 3.1bn of debt, 8.0x net leverage, 14.1x on covenant terms, USD 90mm of
negative free cash flow in the half — while *Liberty Puerto Rico Handsets AFL* sits **Live with
documentation executed**. The same item had already surfaced in the Re-engage screen against the
Lost row for the same client; the live book had no way to raise it.

Two fixes went into the daily prompt: search the **entity as well as the group**, preferring what
comes back at entity level; and keep risk items for **30 days** rather than 7, because a
restructuring does not stop mattering because a week passed.
---

## Alerts: compact rows and the alert centre

All three alert panels — Watch-outs on the live book, and Openings and Watch-outs on Re-engage —
share one model and one component. Each panel lists **one compact row per deal** (per client on
Re-engage), and clicking a row opens the **alert centre**: a window over the page with every flagged
deal down the left and the selected deal's stories in full on the right.

The card layout it replaced broke down on volume. By 23 September the live book held 16 risk items
on 8 deals, with headlines up to 443 characters, and the panel ran to roughly 2,900 pixels of red.
The same content now takes 8 rows and about 550 pixels.

### Why group, and by what

- **Live book: by deal.** Two deals on one client carry different exposure — a Live PRM line and a
  Discovery inventory idea are not the same risk — so a story that touches both is shown on both.
- **Re-engage: by client.** Rows are named by client, and one client can hold several Lost or
  Prospect deals that the weekly screen tags with the same story. Grouped by deal, WOM and Corteva
  each appeared twice with identical text. Stories are de-duplicated by URL, then headline.

### A row

`marker · name + stage line · newest headline (one line) · kinds · count · date · ›`

- The marker is the exposure band on the live book (solid red high, faded red mid, grey low) and the
  tone on Re-engage (red risk, deep purple reason-matched, light purple opening).
- Kinds are counted, not repeated: `CREDIT ×3  LEGAL` rather than four chips.
- The count badge goes solid red on a high-exposure deal, so the eye finds it without reading.
- The live book shows up to 10 rows with exposure-band dividers; Re-engage shows 6 and hands the rest
  to the centre with an "N more deals" link. Dividers are left off Re-engage, where every signal
  kind would get a header of its own and the list would be as long as the cards it replaced.

### The centre

- **A window, not a browser tab.** A new tab would lose the live data and the link back into each
  deal. The centre is a modal dialog: focus moves in, Tab stays inside, Escape closes, and focus
  returns to the row that opened it.
- **Tabs switch feed** — live book, Openings, Re-engage risks — with a count on each.
- **Arrow keys walk the deal list.** The rail keeps its scroll position when the data refreshes.
- **Open deal** closes the centre and opens that deal's drawer on the right view. Focus is returned
  to the row first, so the drawer remembers the row rather than a button in a window that has gone.
- **On a phone** it becomes a bottom sheet showing one pane at a time, with a back button.

> **An overlay needs its own `[hidden]` rule.** The page has no global `[hidden]{display:none}`, and
> the centre is `display:flex`. Without `.ac[hidden]{display:none}` the closed window would sit over
> the page at zero opacity and swallow every click in the middle of the screen. The existing deal
> drawer survives the same gap only because it is translated off-screen.

### The data has to fit the display

Compact rows hide long text; the centre does not. Both Routines now cap a headline at 140
characters and a why/angle line at 280, keep research notes out of both, and fold a developing story
into its existing alert instead of adding another — one Bogotá council debate had been stored as
four Enel Colombia alerts. The daily Routine also rewrites any stored item that breaks the limits,
so the long September items are cleaned up on its next run rather than lingering for their 30 days.
---

## Investors on each deal

Which investors have seen each pipeline deal, how far each has got, what they said, what they
priced, and who owes us an answer. Pipeline deals only; nothing here touches Re-engage.

### Where it lives

On the **Investor Distribution** board (`18432728154`, in the pipeline folder beside Global Pipeline
and Investors_2026), created 25 September 2026: **one row per investor per deal, grouped by deal**.
Rows are named `Deal · Investor`, so the linked columns on both other boards read sensibly.

Two earlier homes were tried and set aside:

- **Subitems of Global Pipeline** are taken: they are the trades, and 2026 revenue is summed from
  them. A distribution row there would sit inside the revenue totals.
- **Subitems of Investors_2026** (one subitem per deal under each investor) worked, but showing one
  deal to six investors meant six trips into six investor items, and a deal was scattered across the
  board. The page read them for one day, 24 September.

| Field | Column | Id | Notes |
|---|---|---|---|
| — | Deal | `board_relation_mm7h71e0` | → Global Pipeline; the join key |
| `investor` | Investor | `board_relation_mm7hde4g` | → Investors_2026; name falls back to the row name |
| `stage` | Stage | `color_mm7hqct8` | see ladder below |
| `teaser` | Teaser sent | `date_mm7hshxm` | |
| `outreach` | Last outreach | `date_mm7hz4nz` | our last chase, call or send |
| `feedbackOn` | Last feedback | `date_mm7hresx` | their last answer |
| `feedback` | Feedback | `long_text_mm7hde0y` | deal panel only |
| `pricing` | Indicative pricing | `text_mm7hpzfk` | deal panel only |
| `next` | Next step | `text_mm7hhbne` | |
| `size` | Ticket (USD) | `numeric_mm7hkatj` | |
| `ccy` | Facility currency | `dropdown_mm7hy5ds` | |

Both links are two-way. Global Pipeline gained **Investor distribution** (`board_relation_mm7hqnnb`)
listing each deal's rows — named so, because Global Pipeline already has an *Investors* mirror that
reads from the trades — and Investors_2026 gained **Deals shown** (`board_relation_mm7h887d`). Both
are filled by monday from the links on this board; nothing is typed into them.

The page keeps only rows whose *Deal* is in the pipeline read; a row on a Lost or Hold deal is
ignored. One page of 500 rows is read; past that the source dot turns amber.

### The 17 lines copied from Investors_2026

The funded and legacy positions (Bladex, IDB, Pemberton) were **copied**, not moved. The originals
stay as subitems on Investors_2026 with the seven columns added there on 24 September, and the
dashboard no longer reads them. Until Ella retires them there are two copies, and an edit to the old
one will not reach the page. The older Status was mapped once, at copy time: `Live` → Live,
`Reviewing` → Under review, `Cancelled/Hold` → On hold.

One copied value looks wrong and was kept as found: **Pegaso Handsets · Bladex** carries 40,000,000
in a USD column with currency MXN.

### Stages

`Not approached → Teaser sent → NDA signed → Info shared → Under review → Indicative terms →
Credit approved → IAA signed → Live`, plus `Declined` and `On hold` off the ladder. The deal panel
draws the ladder as a seven-segment bar. Counts use four buckets: **in play** (Teaser sent to Credit
approved), **committed** (IAA signed, Live), **out** (Declined, On hold), **not approached**. A row
marked *Not approached* that carries a Teaser sent or Last outreach date is treated as approached:
the date is harder evidence than the label.

> **Label id 5 is monday's "unset" label.** On Investors_2026 the column was first created with
> *Not approached* on id 5, which made every existing line — including funded Live positions — read
> *Not approached* on Ella's board. There and on Investor Distribution, id 5 is a blank label and
> *Not approached* has its own id. Any new status column needs the same care: whatever sits on id 5
> is what every untouched row shows.

### Adding a deal to several investors

Create a group named after the deal, then one row per investor with *Deal*, *Investor*, *Stage* and
*Teaser sent*. Or ask Claude — "ETB PRM: teaser to Bladex, IDB, Santander, CACIB NY on 3 Sep" — which
creates the group and rows in one go. A Distribute form inside the dashboard was considered and left
for later: it would make the page write to monday, which it deliberately does not.

### Awaiting feedback

An investor is **owed a chase** when all of these hold:

- the later of *Teaser sent* and *Last outreach* is **10 days** ago or more;
- *Last feedback* is blank, or dated before that ask (feedback on the same day counts as an answer);
- the line is not committed or out.

Three weeks or more reads as late (red); 10 to 20 days as due (amber). A line in play with neither
date cannot be measured and is counted separately as undated, so it cannot hide as "nothing owed".

It shows in three places:

- **Table.** An *Investors* column: count, a `chase N` chip, and the bucket split. Sorts by number
  owed a chase, then by count.
- **Awaiting investor feedback panel**, under the live-book Watch-outs, one row per deal, longest
  wait first, using the same rows as the other alert panels. It stays visible when nothing is owed,
  with a one-line result, so an empty panel reads as "checked" rather than "not loaded".
- **Alert centre**, as a fourth tab, *Investor chasers*.

### Pricing stays in the deal panel

*Indicative pricing* and the free-text *Feedback* appear only in a deal's panel, never in the table,
the alert rows or the centre. Feedback is kept out with pricing because it is where terms tend to be
written ("came back at S+300"). The centre shows only when we asked, the stage, and the next step.

### Keeping it useful

The tracker is only as good as two dates: **Last outreach** each time we chase, and **Last
feedback** each time they answer. Setting *Last feedback* is what clears a chase. As of
25 September no row carries either date yet, so the panel starts empty — the 17 rows are funded or
legacy positions.

---

## Re-engage — Prospect and Lost

A second view on the same page, for the names that are not in the pipeline. Its question is not
"how is this deal doing" but "did something happen that gives me a reason to go back".

**There is no revenue figure anywhere in it.** These names are not forecastable, and a number beside
a lost name invites exactly the wrong reading.

### Who is in it

A second `get_board_items_page` call against the same board and the same Americas group, filtered to
Status label **ids** `[3, 4, 9]` — Prospect, Hold, Lost. The page then drops any Lost or Hold name
whose *Date client was Lost or put on Hold* is before `COLD_CUTOFF` (`2024-01-01`): at that distance
a re-approach is a fresh pitch, not a re-engagement.

Two deliberate asymmetries:

- **Prospects are never dropped.** They carry no lost-date because they were never lost.
- **A Lost name with a blank lost-date is kept.** The board not recording when it was lost is not
  evidence that it was lost long ago. Same rule that governs contact dates elsewhere in this page.

At the time of writing that leaves 138 of the 159 Prospect/Lost rows in the Americas group.

### Extra columns this view reads

| JSON field | Column | Id |
|---|---|---|
| `reason` | Reasons Lost/Hold | `dropdown_mkxjctk` |
| `lostDate` | Date client was Lost or put on Hold | `date_mm3xj054` |
| `route` | Source of Contact | `color_mm3td94` |
| `firstContact` | Date First Contact | `date_mkx6mes` |

### Posture — the reason decides which news matters

Every reason label maps to one of three postures, in `REASONS`:

| Posture | Meaning | Labels |
|---|---|---|
| `catalyst` | A specific event would flip it, and we know which | Price too high · Accounting treatment · Tax/Regulation/Legal · Competitor offer preferred · Client opted for alternative solution · Client busy with other projects · Geopolitical events · Solution not appropriate · One-time deal |
| `ours` | Blocked on Silver Birch's side, not the client's | Lack of investor appetite · SB Declined |
| `open` | No usable reason on the board | Client not interested · Other · blank |

> **The reason column is the engine of this module, and it is mostly empty.** 76 of 119 Lost rows say
> "Client not interested" and 42 carry no reason at all. For those the screen falls back to the
> standing catalyst list, with a new CFO or Treasurer as the strongest signal — it resets a "no" that
> was never explained.

> **`ours` names are marked, never hidden.** 19 of the 138 are blocked on our own distribution
> appetite. Client news does not move them, so their cards carry a dashed amber border and a
> "waiting on us" chip. Dropping them would lose sight of them; mixing them in unmarked would
> produce alerts you cannot act on.

Each posture carries a `watch` line — what would reopen this name. It shows in the drawer whether or
not there is news, which is the point: in a quiet week the watch list is the deliverable.


### Watch-outs — the adverse lane

Not everything found is an opening. A fine, a downgrade, a restructuring is real and useful and
must never be ranked as a reason to call. Signals carrying `tone: "risk"` (or any `risk-*` kind)
are held out of Openings entirely and rendered in a separate **Watch-outs** panel in the reserved
overdue red, ranked only against each other:

| Kind | Means |
|---|---|
| `risk-credit` | A downgrade, a covenant breach, a default, a restructuring, a liquidity squeeze |
| `risk-legal` | A fine, an investigation, litigation, a sanction, a licence at risk |
| `risk-governance` | Fraud, an auditor resigning, a finance chief leaving under a cloud |
| `risk-operational` | A plant closing, a strike, a supply failure, a major disruption |

Three rules hold this apart:

- **A risk can never outscore an opening.** `sigScore` branches on tone, so the two are ranked in
  separate universes and merged nowhere.
- **A risk is never `matched`.** It does not answer why a deal stalled; it asks whether to approach
  at all.
- **A name can carry both**, and that is the most useful case this produces — a reason to call and
  a reason to check first, side by side. The Signal column shows both chips.

Red is reserved for contact gap in the Pipeline view. The Re-engage view has no contact column, so
there is no collision within a view, and red means the same thing in both: something here is wrong.

> **Risk flags have a longer shelf life than openings.** An opening goes stale in a fortnight; a
> restructuring does not. The screen holds openings to a two-week window and lets risks run longer,
> saying so in the angle.

### Two guards on what a screen may claim

- **`matched: true` needs a stated reason to answer.** `isMatched()` requires the board to actually
  record a reason with a `catalyst` posture before the page will honour the flag. The first screen
  tripped this: it marked a Vanti signal as answering a stated reason on a row whose reason column
  is blank. The data was corrected and the page now ignores the claim regardless.
- **A date that cannot be confirmed is said, not guessed.** Several signals in the first screen are
  anchored to an approximate date and say so in the angle.

### Ranking

`sigScore` decides the order of the Openings list and the Signal column:

1. `matched` — the signal answers this name's own stated reason. Beats everything.
2. Then the standing list's own order: `cfo-change`, `wc-stress`, `funding`, `capex`, `ma`, `rating`.
3. Recency breaks ties.

### The two documents

| Document | Written by | Holds |
|---|---|---|
| `coldroster/current` | the page, on every load | the names to screen, with reason, posture and route |
| `reengage/current` | the weekly Routine | the signals, replaced whole each run |

The roster is self-maintaining: a name moved to Prospect or Lost on the board is screened the
following week without anyone editing a prompt. See `routines/weekly-reengagement-screen.md`.

### What the first full screen found

Run by hand on 17 Sep 2026 over a two-week window. **112 of 131 clients screened, 28 produced
something: 25 openings and 5 risk flags, 1 reason-matched.** Roughly one name in four.

That yield is the argument for a weekly cadence rather than a daily one, and it makes the module's
own caveats concrete:

- **19 clients could not be screened at all.** Akron, Alhel, Anagra, Arzyz, BAIT, BofA Mexican Deal,
  Eisa, Equirent, Exitus, Fuller, Gatun Energy, Grupo Dokka, LHG Mining, Lord Capital, Macropay,
  Mattilda, Penguin, South Mill, Square Trading Singapore. Names this short or this generic return
  the wrong company on a name-only search, and a wrong match is worse than a gap. These are the
  names a confirmed domain in `domains/current` would unlock.
- **Nothing was screened by domain.** All 112 were matched on company name, because `domains/current`
  covers the live book and not this cohort.
- **One risk flag lands on a live obligor.** Liberty Puerto Rico's creditors tabled a restructuring
  counterproposal on 11 Sep while *Liberty Puerto Rico Handsets AFL* sits Live in the pipeline. The
  Re-engage view surfaced an exposure question the Pipeline view had no way to raise.

Two search-key traps worth keeping:

- **A renamed company is a dead search key.** The board carries `Cepsa S.A.`; the company has traded
  as **Moeve** since October 2024. Every search on "Cepsa" returns pre-rename history and nothing
  current. Board names drift out of date and the screen cannot tell — only a person can. Where a
  name is known to have changed, record the current one in `domains/current`.
- **Adverse news is discarded by design.** Citrofrut drew an environmental fine on 5 Sep 2026, with
  local calls for the plant to close. It is real, it is in window, and it is not an opening — the
  screen looks for reasons to go back, not reasons to worry. If a risk lane is wanted it should be a
  separate signal kind with its own treatment, not folded in where it would read as an opportunity.

---

## Brand

The header carries a drawn leaf mark in `--leaf` silver-grey with a `--brand` purple midrib, so the
page is never unbranded. It is a stand-in, not the real asset: the logo file was not reachable from
the session that built this, so the purples are **read off the image by eye, not from a brand
specification**. Replace both when the real values are to hand.

To swap in the real logo without touching the code, write the artifact-db document `brand/current`:

```json
{ "src": "https://…/silver-birch.svg", "full": true }
```

- `src` — a URL or a `data:` URI. A `data:` URI is safer here: it survives with the artifact and
  needs no host. SVG is preferred; PNG at 3× the rendered height also works.
- `full` — `true` when the file already contains the "Silver Birch" wordmark, which drops the
  typeset one so it is not printed twice. `false` (or omitted) for a mark-only file.

The page falls back to the drawn leaf if the document is missing or the image fails to load, so a
bad URL degrades rather than breaks.

## Not built, deliberately

- **Write-back to monday.com.** The board stays the system of record. That includes investor
  feedback: the dashboard shows who owes an answer, and the answer is logged on Investor Distribution. A dashboard you can edit
  becomes a second source of truth that silently disagrees with the board.
- **Outlook as the primary contact source.** The board's `Date Last Contact` stays the system of
  record. Outlook only corroborates it — see below.
- **Automatic news refresh.** The news below is written by a Claude session, not by the page. It does
  not update itself; ask for a re-screen, or put it on a Routine.
