# Savage Napoleonic War Simulation

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
- **Smoother map:** province borders are now smooth vector curves traced from the territory grid (national borders thicker than provincial ones), and coastlines have more detail.
- **Bavaria** is rated "Impossible!" on the nation screen but starts with a head start (+60% gold, +2,500 manpower, about 15 extra regiments, a market and barracks in every province, an academy and a fort in the capital); `NAP.START_BONUS` in `js/data.js` holds this.
- **Bavaria** gains a fourth province, **Franconia**, with its own garrison.
- **Naval warfare is optional** (checkbox on the start screen; off by default, harder when on; never used in the tutorial). When off, the seas stay a simple transport network, there are no fleets, shipyards or blockades.
- **Fleets and basic naval warfare:** Ships of the Line and Frigates are built at a **Shipyard** (ports only). Five sea zones (Atlantic & North Sea, Western Mediterranean, Eastern Mediterranean, Black Sea, Baltic) connect through shared ports. Select a fleet and choose a destination, or right-click a sea ring or friendly port.
  - Hostile fleets in the same zone fight an automatic battle (docked fleets get a defender bonus plus fort level); beaten fleets shelter in a friendly port or are scattered.
  - A fleet alone at sea **blockades** enemy ports in that zone: income halved, no shipbuilding. Armies cannot sail across a zone held by an enemy fleet unless they have a fleet of their own there.
  - Ships cost upkeep. Britain gets +25% fleet strength; most nations start with a small fleet. The AI builds fleets in proportion to its income and fights, blockades or stays in port.

**v7: readability pass**
- **Turn playback:** each nation's moves are shown in turn with arrows and a banner (Playback: normal / fast / off in the top bar). Advance ▶▶ skips it.
- **Pursuit:** an army that marches into the province an enemy army has just left catches its rearguard (about 6% losses and extra fatigue), so constantly moving armies can be harassed.
- **Trade agreements** show the gold per month each side gains (about 7% of the partner's provincial income, max 45) in the diplomacy table and the offer dialog.
- **Compact interface:** narrower details panel (collapse it with the Details button or Tab), foldable Recruit / Construction / Navy sections, smaller minimap and dispatch log. The battle minimap only appears when you are zoomed in.
- **Title screen:** just Continue, New campaign, Load, Tutorial, Practice battle and How to play; nation choice, difficulty and the naval option are on the next screen.
- **Tidier battles:** the AI line infantry now advance as straight parallel lines and halt by themselves in range (only light infantry and militia go for objectives), lines keep step with their neighbours and face the middle of the enemy, fallen men now lie where the regiment stood, and regiments push apart more firmly.
- **Morale pressure:** hits from the flank or rear shake a regiment much harder, and regiments with enemies on their flanks, rear or all around lose morale every second (FLANKED / SURROUNDED tags show it; squares resist). Routing regiments keep a dashed team-coloured outline, flight chevrons and a ROUTING tag.
- **Generals are targets:** commanders have health, take stray fire and attacks from cavalry and guns, are shielded by nearby infantry, and can be targeted with a right-click. If one falls, every regiment loses morale at once and recovers more slowly afterward. AI cavalry will hunt an unprotected general.
- **Battle control:** a Roster strip along the bottom of the field (Q) lists your regiments with status, morale and cavalry stamina; click to select, double-click to jump, buttons select by type. Tab / Shift+Tab steps through regiments.
- **Country Overview** is now a button on the top bar (key O) showing only your own nation: finances, manpower, strengths and weaknesses, diplomacy, every army and province (click a row to jump to it). The old nation comparison table is the **Europe** button. The map's side panel shows only the region, army or fleet you select, has a close button, and stays hidden when nothing is selected. Double-click an army, fleet or province to open it and zoom to it.
- **Smarter campaign AI:** AI armies now retake their own lost land and prefer unguarded enemy provinces; with no good target they march on the nearest enemy province instead of waiting; a doomstack with open enemy land beside it splits off detachments so several fronts open at once (but stays together when enemies are on its soil); and nations reclaim lost home provinces by declaring war on neutral states at once, or on a weaker holder with some probability.
- **Performance:** map labels and symbols are drawn from cached sprites and the coast shadow is a cached layer, so panning and zooming the campaign map is several times cheaper.
- **Recovering losses:** the army panel shows missing men with a **Reinforce now** button (instant, gold plus manpower); resting at home also heals about 15% per regiment per turn. The needs-attention list flags weak armies. The side panel button is now **Country Overview**; interface fonts are Crimson Pro and Cinzel.
- **Fall Back (B):** selected regiments step back about 240 px, away from the nearest enemy and still facing them, instead of turning and routing. They break contact in good order (a few men lost, the pursuers' hits and flank pressure bite far less for the first seconds) and then hold. Cavalry simply ride clear. Shown as FALLING BACK above the regiment and in the roster.
- **Cavalry rely on angles:** a charge into the front of a steady line is repulsed (small damage, the horsemen take losses and a morale hit); a hit on the flank or rear, or against shaken infantry, is devastating (up to 30% of the regiment at once plus a rout-inducing morale shock). Lines wheel slowly, which is the cavalry's window. AI cavalry no longer charge straight in: they ride round the end of a steady line to its flank first, favouring shaken or exposed targets and guns.
- **Cavalry stamina:** galloping and fighting drain cavalry fast; their charge and melee strength scale with remaining stamina, they cannot charge when exhausted, and blown horses lose morale. A blue stamina bar shows under each cavalry regiment.
- **Clearer sides and livelier battles:** every regiment has a cyan (yours) or red (enemy) outline and tinted count, plus matching minimap outlines. Soldiers now step as they march, recoil and flash when firing, lunge and throw sparks in melee, and the standards wave.
- **Input:** mouse-wheel zoom is normalised and eased on both maps (about 10% per notch), clicks have more forgiving hit areas and drag thresholds.
- **Peace terms** now explain themselves (what a white peace is, who pays what).
- **Slower volleys:** regiments fire about every 4 to 6 seconds (guns every 6 to 8) and shooting is 40% less deadly overall, so battles last roughly a third longer and are easier to follow at 1x.
- **Battles:** muskets now reach 140 px (line) to 165 px (light), guns 480 px, so lines stand off and trade volleys; a regiment on a move order halts and opens fire when an enemy comes into range ahead of it (Ctrl+right-click moves without stopping).

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

### Forts and Portugal
- In a siege battle every victory point sits at the fortress walls (two "Fort" objectives), so the attacker cannot score by holding open ground. The defender holding them does not end the battle early; the attacker must storm the walls.
- Portugal now has three provinces (Porto & Minho, Lisbon, Alentejo & Algarve).

### Exchange and Conscription Office
- **Exchange** (needs Market): a further +50% province income. **Conscription Office** (needs Barracks): a further +50% manpower growth. The AI builds them in rich/populous provinces once it has spare gold.

### Battle handling pass
- Moving regiments march through friendly ones (at ~55% speed) instead of shoving them aside; idle regiments no longer bounce around.
- Idle regiments engage on their own: infantry only take a short step up when an enemy is just outside range (~1.12x), and stop and fire the moment anything is in range (they never chase), cavalry react to anything within ~75 px. Guns hold position. After Fall Back they hold for 7 s.
- Each regiment has a thick front edge and arrow in its team colour so facing is obvious.
- Pre-battle banner is a slim strip at the top; the deployment tip box is gone. The battle minimap hides once the battle ends.
- Diplomacy window is wider and tighter so it fits on screen.
- Campaign: a player army that is about to be attacked can **Withdraw** to a neighbouring province for 5-10% losses (once per army every 6 turns).

### Levies and cavalry pursuit
- Click the manpower figure in the top bar to **raise levies**: 500 men per lot for 600 gold, +25% for every extra lot bought in the same month (resets each turn).
- Cavalry running down routed or nearly destroyed units now spend far less stamina, and no longer lose heart from exhaustion against them.

### Hold the line, pursuit, player-first turns
- Idle regiments never leave their position on their own any more: they fire at whatever comes into range from where they stand (fortifications stay manned). Only your orders (or Fall Back) move them.
- When you win and enemy regiments are still routing on the field, you can **pursue**: the beaten army cannot rally, and you have up to 90 s to ride down what has not escaped (fleeing and destroyed regiments are tallied at the end). They must fight on, retreat in good order, or be harried by cavalry.
- Campaign turn order: **you move first** (and your battles resolve first); each CPU nation then plans and moves against the board you have just left. CPU order still rotates.

### Veteran ranks and quicker melee
- Veteran stars now go up to **4** (Seasoned 3 wins, Veteran 6, Elite 10, Legendary 16 victories); each star is +6% morale and +5% firepower.
- Melee is about twice as fast, with a further bonus when mopping up a spent regiment, and a regiment below 20% strength loses heart quickly. A 20-man remnant in contact with three regiments now breaks in a few seconds.

### Quality-of-life pass
- **Battle:** Hold/Free toggle (key G; default Hold, changeable in Settings) with a FREE tag; dashed move-preview lines from selected regiments to the cursor (red ATTACK over an enemy), and a marker per regiment while right-dragging a line; **wavering** warning (roster, unit tag and a message) before a regiment breaks.
- **Campaign:** construction queue of up to 3 buildings per province (cost paid up front, queued items can be cancelled for a refund); **Armies** list (key A) with sorting, jump-to, *Reinforce all* and *Merge all*; **Wars** overview (key W); end-of-turn report and autosave (both switchable).
- **Settings** (title screen or the gear in the top bar): 13 interface fonts, volume, starting battle speed, hold-by-default, tooltips, colour-blind battle colours, autosave, turn reports. Stored in the browser.

### Short and long games
- At **Begin the Campaign** you now choose **Short** (the standard 107-province map) or **Long** (about 148 provinces). The long map splits 41 regions in two (e.g. Paris / Orleans, London / Kent, Serbia / Bosnia, Moscow / Tula); each nation's total income and manpower stay about the same, just spread over more pieces. Saves remember their length. The tutorial always uses the short map.

### New units, march pace, siege guns
- **Rifles / Jagers** (needs Barracks): long-range, accurate open-order marksmen, weak in melee. **Dragoons** (needs Stables): mounted infantry with a short-range carbine and a lighter charge. **Siege Battery** (needs Arsenal): very long range and hard-hitting in battle, and each battery greatly speeds up sieges, but an army carrying one marches at half pace.
- **March pace:** all-mounted armies (cavalry, dragoons, horse artillery) move two provinces a turn; armies with a siege train move one province every other turn; everything else is unchanged. Shown in the army panel.
- **National regiments** (flavour only, small sidegrades; each can be raised only by its own nation): Voltigeurs (France), Highlanders (Britain), Cossacks (Russia, pursue routers harder), Grenzers (Austria), Landwehr (Prussia), Guerrilleros (Spain), Janissaries and Sipahi (Ottomans), Cacadores (Portugal), Finnish Jagers (Sweden), Marine Infantry (Denmark), Calabrian Partisans (Naples), Chevau-legers (Bavaria).

### Province panel tabs
- The province panel now has **Recruit / Build (/ Navy)** tabs instead of one long list. Units are grouped (Infantry, Cavalry, Artillery, your nation's regiments) and buildings (Economy, Military, Defence, Naval). Missing requirements are greyed with a padlock; things you cannot afford show their cost in red. The tutorial still shows everything stacked.

### Generals menu, command limits, militia and more
- **General menu** (button in the army panel): stats, traits, experience, command limit, lieutenants and special orders.
- **Command limit:** a general commands 10 + 3 per LEAD point regiments in one battle (+8 per extra general or lieutenant on the side). Regiments beyond it fight *out of command* (-10% morale, -8% fire); the battle HUD shows "Command n/cap". A lieutenant (40g, slots by general level) leads a separate army under him and widens the limit. Auto-resolved battles apply a small penalty too. This is what stops one giant stack from being the best plan.
- **Lightning march:** a general-led army moves two provinces with no losses (8 turn cooldown). **Inspire** in battle (key I): +15 morale and +10% fire near the general for 20 s, at some risk to him (90 s cooldown). AI generals with the Aggressive / Steadfast traits choose to attack or defend accordingly.
- **Battle:** saved **deployment layouts** (3 slots, Save/Load next to the Start button), weather effects badge with tooltip, and **artillery target priority** (key T: nearest / infantry / counter-battery / cavalry).
- **Local militia:** when an enemy marches into or besieges a province with no defending army, the people rise: 1-4 militia regiments fight a real battle (you can fight it yourself). They go home afterwards.
- **Scorched earth** (province policy): no income and rising unrest, but an invader there suffers extra supply loss. The AI uses it when an enemy occupies one of its undefended provinces.
- **Naval:** opposed landings cost 6% of the army (2% when your fleet covers the sea zone) plus fatigue. Frigate-only fleets docked in a blockaded port act as **blockade runners**: they win back part of the lost income (up to 85% of normal) but risk being caught.
- **Peace talks:** pick several terms at once; a live meter shows how willing they are.

### Tutorial rework
- The guided tutorial is now a *focused* lesson: the world beyond France and her neighbours is dimmed and the camera is kept on that region, most of the top bar and the dispatch log / minimap are hidden, and the instructions live in a docked panel (top-left) instead of an overlay on the map. Turn playback is switched off while it runs.
- Each lesson has an **animated mock play-through** at the top of the panel: a miniature campaign screen with a ghost cursor that shows exactly what to click (select a province, recruit, build, select an army, right-click to march, end the turn, open Diplomacy...). The non-click lessons (supply, sea routes, battles, sieges) have their own small animations.
- **Back / Next** navigation, and a **Lessons** button in the top bar (during a normal game) to replay any lesson in the same panel with its demo and button highlights, without leaving your campaign.

### Learning mode
- A checkbox on the nation-select screen (and in Settings). It does **not** change difficulty; it only teaches as you play:
  - an **Advisor** panel (bottom-left) with the three most useful things to do right now ("You are at war and nothing is being recruited", "Your army in X can attack Y", "Build a Market in Z"), each with a *Show* button;
  - **first-time hint cards** (supply, sieges, unrest, low gold, blockades, first battle, generals) shown once each;
  - a **battle odds** line in the battle prompt ("Roughly even", "Hopeless: avoid this fight") and a plain-language reason after auto-resolved battles;
  - extra warnings before ending a turn (unspent gold, nothing recruiting) and a simpler top bar for the first four turns (Armies list, War overview and playback appear on turn 5).

### Easy mode (simple rules)
- Tick **Easy mode (simple rules)** on the nation-select screen (it remembers your choice; also in Settings, for new games). Your choices shrink to the basics: you can recruit only **line infantry, cavalry and artillery**, and build only a **Market** (money) and **Barracks** (recruiting). Naval warfare and the long map are switched off, and it turns on the learning aids (advisor, hint cards, battle odds). The AI plays normally, so this is a *simple* game, not a weak enemy. It applies to the player only and is stored with the save.

### Mode prompt and shorter sea hops
- **Begin the Campaign** now asks first: **Easy mode** (the default button: simple rules, advisor, hints, odds; short map, no naval) or **Advanced mode** (everything, then the usual length and naval questions). The nation-select checkbox is gone.
- Armies could previously cross the whole Atlantic in one move between any two ports of a sea. Sea links are now capped at 220 map px (the Channel, Baltic straits, Adriatic, Sicily and similar short crossings); a long voyage hops from port to port, one crossing per turn. 292 sea links became about 134.

### Naming and army order
- Heavy cavalry is "Heavy Cavalry" / "Heavy Cav" everywhere (no more Cuirass in some places), and light cavalry is "Light Cavalry" / "Light Cav".
- Regiments inside an army (and in the battle roster) are listed line infantry first, then light infantry / rifles, then artillery, then cavalry.

### Portugal and the Peninsula
- Portugal now gets a head start like Bavaria: +50% gold, +2,200 manpower, a Market and Barracks in each province, an Arsenal and a fort in Lisbon.
- The *Wellesley Takes Command* event (April 1808) now actually sends a British expeditionary army (about 11 regiments) to Lisbon, if Portugal still holds it and is not Britain's enemy.

### The Spanish Rebels
- In May 1808 a hidden faction, the **Spanish Rebels**, rises (amber dashed edge and flame on their map markers). Spain does **not** change sides: it stays France's ally. The rebels are at war with Spain only, cannot be traded with or allied with, and have no provinces. Bands of Guerrillas appear in Spanish provinces (up to 7 at once, each lasting about 10 turns until 1813), raid Spanish provinces that have no army (income x0.4, no recruiting, unrest up) and fight Spanish troops; Spanish AI armies chase bands they can crush.
- Portugal's own uprising against French occupiers is unchanged.

### Rebels from unrest, and a third economy tier
- The **Rebels** are now a general mechanic, not just a Spanish event: any province with **60%+ unrest** and no army in it can spawn a guerrilla band (chance grows with unrest, up to 10 bands at once, each lasting about 10 turns). Bands are at war with that province's owner only, cannot be traded or allied with, raid undefended provinces of that owner (income x0.4, no recruiting, unrest +5 a turn) and fight its troops; AI armies chase bands they can crush. Any army in the province keeps the rebels from rising. At 100% unrest the province still revolts and is lost. The 1808 Spanish uprising raises Spanish unrest and spawns extra bands.
- **Third level** of both economy chains: **Imperial Bank** (needs Exchange, +50% income) and **Recruitment Bureau** (needs Conscription Office, +50% manpower). Not available in Easy mode.

### Guard limit
- No nation may hold more than **10 regiments of Guard Infantry** (armies plus those in training). Applies to the player and the AI; the unit tooltip shows your current count against the limit.

### Garrisons and rallies
- Local militia now only appear in **fortified** provinces: 2 militia regiments per fort level, plus 1 line regiment at level 2 and 2 at level 3. An unfortified province raises nothing.
- A general can **rally** his army at most **3 times per battle** (the button shows 3/3, 2/3...). Applies to the AI as well.

### Painted artwork
- Eight oil-painting style images, generated with an image model (Z-Image Turbo on Hugging Face) and stored in `assets/img/` as small WebP files (about 350 KB in total), now dress the game: a **title-screen painting** (the marching silhouettes still walk across the foreground), **event pictures** (war councils / coronations, treaties, winter, revolt, harvest, coalitions, disasters) in the event pop-ups, and a **victory / defeat banner** on battle reports and the campaign end screen. `tools/build_single.py` inlines them as data URIs, so the single-file build stays self-contained. Event kinds without a painting (naval) keep the old drawn illustration.

### Top-down soldier figures
- When you zoom into a battle each soldier is drawn as a small top-down figure instead of a coloured square: a shako-wearing infantryman with crossed belts and musket, or a horse and rider (with different helmets for hussars, cuirassiers and lancers; bearskins and plumes for the Guard, grenadiers and light infantry). Poses follow what the regiment is doing: **standing, marching, aiming** (front rank, just before a volley), **firing** (muzzle flash and smoke), **bayonet thrust** in melee, and **charging** cavalry. They are painted once into cached sprites per uniform colour and pose, so it stays fast; switch it off in Settings. (They are code-drawn rather than AI-generated: the free image quota was used up, and a consistent multi-pose sprite sheet would also need background removal.)
