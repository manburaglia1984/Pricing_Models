# Weekly contact check — Routine setup

The API cannot attach connectors to a Routine in this organisation, so the durable version has to be
created from the web form, where connectors are attached by default. Ten minutes, once.

## Steps

1. Go to **claude.ai/code/routines** and click **New routine**.
2. **Name**: `Weekly contact check — Americas Origination Desk`
3. **Prompt**: paste the block below, verbatim.
4. **Repositories**: add `manburaglia1984/Pricing_Models`. The session then has this README and the
   monday.com column mapping to work from.
5. **Environment**: `Default` is correct. Connector traffic routes through Anthropic's servers, so
   the Trusted network policy does not need changing.
6. **Select a trigger** → **Schedule** → **Weekly**, Monday morning. Times are entered in your local
   zone and converted automatically, so this stays at 07:00 ET through the daylight-saving change —
   no UTC arithmetic and no drift in November.
7. **Connectors** (bottom of the form): every connected connector is included **by default**. Keep
   **monday.com** and **Microsoft 365**. Remove the rest — during a run Claude can call any tool from
   an included connector, writes included, without asking.
8. Click **Create**, then **Run now** on the detail page to prove it works rather than waiting a week.

Then delete the interim Routine `trig_01RfKJfX5psmTufj39NDw6HW` ("Weekly contact check"), which binds
to a session that will not live forever.

---

## Prompt to paste

```
Refresh the contact check for the Americas Origination Desk dashboard, for Manuel Buraglia (MD,
Originate to Distribute, Americas, Silver Birch Finance).

ARTIFACT: https://claude.ai/artifact/1DrnRq8yHtQ6EFyYtmo1sf
Read client-dashboard/README.md in the repository first — it holds the monday.com column mapping and
the rules this task depends on.

FIRST: confirm monday.com and Microsoft 365 are both available. If either is missing, STOP, write
nothing, and say which one is gone. Never write a partial or guessed result.

1. ROSTER. Read `roster/current` from the artifact database for the deal list. If it is missing, pull
   the Americas group of the Global Pipeline board instead (board 18299408349, group_mkx6kssm,
   Status label ids 0, 1, 2, 8 — these are label IDS, not indexes: Live=1, Implementation=0,
   Validation=8, Discovery=2) and note that the dashboard has not been opened recently.

2. BOARD DATES. Pull each deal's Date Last Contact (`date_mkxjfs3x`) fresh from monday.com. The board
   moves, and a stale board date makes every verdict wrong.

3. OUTLOOK, PACED. For each distinct client:
   - outlook_email_search with `recipient` set to a distinctive token from the client name — partial
     addresses match, so no domain is needed — limit 1, newest first.
   - outlook_calendar_search with query "*", `attendee` set to the same token, order "newest",
     afterDateTime two years back, limit 1.
   Microsoft Graph rate-limits concurrent mailbox calls (ApplicationThrottled / MailboxConcurrency).
   Run at most THREE calls in parallel and honour retryAfterSeconds on a 429. A sweep of ~35 clients
   takes several rounds; that is expected, not a failure.
   Calendar outranks mail: the attendee list proves the client was in the room, where a mail match on
   a name token can be a false positive. Discard any match you cannot tie to the client — a previous
   sweep matched "cantu" to a CEAT thread and "lla.com" to an unrelated one — and record those as
   no-trace rather than inventing evidence.

4. VERDICTS, per deal. Last touch = the later of the newest mail and the newest PAST meeting.
   - corroborated: board and Outlook agree within 7 days
   - board-stale: Outlook shows a later touch than the board (the page then uses the Outlook date)
   - unconfirmed: the board is more than 21 days newer than anything Outlook can see
   - no-trace: nothing credible found, or no client linked on the board
   Hold the asymmetry: Outlook proves the board is BEHIND, never that it is WRONG. A phone call, or
   mail from another account, leaves no trace. Never move a contact date backwards.
   Capture any FUTURE meeting with a client attendee separately as nextMeeting / nextMeetingSubject /
   nextMeetingWith. A meeting already in the diary matters more than the gap number.

5. WRITE `contact/current` to the artifact database, whole-document replace, with: checkedAt, method,
   source, caveats[], toleranceDays 7, unconfirmedAfterDays 21, and deals[] of { id, verdict, board,
   outlook, channel ("email" or "meeting"), who, subject, gap, note?, nextMeeting?,
   nextMeetingSubject?, nextMeetingWith? }. Plain ASCII punctuation only. Pin the write with
   if_version from your read. Do NOT republish the artifact — the page reads this live.

6. REPORT. Under 120 words, no preamble. Only: deals that moved into unconfirmed since last week; any
   Live or Implementation deal whose real gap is now past double its stage tolerance; and any client
   meeting in the diary for the coming week. If none of those apply, say "No change worth acting on"
   and nothing else.

Silver Birch terminology throughout: AFL (not SPV), IPU (not guarantee), Servicer (not collector),
PRM (not receivables finance), SB TradeCo (not trading entity), Offer File (not portfolio submission).
```

---

## Notes

- Routines belong to your individual claude.ai account, are not shared with the team, and count
  against your daily routine run allowance.
- A green status in the run list means the session started and exited cleanly — not that the task
  succeeded. Open the run to read what actually happened.
- If you see "Routines are disabled by your organization's policy", an Owner enables them with the
  Routines toggle at claude.ai/admin-settings/claude-code.
