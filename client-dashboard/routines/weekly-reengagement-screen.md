# Weekly re-engagement screen — Routine setup

Feeds the **Re-engage** view of the Americas Origination Desk. It screens Prospect and Lost names
for news that gives a reason to go back, and writes the result to the artifact's data store.

This is a **different Routine** from the weekly contact check and the daily news screen. Keep them
separate: this one reads no mailbox, touches no revenue, and runs against a different roster.

## Steps

1. Go to **claude.ai/code/routines** and click **New routine**.
2. **Name**: `Weekly re-engagement screen — Americas`
3. **Prompt**: paste the block below, verbatim.
4. **Repositories**: add `manburaglia1984/Pricing_Models`, so the session has this file and the
   column mapping in `client-dashboard/README.md`.
5. **Environment**: `Default`.
6. **Select a trigger** → **Schedule** → **Weekly**, Sunday evening or Monday early. Times are
   entered in your local zone and converted automatically, so this holds through the daylight-saving
   change with no UTC arithmetic.
7. **Connectors**: keep **monday.com** only, and remove the rest. This screen needs the board and
   the web; it has no business in your mailbox.
8. Click **Create**, then **Run now** rather than waiting for Sunday.

---

## Prompt

```
You are screening Silver Birch's cold Americas names — Prospect and Lost — for news that would
give Manuel Buraglia a reason to go back to them. This is idea generation, not reporting. A week
with nothing found is a legitimate result; say so rather than padding.

Do not touch revenue, forecast or facility figures anywhere in this task. These names are not
forecastable and a number beside a lost name invites exactly the wrong reading.

STEP 1 — GET THE LIST
Read the artifact data store document `coldroster/current`. It holds the names to screen, each
with its client, country, solution, the reason it stalled, a posture, and the route in. The
dashboard writes it every time it loads, so it is current. If it is missing or empty, stop and
say so — do not fall back to reading the board yourself, because the roster already applies the
cutoff and the reason mapping.

Read `domains/current` too. Where a client appears there with status "confirmed", use its domains
as the search key. Where it does not, you are searching on the company name alone.

STEP 2 — WHAT TO LOOK FOR
For every name, search the last 8 days for any of this standing list:

  cfo-change  A new CFO, Group Treasurer or finance director. This is the strongest signal in the
              book: a new finance chief has no ownership of the previous no. It reopens even the
              names whose only recorded reason is "Client not interested".
  wc-stress   Receivables stretching, inventory building, DSO or payment terms under pressure,
              a supplier dispute, a liquidity squeeze.
  funding     A bond, a refinancing, a new or renewed credit line, an IPO, a private placement.
  capex       A new plant, added capacity, a new market or country entry.
  ma          An acquisition, a divestment, a joint venture, a spin-off.
  rating      A rating action or outlook change from Moody's, S&P or Fitch.

Additionally, where the roster gives that name a posture of "catalyst", the reason field names a
specific thing that would flip it. Search for that too, and mark any hit `"matched": true`:

  Price too high                        -> funding cost rising: a bond priced wide, a downgrade,
                                           a bank line repriced. Their cost of capital moving
                                           toward ours is the opening.
  Accounting treatment                  -> a peer winning derecognition, an auditor change, a
                                           standard revision. Precedent moves this one.
  Tax/Regulation/Legal                  -> the rule changing, or a structure approved in-country.
  Competitor offer preferred            -> the incumbent facility maturing, the competitor
                                           retrenching, or terms repriced.
  Client opted for alternative solution -> the alternative underperforming or being outgrown.
  Client busy with other projects       -> that project finishing: an ERP go-live, an IPO priced,
                                           an acquisition closed.
  Geopolitical events                   -> the situation resolving, capital controls easing.
  Solution not appropriate for client   -> a change in what they need.
  One-time deal                         -> a second transaction of the same shape appearing.

Names with posture "ours" — Lack of investor appetite, SB Declined — are blocked on Silver Birch's
side, not the client's. Still screen them, but never mark a hit `matched`, and say plainly in the
angle that this reopens on our own distribution appetite rather than on anything they announced.

STEP 2b - ADVERSE NEWS IS A SEPARATE LANE
Some of what you find will be bad news. Record it, but never as an opening. Give the signal
"tone": "risk" and one of these kinds, and it goes to a separate Watch-outs panel:

  risk-credit       A downgrade, a covenant breach, a default, a restructuring, a liquidity squeeze.
  risk-legal        A fine, an investigation, litigation, a sanction, a licence at risk.
  risk-governance   Fraud, an auditor resigning, a finance chief leaving under a cloud.
  risk-operational  A plant closing, a strike, a supply failure, a major disruption.
  risk-other        Adverse, outside the listed kinds.

A risk never carries "matched": true, and its angle should say what it means for us rather than how
to sell into it - whether the name is approachable at all, whether the exposure touches something
already live, whether Credit should see it first.

Risk flags have a longer shelf life than openings. An opening goes stale in a fortnight; a
restructuring does not. Where you record an older risk, say so in the angle.

A name can carry both. That case is the most useful thing this screen produces: a reason to call
and a reason to check first, side by side.

"matched": true requires a stated reason to answer. Where the board records no reason the flag is
meaningless, and the page will ignore it.

STEP 3 — WRITE THE ANGLE
Each signal carries an `angle`: one or two sentences saying why this specific event gives us a way
back in with this specific name. The angle is the product. A headline with no angle is noise.
Write it the way you would brief someone walking into the call:
  - name the change, then what it does to their working capital or their appetite
  - connect it to the reason it stalled, where there is one
  - where the solution should change, say so ("this is an inventory conversation now, not the
    PRM one that stalled")
Use Silver Birch terminology: AFL, not SPV. IPU, not guarantee. Servicer, not collector. PRM, not
receivables finance. SB TradeCo, not trading entity. Offer File, not portfolio submission.

STEP 4 — BE HONEST ABOUT WHAT YOU COULD NOT DO
Most of these clients have no confirmed domain, so you are matching on company name. That produces
false positives on short or common names. Do not record a signal you cannot tie to the right
company. Where a name is too ambiguous to screen safely, leave it out of `rows` entirely and count
it in the coverage line.

STEP 5 — WRITE THE RESULT
Write the artifact data store document `reengage/current`, replacing it wholly, in this shape:

{
  "screenedAt": "YYYY-MM-DD",
  "window":     "YYYY-MM-DD..YYYY-MM-DD",
  "screened":   <how many names you actually screened>,
  "coverage":   "<N> names screened to <date> - <X> by domain, <Y> by name only",
  "caveats":    ["anything the reader should distrust"],
  "rows": [
    { "id": "<the deal id from coldroster, as a string>",
      "client": "<client name>",
      "signals": [
        { "date": "YYYY-MM-DD",
          "kind": "cfo-change|wc-stress|funding|capex|ma|rating|other|risk-credit|risk-legal|risk-governance|risk-operational|risk-other",
          "tone": "risk",          (omit this line entirely for an opening)
          "matched": true|false,   (only ever true when the board records a reason this answers)
          "headline": "<what happened, one line, factual>",
          "angle": "<why it gives us a way back in>",
          "source": "<publication>",
          "url": "<link>" } ] }
  ]
}

Include a name in `rows` only when it has at least one signal. Names with nothing found are
omitted, and the dashboard reads their absence correctly.

Cap it at three signals per name, strongest first, and do not carry a signal over from last week:
this document is replaced whole each run, and the view is meant to read as "this week".

STEP 6 — REPORT
Reply with a short summary: how many names screened, how many
produced an opening, how many produced a risk flag, how many were reason-matched, and the two or
three you would actually call first. Name any name carrying both an opening and a risk. Name
anything you could not screen and why - a company too small or too generically named to match
safely is a gap to report, not a gap to fill with a guess.
```

---

## What the dashboard does with it

- `screened` and `coverage` show under the **Openings** heading.
- Each `signals` entry becomes a card, ranked: `matched` first, then the standing-list order
  (cfo-change, wc-stress, funding, capex, ma, rating), then recency.
- A name with posture `ours` gets a dashed amber border and a "waiting on us" chip, whatever the
  signal says.
- Anything with `tone: "risk"` is kept out of Openings entirely and rendered in **Watch-outs**, in
  red, ranked only against other risks. It can never outscore an opening.
- `matched: true` is ignored unless the board actually records a reason for that name.
- No screen yet, or an unreadable one, shows a named empty state rather than a blank panel.
