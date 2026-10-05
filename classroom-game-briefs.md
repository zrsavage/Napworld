# Classroom Game Briefs (built on the NapWorld engine)

Five game concepts for Junior US History II and 9th grade World History Honors, designed to reuse NapWorld's engine where possible.

## Shared classroom requirements (apply to all five)

- Fits a 56-minute period: about 5 minutes of setup, 40 of play, 10 of debrief. Longer games save and resume across days.
- Runs on student Chromebooks as a single HTML file (same `tools/build_single.py` approach). No logins, no server.
- Every major decision asks for a one-line written reason before it locks in. Reasons are saved and shown in the end report so the teacher can grade thinking, not just outcomes.
- Primary sources appear inside events: a short excerpt (2 to 4 sentences), a citation, and a question tied to the decision.
- End-of-game report: what happened, how it compares to what actually happened, and 3 debrief questions. Exportable or printable.
- Real history is the baseline. Students can change outcomes, but the game always shows the historical result next to theirs.
- Mixed-level friendly: short reading chunks, clear icons, optional "advisor hint" button.

---

## 1. NapWorld: Classroom Edition (World History, Unit 3: Age of Revolutions)

**Concept:** A trimmed, guided version of NapWorld that students can play meaningfully in one or two class periods. The question running through the whole game: did Napoleon spread the ideals of the French Revolution, or betray them?

**Core loop:** Each turn is a month (or speed it up to a season). Students manage France or a coalition power, and scripted events become decision points with primary sources.

**Reuse from NapWorld:** Almost everything. Campaign map, factions, generals, scripted events (`campaign.js`), auto-resolve battles, save/load, turn report.

**What to add:**
- A "Revolution Meter" for France tracking Liberty, Equality, and Order. Choices like crowning himself emperor, the Napoleonic Code, the Concordat, and censorship move it in different directions.
- Event cards with sources: Napoleonic Code excerpt, Continental System decree, Spanish Uprising (Goya reference), the retreat from Moscow.
- Classroom mode toggle: tactical battles off by default (auto-resolve only), fewer factions (France, Britain, Austria, Prussia, Russia), faster turns.
- Teacher start options: start date (1805, 1808, 1812) so different class periods can jump into different stages.

**Debrief questions:** Was Napoleon a son of the Revolution or its end? Why did nationalism turn conquered peoples against France? Why did the Russian campaign fail?

**Build size:** Small to medium. Mostly config, a classroom mode, and new event content.

---

## 2. The Columbian Exchange (World History, Unit 2: First Global Age)

**Concept:** A trade and settlement game on a world map. Students make economic decisions, but disease, crops, and animals spread through the same routes they create. The big reveal: the most important consequences were never chosen by anyone.

**Core loop:** Teams play Spain, Portugal, England, and an Indigenous American civilization (Aztec, Inca, or Taíno). European teams build trade routes and colonies. The Indigenous team manages its population, food, and alliances.

**Reuse from NapWorld:** Province map generation (`world.js`, swap to an Atlantic world map), economy and province income, events, turn report.

**What to add:**
- Goods that move along routes: maize, potatoes, cassava, tomatoes, cacao going east; wheat, sugar, horses, cattle, pigs going west.
- Hidden disease layer: smallpox and measles spread along contact routes and are only revealed through population drops. A toggle in the end report shows the hidden spread map.
- Labor choices: when the Indigenous population collapses, plantation colonies face a labor shortage. The game shows how the Atlantic slave trade grew from these economic decisions, using sources rather than letting students "play" enslavement as a mechanic.
- Global ripple effects: potatoes and maize raise population in Europe and China in later turns.

**Debrief questions:** Which effects were intentional and which weren't? Who gained the most and who paid the most? How did crops from the Americas change the rest of the world?

**Build size:** Medium to large. New map, new goods system, hidden spread model.

---

## 3. Powder Keg 1914 (World History, Unit 5: Age of Global Conflicts)

**Concept:** A diplomacy game played day by day through the July Crisis (June 28 to August 4, 1914). Each team is a Great Power. The goal for most teams: protect your interests without causing a world war. The game shows how alliances, mobilization timetables, and honor made it nearly impossible.

**Core loop:** Each turn is one day (or a few days). Teams choose actions: send a note, issue an ultimatum, offer mediation, partially mobilize, fully mobilize, honor or abandon an ally. A clock keeps moving whether teams act or not.

**Reuse from NapWorld:** Diplomacy system (wars, alliances, relations, allies joining wars), AI factions for empty seats, event system, turn report.

**What to add:**
- Teams: Austria-Hungary, Serbia, Russia, Germany, France, Britain. AI plays any team without students.
- Mobilization timetables: once a power fully mobilizes, its war plan starts automatically (Germany's Schlieffen Plan goes through Belgium, which pulls in Britain).
- Historical event beats: the assassination, Germany's "blank check," Austria's ultimatum, Serbia's reply, Russian mobilization.
- A tension meter for each pair of powers and a public opinion meter at home that punishes looking weak.
- Ending: if war breaks out, show which chain of decisions caused it. If teams avoid war, show what each gave up to do it.

**Debrief questions:** Who was most responsible? Could any single decision have stopped it? How did the alliance system turn a local crisis into a world war?

**Build size:** Medium. Reuses diplomacy heavily; needs the day-by-day clock, mobilization logic, and multi-team hot seat or turn passing.

---

## 4. Wilson's Dilemma (US History II, Unit 3: The Great War)

**Concept:** Play President Wilson from 1914 to 1920 in three acts: neutrality, war, and peace. Students see how neutrality broke down, how the war changed the home front, and why the US helped win the war but rejected the peace.

**Act 1: Neutrality (1914 to April 1917)**
- Balance trade with Britain against German anger, and track public opinion (split among German Americans, Irish Americans, and pro-British groups).
- Events: Lusitania, Sussex Pledge, resumed unrestricted submarine warfare, Zimmermann Telegram.

**Act 2: The Home Front (1917 to 1918)**
- Manage war production, Liberty Bonds, the draft, and the Committee on Public Information.
- Choices about the Espionage and Sedition Acts trade security against civil liberties.
- Events on the Great Migration, women in war work, and the 1918 flu.

**Act 3: The Peace (1919 to 1920)**
- Negotiate at Versailles using the peace terms and war score system: push the Fourteen Points against Clemenceau, Lloyd George, and Orlando.
- Then sell the treaty to the Senate: compromise with Lodge's reservations or refuse. The League of Nations depends on the choice.

**Reuse from NapWorld:** War score and peace terms negotiation, events, turn report, diplomacy relations. No map combat needed.

**Debrief questions:** When was the US really no longer neutral? Were wartime limits on free speech justified? Why did the Senate reject the treaty, and what did that mean for the 1920s and 1930s?

**Build size:** Medium. Mostly event content and a new negotiation screen built on peace terms.

---

## 5. Boom & Bust (US History II, Unit 4: 1920s America)

**Concept:** Students each play a 1920s American (farmer, factory worker, stock investor, small bank owner) making personal financial decisions turn by turn. Everyone gets richer for a while. Then the hidden weaknesses in the economy add up, and the crash hits all of them at once.

**Core loop:** Each turn is a season from 1922 to 1932. Students decide whether to buy on installment credit, buy stocks on margin, expand the farm, save, or keep cash in the bank.

**Reuse from NapWorld:** Economy and turn report logic, event system, save/load. No map needed (or a simple US map showing regional effects).

**What to add:**
- Role-specific goals and risks. Farmers struggle with low crop prices the whole decade. Workers get new appliances on credit but flat wages. Investors buy on margin at 10 percent down. Bankers lend to everyone.
- A shared class economy: when many students borrow and buy stocks, the market rises for everyone. Their choices together create the bubble.
- Warning signs as events: farm foreclosures, overproduction, uneven wealth, the Florida land bust. Students who pay attention can protect themselves.
- The crash: Black Tuesday (October 29, 1929), margin calls, bank runs, and no deposit insurance. Then 1930 to 1932 shows unemployment spreading.
- End report shows each role's net worth over time next to the real numbers.

**Debrief questions:** What were the underlying weaknesses of the 1920s economy? Who was hurt first and who was hurt worst? Which New Deal reforms (FDIC, SEC) were designed to stop each problem in the game? (This sets up Unit 5.)

**Build size:** Small to medium. Simple economy model, multiplayer is optional (can run solo with AI "classmates" if needed).
