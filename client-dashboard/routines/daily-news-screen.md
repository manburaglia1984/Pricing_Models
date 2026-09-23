# Daily news screen — Routine setup

**Status: live.** `trig_01AKU4SLC93DK6HpjC3PQnzz`, daily at 10:30 UTC, **push and email** to the
owner. It replaced `trig_018rAxM4dMwUUw5E3DWuhad7`, which was push-only — `update_trigger` cannot
change a notification channel, so the Routine had to be recreated and its run history restarted.

Covers the **live book only**. Prospect and Lost are screened by
`routines/weekly-reengagement-screen.md`, weekly, and must never appear here.

## What it delivers

- Writes `news/current`, which the dashboard reads live. Favourable items become news chips and
  drawer entries; items carrying `tone: "risk"` go to the **Watch-outs — live book** panel.
- Emails and pushes to the owner **only when there is something**, and on **Fridays regardless**,
  so that silence on the other four days reads as "clear" rather than "broken".

## Delivery, and its limit

The Routine notification channel reaches **the account owner only**. It is not a distribution list.

There is no way to mail a team from here: the Microsoft 365 connector holds read-only scopes
(`Mail.Read`, `Mail.Read.Shared`, `Mail.ReadBasic` and the rest — no `Mail.Send`) and exposes no
send tool at all. Reaching colleagues needs one of:

- the owner forwarding the mail, which is what it is set up for today;
- sharing the Artifact from its share menu, so the team reads the same live page. This is now in
  place: the Artifact read `sharing: owner` on 17 September and `sharing: users` later the same
  day, so viewers see the Watch-outs panel live without any mail being sent;
- an Entra admin granting `Mail.Send` **and** the connector exposing a send capability.

## Exposure ranking

The page computes an exposure score per deal and publishes it on `roster/current`, so the screen
can rank an adverse story by how committed we are rather than by how big the story is:

| Component | Points |
|---|---|
| Live or Implementation | 4 |
| Validation | 2 |
| Discovery | 1 |
| Mandate signed | +2 |
| Term sheet shared | +1 |
| Legal documentation executed | +2 (in progress: +1) |

Bands: **high** ≥ 6, **mid** ≥ 3, **low** below.

> **Why 6 and not 7.** Live plus executed documentation scores exactly 6 and has to read as high —
> money is out and the paper is signed. Requiring a mandate date on top would push the oldest and
> most committed deals *down* the list, because their earlier columns were often never filled in.
> The threshold is set by the case it must not get wrong.

## The failure that prompted this

On 17 September the screen searched **Liberty Latin America** and returned a preferred dividend,
tiered `note`. It did not see the creditor restructuring counterproposal at **Liberty Puerto
Rico** from 11 September — USD 3.1bn of debt, 8.0x net leverage, 14.1x on covenant terms — even
though *Liberty Puerto Rico Handsets AFL* is **Live with documentation executed**.

Two things came from that: the prompt now requires searching the **entity as well as the group**
and preferring what it finds at entity level, and risk items are kept for **30 days** rather than
7, because a restructuring does not stop mattering because a week passed.

## Length and merging (added 23 September)

The dashboard shows each deal as one compact row and keeps full text for the alert centre, so the
prompt now caps a **headline at 140 characters** and a **why line at 280**, keeps research notes out
of both, allows **at most 3 items per deal**, and **folds a developing story into its existing alert**
rather than adding a new one. It also rewrites any stored item that breaks those limits — including
items written before the rule — so the long September entries are cleaned up on the next run.

The prompt was changed in place with `update_trigger`; this Routine was created by an agent, so that
is allowed. The weekly Re-engage Routine was created from the web form and must be edited there.

## Rebuilding it

Everything is in the prompt stored on the Routine. To change the schedule, name or enabled state,
`update_trigger` works in place. To change the **notification channel** the Routine must be deleted
and recreated with `notifications: {push, email}` — and `create_trigger` rejects a `connectors`
parameter in this organisation, so omit it (this screen needs none: artifact database plus
WebSearch only).
