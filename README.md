# Napworld

A Total War–style grand strategy game set in Napoleonic Europe (1805–1815), built with plain
HTML/CSS/JavaScript and `<canvas>` — no build step, no dependencies. Open `index.html` in a browser
(or serve the folder with any static server, e.g. `python3 -m http.server`).

## What's in it

**Campaign map** (turn-based, 1 turn = 1 month)
- ~105 provinces across Europe, the Near East and North Africa; the map is generated at load time from
  simplified real coastlines (`js/data.js`), so shapes and borders follow the geography of Europe.
- 12 playable factions + neutral states: France, Britain, Austria, Prussia, Russia, Ottomans, Spain,
  Portugal, Sweden, Denmark-Norway, Naples, Bavaria & allies.
- **Armies & conquest:** move armies province-to-province (BFS pathing, multi-turn orders), sea transport
  between ports (abstract water logistics: no fleets, up to 12 regiments per crossing), sieges of fortified provinces (artillery speeds them up),
  winter attrition in Russia and foraging attrition in enemy lands.
- **Economy & recruitment:** province income and manpower, upkeep, six unit types (line, light, guard,
  light/heavy cavalry, artillery), recruitment queues, Market / Barracks / Fortification buildings.
- **Diplomacy & AI:** wars, peace, alliances, relations, allies joining wars, AI factions that recruit,
  build, plan campaigns, declare wars and sue for peace.
- **Generals & events:** ~90 historical generals (Napoleon, Wellington, Kutuzov, Blücher, Archduke Charles…) with
  attack/defence/leadership stats, XP and level-ups, historical arrival dates; scripted events
  (Third Coalition, Trafalgar, Continental System, Tilsit, Spanish Uprising, Russia 1812, Sixth Coalition,
  Hundred Days…) plus random events.
- Win by holding 55% of Europe or eliminating every rival; survive to the end of 1815 for a territorial score.
  Save/load via browser storage.

**Tactical battles** (real-time, rectangles on a field)
- Regiments as blocks with **formations** (line, column, square, skirmish), facing, **flanking / rear** bonuses,
  musket and artillery **range** (canister up close), cavalry **charges**, squares vs cavalry, fatigue,
  **morale**, routing and rallying, terrain (hills, forests, villages, rocks) and a commander with an aura
  who can rally broken units.
- **Manual deployment:** before the battle starts, place and re-form your regiments inside a shaded deployment zone. The zone depends on the situation (defenders deploy deeper, mountains shrink it, rocks block placement) and AI defenders dig in on hills.
- **After-action report and replay:** per-regiment losses, kills and fates, plus a replay of the whole battle at up to 24x.
- Select with click / drag-box, right-click to move or attack, right-drag to draw a battle line.
  Or just **auto-resolve** any battle.

## Controls

| Campaign | |
|---|---|
| Left-click | select province / army |
| Right-click | order selected army to move (shows route preview) |
| Drag / wheel | pan / zoom |
| Enter | end turn |
| Minimap | click / drag (bottom-left) to jump around the map |
| D | diplomacy |

| Battle | |
|---|---|
| Left-click / drag | select / box-select (double-click selects all of a type, Ctrl+A all) |
| Right-click | move (on an enemy: attack; Ctrl/Shift+right-click: charge) |
| Right-drag | draw a line to deploy selected units facing the enemy |
| Q / W / E / R | Line / Column / Square / Skirmish |
| X / H / G | Charge / Halt / Rally (general) |
| Space, + / − | Pause, game speed |
| WASD / arrows, wheel | pan, zoom |

## Layout

```
index.html        page shell
css/style.css     UI styling
js/data.js        coastlines, provinces, factions, units, generals, starting armies
js/world.js       province raster generation (geodesic Voronoi on land) and map rendering
js/campaign.js    game state, economy, movement, sieges, diplomacy, AI, events
js/battle.js      real-time tactical battle engine + enemy AI
js/ui.js          start screen, panels, dialogs, input
```

Difficulty (Easy / Normal / Hard) shifts player vs AI income, AI aggression and willingness to make peace. War exhaustion, 12-month truces and a last-stand bonus for tiny states keep the AI from snowballing.
Tuning knobs live at the top of `js/campaign.js` (`INCOME_K`, `MP_K`, `WIN_SHARE`, …) and the stat tables
in `js/battle.js` (`BT`) and `js/data.js` (`UNITS`, `FACTIONS`).
