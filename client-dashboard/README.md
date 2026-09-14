# Americas Origination Desk

A client-tracking dashboard for the Americas Originate to Distribute book: Global Pipeline
by stage, revenue against budget, contact recency, open tasks and recent news, in one page.

Open `index.html` in any browser. Single self-contained file — no server, no build step.
It is also published as a private Artifact for phone access.

---

## Status: running on sample data

The `monday.com` connector is currently in `needs_reconnect` state, so the dashboard has
never seen the real Global Pipeline board. Every figure in `index.html` today is
illustrative and is flagged as such by a banner that cannot be dismissed.

To connect it: **claude.ai → Settings → Connectors → monday.com → reconnect**, then ask for
a refresh. The dashboard code does not change — only the data block does.

---

## How a refresh works

All data lives in exactly one place: a JSON block inside the page.

```html
<script type="application/json" id="pipeline-data"> … </script>
```

A refresh replaces that block and nothing else. It is raw text inside a `<script>` element,
so the JSON must use literal characters (`&`, not `&amp;`) — HTML entities there render
literally. Setting `"source"` to anything other than `"sample"` swaps the sample banner for
a staleness check, which warns on the page once the snapshot is more than 7 days old.

---

## monday.com column mapping

Board: **Global Pipeline**. Each item is one client. Map board columns to these JSON fields.

| JSON field | monday.com column | Notes |
|---|---|---|
| `name` | Item name | |
| `id` | Item ID or a `Deal ref` text column | Shown in the client drawer |
| `stage` | `Stage` (status) | Must be one of `Live`, `Implementation`, `Validation`, `Discovery` — anything else is dropped |
| `product` | `Product` (dropdown) | `PRM`, `Inventory Finance`, `Securitisation-as-a-Service` |
| `sector`, `country` | `Sector`, `Country` | |
| `facility` | `Facility limit` (numbers) | Absolute currency units, not millions |
| `revenueYtd` | `Revenue YTD` (numbers) | Fee revenue recognised this FY |
| `budgetFy` | `Budget FY` (numbers) | Full-year budget |
| `vehicle` | `Vehicle` | `AFL`, `SB TradeCo`, `Tradeteq / Luxembourg SPV` |
| `instrument` | `Instrument` | `IPU`, `Title transfer`, `Note issuance` |
| `docs` | `Documentation status` (long text) | RTA / PUA / IAA state |
| `nextMilestone` | `Next milestone` (long text) | |
| `tasks[]` | Subitems, or a linked Tasks board | `title`, `owner`, `due` (ISO date) |

Amounts are absolute (`180000000`, not `180`). Dates are ISO `YYYY-MM-DD`.

**If a column is renamed on the board, change the mapping here — not the page.**

### Stage tolerances

Contact tolerance is per stage, set in `stages[].toleranceDays` and independent of monday.com:

| Stage | Tolerance | Rationale |
|---|---|---|
| Implementation | 10 days | Live documentation and onboarding; silence is where slippage starts |
| Live | 14 days | Revenue-generating; needs a rhythm, not constant contact |
| Validation | 21 days | Structuring work, slower cadence |
| Discovery | 30 days | Early, low intensity |

Past tolerance is **Watch**; past double tolerance is **Overdue**. "Current" is deliberately
left uncoloured, so only what needs attention reads as coloured on the page.

---

## Last contact — the rule that matters

`lastContact` counts **only** two things from Outlook:

1. mail **you sent** to a client domain, and
2. calendar meetings **you attended** with a client attendee.

Inbound mail, auto-replies, out-of-office bounces, newsletters and distribution-list traffic
are excluded on purpose. A dashboard that counts an OOO bounce as a client touch will tell you
a relationship is warm days before it goes cold — the exact failure this page exists to prevent.
The subject line and counterparty are shown in the drawer so the signal can be checked, not
just trusted.

Graph scopes in use: `Mail.Read`, `Calendars.Read`.

---

## News

A per-client web search over a domain whitelist (company IR pages, named trade press, named
market wires), restricted to the last 90 days. Generic name searches on mid-market private
corporates return mostly noise — name collisions and press-release spam — so the whitelist is
the point, not an optimisation. Clients with no hits show "Nothing picked up in the last 90 days"
rather than filler.

---

## Design notes

- **Stage is ordinal, not categorical.** It is a funnel, so it uses a single-hue ramp from light
  (Discovery) to dark (Live): darker literally means closer to revenue. Colouring stages as four
  unrelated hues would throw away that ordering.
- **Attainment alone flatters you.** `62.0% of budget` in September sounds healthy until you see
  the calendar is 70.4% through the year. Every revenue figure on the page — headline meter,
  cumulative chart, per-client row — carries the pace marker beside it.
- **Attention ranking** is contact gap ÷ stage tolerance, weighted by budget at risk. A 39-day gap
  on a $1.85mm Live account outranks a 76-day gap on a $400k Discovery name, which is why the
  list is not simply sorted by days.
- Palette validated for colour-vision deficiency and contrast in both themes.

---

## Not built, deliberately

**Editable tasks and write-back to monday.com.** Monday stays the system of record. A dashboard
you can tick things off in becomes a second source of truth that silently disagrees with the
board, and you find out which one was wrong at the worst moment. If write-back is wanted later
it should go through the monday.com API so the board stays authoritative — a decision worth
taking after the read-only version has been used for a few weeks.
