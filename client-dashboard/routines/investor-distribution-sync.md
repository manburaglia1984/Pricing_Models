# Investor Distribution sync — Routine setup

**Status: created, not yet able to run.** `trig_01XhDoD6f2pWwW9vC3hPyCC8`, Monday to Friday at
10:00 UTC (06:00 New York in summer time, 05:00 in winter), push and email to the owner, a fresh
session each run.

**It has no monday.com connector.** Routines created from a session cannot attach connectors in
this organisation (`create_trigger` refuses the `connectors` parameter), so the fired session has no
monday tools. Until the owner adds monday.com to the Routine in claude.ai, every run stops at its
first line and reports that it could not run. If the Routine settings do not allow adding a
connector to an existing Routine, recreate it there with the prompt below and delete this one.

## What it does

Keeps the **Investor Distribution** board (`18432728154`) in step with Global Pipeline:

- every deal in Live, Implementation, Validation or Discovery, **Americas and RoW**, has exactly one
  item, in the group for its stage;
- a deal that moves stage is moved to the matching group;
- a deal that leaves those stages (Prospect, Hold, Lost) moves to **Off pipeline**, so its investor
  subitems are kept, and moves back if the deal is revived;
- names and Region are corrected when they drift from Global Pipeline.

It never deletes anything, never touches a subitem, and never writes to Global Pipeline or
Investors_2026. Duplicates, unlinked items and deals removed from Global Pipeline are reported for a
person rather than fixed. It is silent when nothing changed.

## Why a Routine and not a monday automation

monday can create a linked item on another board when a Status changes, but its documentation
shows no way to check whether the deal is already listed (so a Discovery → Validation move would add
it twice) and no way to move an item between groups on a different board. A reconciler that
compares the two boards and matches on the Deal link handles creation, stage moves and leavers with
one rule. The cost is latency: a new deal appears the next weekday morning, or on demand.

## Prompt

```
Weekday sync: keep the Investor Distribution board in step with Global Pipeline, for Manuel Buraglia (MD, Originate to Distribute, Americas, Silver Birch Finance).

Use the monday.com tools only. Do not use the Artifact tools, Outlook or web search.
If no monday.com tools are available in this session, stop and report exactly that in one line: "Investor Distribution sync could not run: no monday.com connector in the routine session."

WHAT THE BOARD IS
Investor Distribution (board 18432728154) holds ONE ITEM PER DEAL, grouped by pipeline stage, with the investors shown each deal as SUBITEMS underneath. People add and edit the subitems by hand. Your job is only the deal list: every deal in Live, Implementation, Validation or Discovery on Global Pipeline must have exactly one item here, in the group for its current stage; a deal that leaves those stages moves to Off pipeline so its investor history is kept.

IDS
Global Pipeline: board 18299408349. Status column color_mkx6xtq7. Groups: Americas group_mkx6kssm, RoW group_mkxmh6fm (both regions are in scope).
Status LABEL IDS - filter on these, not on label indexes, which silently return the wrong stages: Live 1, Implementation 0, Validation 8, Discovery 2. (Prospect 3, Hold 4, Lost 9.)
Investor Distribution: board 18432728154.
  Deal column (link to Global Pipeline): board_relation_mm7h71e0 - this is the ONLY match key between the two boards. Never match on name.
  Region column (dropdown, labels Americas / RoW): dropdown_mm7hyx3w
  Groups: Live group_mm7hf6z7, Implementation group_mm7hprvx, Validation group_mm7hn6kr, Discovery group_mm7hbewp, Off pipeline group_mm7hhqgw

STEP 1 - READ THE PIPELINE. get_board_items_page on 18299408349, filter color_mkx6xtq7 any_of [1,0,8,2], includeColumns true, includeGroup true, columnIds [color_mkx6xtq7], limit 500; follow nextCursor until has_more is false. For each deal keep id, name, status label, and region (Americas if its group is group_mkx6kssm, otherwise RoW).

STEP 2 - READ THE DISTRIBUTION BOARD. get_board_items_page on 18432728154, includeColumns true, includeGroup true, columnIds [board_relation_mm7h71e0, dropdown_mm7hyx3w], limit 500, no subitems; follow nextCursor. For each item keep item id, name, group id, region, and the linked deal id (the first entry of board_relation_mm7h71e0, or none).

STEP 3 - RECONCILE PIPELINE DEALS. For every pipeline deal:
- No distribution item links to it: create one (create_items, up to 20 per call) named exactly as the deal, in the group for its status, with board_relation_mm7h71e0 {"item_ids":[<deal id>]} and dropdown_mm7hyx3w {"labels":["Americas" or "RoW"]}.
- Exactly one item links to it: if its group is not the group for the deal's status, move it (GraphQL: mutation { move_item_to_group(item_id: <id>, group_id: "<group>") { id } }). If its name differs from the deal's name, rename it. If its region differs, correct it (change_multiple_column_values on board 18432728154).
- More than one item links to it: change nothing on any of them and list them in the report as duplicates for a person to merge. Merging would mean moving investor subitems between parents, which is a person's decision.

STEP 4 - RECONCILE LEAVERS. For every distribution item whose linked deal is not in the Step 1 set:
- Look the deal up (get_board_items_page on 18299408349 with itemIds, up to 100 per call, columnIds [color_mkx6xtq7]).
- If it exists (Prospect, Hold, Lost or any other status) and the item is not already in Off pipeline, move it to Off pipeline.
- If it no longer exists on Global Pipeline, move the item to Off pipeline and list it in the report as "deal removed from Global Pipeline".
Items with no deal link at all: change nothing, list them in the report.

RULES
- Never delete an item. Never create, edit, move or delete a subitem. Never write to Global Pipeline or to Investors_2026.
- Change nothing that is already right. A run on an unchanged pipeline makes no writes at all.
- Before creating an item for a deal, re-check that no item links to it, so a partial earlier run can never produce a duplicate.
- If a monday call fails, retry it once. If the board or a column id no longer exists, stop, write nothing more, and report exactly which id failed.

STEP 5 - REPORT. Silent on a day with no changes and nothing to flag: send nothing. Otherwise, under 120 words, no preamble, plain text:
- Added: deal names, grouped by stage, with "add the investors you are showing it to" once.
- Moved: deal - from group -> to group.
- Moved to Off pipeline: deal and its new status.
- Needs a person: duplicates, items with no deal link, deals removed from Global Pipeline.
Never mention that you ran or that nothing else changed.

Use Silver Birch terminology: AFL (not SPV), IPU (not guarantee), Servicer (not collector), PRM (not receivables finance), SB TradeCo (not trading entity), Offer File (not portfolio submission).
```
