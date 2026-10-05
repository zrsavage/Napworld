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

**Buildings & elite troops (v4)**
- Buildings unlock better soldiers in the province where they stand: **Barracks** (+50% manpower, Grenadiers), **Stables** (Lancers, Heavy Cavalry, cheaper cavalry), **Arsenal** (Horse Artillery, cheaper guns), **Military Academy** (needs Barracks; Guard Infantry, new regiments start as veterans), **Market** (+50% income), **Fortifications**. Capitals start with several.
- Veteran regiments (from an Academy or from winning battles) get a morale and firepower bonus and show a ★.
- Hover anything for a tooltip: every unit and building explains its role, stats, unlocks and requirements.
- The start screen rates every nation from Beginner to Expert with a reason; **Russia** is the best first pick, **Britain** a relaxed second.

**Campaign depth added in v3**
- **War score & peace terms:** battles and conquests build war score; negotiate white peace, demand gold or an occupied province, pay tribute or return land. AI nations may offer peace for a price.
- **Unrest & occupation:** conquered provinces grow restless unless garrisoned (income penalties, then revolt). Province **policies** (taxation / conscription / martial order).
- **Supply & fatigue:** armies far from friendly soil suffer attrition; marching tires armies; **forced marches** move two provinces per turn.
- **Sieges:** starve a fortress out or **storm the walls**; relief armies break sieges. Britain subsidises its allies.
- **Turn report & autosave:** a monthly summary of money, battles and gains/losses; autosave every turn.
- **Tutorial:** guided first-turn tutorial (Start screen), practice battle with live tips, in-game help, period-style event illustrations, procedural sound and music.

**v5: the big "do it all" update**
- **Battle readability:** red target lines and rings for attack orders, move flags with facing arrows, flank arcs (green front, yellow flanks, red rear) for the selection and for whatever you hover, pause-and-plan (orders work while paused), control groups, casualty numbers floating off hit regiments and a red hit-flash.
- **Objectives:** flagged points (village, hill, crossroads) are captured by presence. They score victory points; hold them all for 75 s or lead by 25 VP at the time limit. The AI contests them.
- **Campaign pacing:** needs-attention panel, idle-army warning on End Turn, and **Advance ▶▶** (up to 6 turns, stops on battles, lost provinces, idle armies or supply trouble).
- **Supply & seasons:** supply lines are drawn for armies out of supply, **Forage** (fewer losses, ruins the province), harsher winters, seasonal map tint.
- **Generals as characters:** traits (Aggressive, Steadfast, Cavalryman, Gunner, Inspiring, Logistician), loyalty, rising colonels, hireable staff officers.
- **Diplomacy:** trade agreements, military access, royal marriages, and a **war goal** chosen when you declare war (demanding it in peace talks is easier).
- **Sound & polish:** positional battle sound, bugle/hoof cues, dust trails.
- **Map:** province borders prefer to follow rivers and mountain ridges; hover a province for an info card.
- **Tooling:** `node tools/balance.js battles|campaign|all` runs repeatable battle matchups and bot-played campaigns (needs Playwright + Chromium).
- **Range cones** (toggle with V) show every regiment's firing reach: guns cover most of the field, light infantry out-range line, cavalry show charge reach. **AI nations raise militia only to even the odds: while at war, outnumbered by their strongest enemy, with cash in hand, and never more than a third of their army. **Militia** are very cheap (40g; after 3 battles they can be upgraded to Line Infantry for free) but short-ranged, weak in melee and break easily.
- **National pluses and minuses:** every nation has two strengths and two weaknesses (e.g. Russia: vast manpower and hardy in the cold, but serf conscripts with weak morale and poor tax collection; Britain: disciplined volleys and rich trade, but a small, costly army). They are shown on the nation cards and defined in `NAP.PERKS` in `js/data.js`.
- **Saves** are versioned and older saves are migrated; saves from a newer game version are refused politely.

**v6: navy and Franconia**
- **PC only:** the game targets desktop browsers with mouse and keyboard. Touch and mobile layouts are not supported and the pinch-zoom code has been removed.
- **Bavaria** gains a fourth province, **Franconia**, with its own garrison.
- **Fleets and basic naval warfare:** Ships of the Line and Frigates are built at a **Shipyard** (ports only). Five sea zones (Atlantic & North Sea, Western Mediterranean, Eastern Mediterranean, Black Sea, Baltic) connect through shared ports. Select a fleet and choose a destination, or right-click a sea ring or friendly port.
  - Hostile fleets in the same zone fight an automatic battle (docked fleets get a defender bonus plus fort level); beaten fleets shelter in a friendly port or are scattered.
  - A fleet alone at sea **blockades** enemy ports in that zone: income halved, no shipbuilding. Armies cannot sail across a zone held by an enemy fleet unless they have a fleet of their own there.
  - Ships cost upkeep. Britain gets +25% fleet strength; most nations start with a small fleet. The AI builds fleets in proportion to its income and fights, blockades or stays in port.

**Tactical battles** (real-time, rectangles on a field)
- Regiments as blocks with **formations** (line, column, square, skirmish), facing, **flanking / rear** bonuses,
  musket and artillery **range** (canister up close), cavalry **charges**, squares vs cavalry, fatigue,
  **morale**, routing and rallying, terrain (hills, forests, villages, rocks) and a commander with an aura
  who can rally broken units.
- **Battle minimap** (bottom right; click/drag to move the view).
- **Visible fire:** tracer dashes and muzzle flashes for muskets, round shot with trails and dirt bursts for guns. Regiments locked in melee pulse with a white halo and go solid white when they break. Villages are drawn as proper villages (cottages, church, fields, road) and terrain is captioned.
- **Battle speed** starts at ½x with ¼x slow-motion and 1x/2x/4x.
- **Zoomable battlefield (0.4x–8x):** smooth wheel zoom toward the cursor, PageUp/PageDown, Fit (Home), Focus selection (F), middle-drag or arrow-key panning. Zoomed in, every regiment is drawn soldier by soldier; as men fall the block shrinks, its ranks thin out and fray, standards are lost and morale makes the line shuffle and scatter.
- **Weather & time of day:** rain weakens muskets, fog shortens sight, snow slows and tires, dusk ends the battle at nightfall. Fortified provinces put walls on the field.
- **Smarter AI:** reserves, skirmish screens and artillery that withdraws from cavalry.
- **Manual deployment:** before the battle starts, place and re-form your regiments inside a shaded deployment zone. The zone depends on the situation (defenders deploy deeper, mountains shrink it, rocks block placement) and AI defenders dig in on hills.
- **After-action report and replay:** per-regiment losses, kills and fates, plus a replay of the whole battle at up to 24x.
- Select with click / drag-box, right-click to move or attack, right-drag to draw a battle line.
  Or just **auto-resolve** any battle.

## Playable single-file build

`python3 tools/build_single.py` bundles everything into `dist/napworld.html` (a standalone page; just open it) and
`dist/napworld.artifact.html` (body-only fragment for hosts that provide their own `<html>`). Rebuild after changing any source file.

## Controls

| Campaign | |
|---|---|
| Left-click | select province / army |
| Right-click | order selected army to move (shows route preview) |
| Drag / wheel | pan / zoom |
| Enter | end turn |
| Minimap | click / drag (bottom-left) to jump around the map |
| D | diplomacy |
| ⚑ button | needs-attention list (click an item to jump to it) |
| ▶▶ button | advance turns until something needs you |

| Battle | |
|---|---|
| Left-click / drag | select / box-select (double-click selects all of a type, Ctrl+A all) |
| Right-click | move (on an enemy: attack; Ctrl/Shift+right-click: charge) |
| Right-drag | draw a line to deploy selected units facing the enemy |
| F1 / F2 / F3 / F4 (or Shift+1-4) | Line / Column / Square / Skirmish |
| Ctrl+1-9 / 1-9 | save / recall a control group (press twice to centre the view) |
| C / H / R | Charge / Halt / Rally (general) |
| Space, + / − | Pause, game speed |
| WASD / arrows, wheel | pan, zoom |
| ½x–4x speed buttons, +/− | battle speed (starts at ½x) |

## Layout

```
index.html        page shell
css/style.css     UI styling
js/data.js        coastlines, provinces, factions, units, generals, starting armies
js/audio.js       procedural sound effects and music (WebAudio)
js/guide.js       tutorial steps, battle tips, practice battle, event illustrations
js/world.js       province raster generation (geodesic Voronoi on land) and map rendering
js/campaign.js    game state, economy, movement, sieges, diplomacy, AI, events
js/battle.js      real-time tactical battle engine + enemy AI
js/ui.js          start screen, panels, dialogs, input
```

Difficulty (Easy / Normal / Hard) shifts player vs AI income, AI aggression and willingness to make peace. War exhaustion, 12-month truces and a last-stand bonus for tiny states keep the AI from snowballing.
Tuning knobs live at the top of `js/campaign.js` (`INCOME_K`, `MP_K`, `WIN_SHARE`, …) and the stat tables
in `js/battle.js` (`BT`) and `js/data.js` (`UNITS`, `FACTIONS`).
