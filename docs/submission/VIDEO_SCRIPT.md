# 30-second demo video — shot list and recording plan

Hard limit: **30 seconds** (a longer demo is not eligible for Global Judging). We cut to **29 s** and export at
28–29 s. English captions burned in. Public link that opens without a login. <!-- SRC_SPACEAPPS_GUIDE -->

The first seven seconds carry the one thing other entries do not have: the concern **caught only by the personal
baseline**. The storm is always a **synthetic replay**, never "live" or "real". The Earth-link delay is always
**modeled**.

## Setup once (before any take)

1. Open the live demo `https://feyruzsultanli.github.io/argus-crew-health/` (or `npm run build && npm run preview`
   → `http://localhost:4173/`) in Chrome, window 1920×1080, browser zoom 100 % (try 110 % if text is small; check
   that nothing wraps badly). Dark theme (default).
2. Sign in: role **CMO** → Demo PIN **2026** → **Sign in as CMO**. You land on the Mission Bridge.
3. Clean state: open `/settings?demo=1` → **Reset demo** → confirm **Reset demo**. Check the mission chip in the header
   reads **Mars transit** and **MD 143/210**. If the profile is different: Demo controls → **Change profile** →
   Mars transit. If the day is not 143: press **Today** in the mission scrubber (Bridge, Body or Trends).
4. In Demo controls → Scenarios → **Silent infection (caught only by personal baseline)** → **Jump**. This selects
   K. Osei and day 143 (her row is now the selected crew member for the Lab and Earth link).
5. Allow the camera once for the site (Lab → Camera pulse → Continue → Start → allow), then cancel. This keeps the
   permission prompt out of the recorded take.

## Shot list (sum = 29 s)

| # | Time | Duration | Screen and path | Exact actions | Burned-in caption (≤ 12 words) | Optional voice-over | Must be visible (honesty) |
|---|------|----------|-----------------|---------------|-------------------------------|---------------------|---------------------------|
| 1a | 0:00–0:03 | 3 s | Body, `/body/c3` (K. Osei), 3D view | Before recording: Bridge → Crew at a glance → click the **K. Osei** row (opens `/body/c3`); click the heart hotspot so the **Resting heart rate** card is open; set **Layer lens** to **Earth**. Recording: hold 1 s on Earth (heart neutral), then click **Space** (still neutral). | Mars transit, day 143. Earth is 11 minutes away (modeled). | "Mars transit, day 143. Earth is eleven minutes away." | Header **SIMULATED DATA** badge; mission chip MD 143; the lens control showing which lens is on. |
| 1b | 0:03–0:07 | 4 s | Same screen | Click **Personal**: the heart lights up **Act**. Move the cursor to the card's **"Caught only by personal baseline"** marker and the layer row (Personal Act · Space Nominal · Earth Nominal). | Normal for Earth and space rules. Caught only by her baseline. | "Her pulse is normal on any lab sheet, but eleven beats above her own normal." | The marker text; the three layer pills; SIMULATED DATA badge. |
| 2 | 0:07–0:11 | 4 s | Lab → Camera pulse, `/lab/camera` | Lab → **Camera pulse** → **Continue** → **Start 30-second measurement**. Record the full 30 s on the presenter's real face, then speed it up in the editor to about 3 s, and hold 1 s on the result (bpm + quality pill). **Do not press Save** (the reading would enter K. Osei's simulated record). | Re-checked with the laptop camera: real pulse, quality scored, sped up. | "Checked on the spot with the laptop camera." | The quality pill (word + icon), the privacy line "Video stays on this device. Only the number is saved." No accuracy or validation claim anywhere on screen or in the caption. |
| 3 | 0:11–0:14 | 3 s | Lab → Reaction Self-Test, `/lab/pvt?pvtTest=1&pvtProfile=slow` | Open the URL → **Start 3-minute test** (the scripted run finishes in under a second) → hold on the result with its lapses. Do not press Save. | Reaction Self-Test, 3 minutes (scripted test run shown). | "And a three-minute reaction test." | The badge **"TEST MODE — scripted responses (slow)"** must stay in frame. |
| 4 | 0:14–0:20 | 6 s | Environment, `/environment?replaySpeed=3600` | Open the URL (speed 3600× is preselected; otherwise click **3600×**). Click **Replay SPE**. At 3600× one real second = one event hour: S1 at about 2 s, **S2 and "Shelter advised." from about 3 s to 7 s**, back to S1 after that. Use the clip from about 1 s to 7 s after the click. Afterwards: **Stop replay**. | Solar storm replay (synthetic): shelter advised, every crew dose tracked. | "A solar storm replay: shelter advised, every crew dose tracked." | **REPLAY** badge and the text "synthetic S2-class profile (demo), not a recorded event" on the S tile or flux chart; the shelter banner; the dose ledger with "Modeled — illustrative"; SIMULATED DATA badge. |
| 5 | 0:20–0:25 | 5 s | Earth link, `/earth?crew=c3&flags=1` | The composer opens prefilled for K. Osei, flags only. Check **Demo time compression** shows **60×**. Click **Send to flight surgeon**. Hold on the sent-packet card: **"arrives in 11 min (demo: 11 s)"**, the countdown and the Queued → In transit steps. | Crew acts now. The flight surgeon gets the packet 11 minutes later. | "The crew acts now. Earth gets the packet eleven minutes later." | "modeled delay (demo)" next to the delay, the "Demo parameter" tag on the arrival line, SIMULATED DATA badge. |
| 6 | 0:25–0:29 | 4 s | Body, `/body/c3`, lens **Combined** | Slow drag-rotate of the 3D body; overlay the end card in the editor. | ARGUS. Personal. Space. Earth. Decisions on board. | "ARGUS. Crew health autonomy." | End card (editor text, small): "ARGUS — Crew Health Autonomy · Dark Star · NASA Space Apps Challenge 2026 · Create Health Monitoring Software for Astronauts on Space Missions · Simulated crew · Prototype, not a medical device". No logos. |

Timing check: 3 + 4 + 4 + 3 + 6 + 5 + 4 = **29 s**. If the host shows more than 29 s, cut shot 6 to 3 s.

Numbers in the captions: 11 minutes on day 143 is the modeled Mars-transit delay (`SRC_DEMO_SIMULATION`,
seed/missions.json); 3 minutes is the PVT-B length (`SRC_PVT_B_BASNER2011`); "eleven beats above her own normal" is
69 vs 58 bpm on day 143 (simulated); the replay timing is the 600× replay table divided by six.

### Why these shots differ from the first draft

- Shot 2/3: the draft showed "reaction test lapses" next to the camera. A real Reaction Self-Test takes 3 minutes, so
  the video shows the scripted test mode, and its TEST MODE badge stays visible.
- Shot 4: the draft said "replays a solar storm on top of live NOAA data" with a LIVE badge. During a replay the data
  mode is REPLAY, not LIVE, so the shot shows only the replay and its synthetic label. Live NOAA data is shown in the
  slides and the live demo.
- Shot 5: the draft went "Action card → Send to flight surgeon → countdown 11:00". For K. Osei's heart-rate Act the
  action card opens the "Suspected infection" protocol, not the Earth link, and the countdown runs compressed (11 s,
  labeled demo). The shot therefore opens the Earth link composer prefilled for K. Osei and shows the exact arrival
  line.

## Recording checklist

- [ ] 1920×1080, 30 fps; screen recorder (macOS: Cmd+Shift+5 or QuickTime; Windows: Xbox Game Bar or OBS).
- [ ] Large cursor (macOS: System Settings → Accessibility → Display → Pointer size), cursor highlight on if available.
- [ ] Notifications off (Do Not Disturb); bookmarks bar hidden; no other tabs visible; no personal names in the URL bar.
- [ ] Captions burned in (white text on a dark bar, at least 36 px at 1080p), English, each ≤ 12 words.
- [ ] Subtitles: English. If voice-over is used, the burned-in captions match it.
- [ ] No music, or a CC0 track only (credit it in CREDITS.md if used).
- [ ] No NASA logo, meatball, worm, flag or mission patch anywhere (app, end card, thumbnail). Our own mark only.
- [ ] SIMULATED DATA badge visible in every shot with crew data (1, 4, 5, 6).
- [ ] Storm shot: REPLAY and "synthetic" visible; never the words "live" or "real" for the storm.
- [ ] Earth-link shot: "modeled delay (demo)" visible.
- [ ] Camera shot: no validation or accuracy claim; caption says "sped up".
- [ ] Export H.264 MP4, 28–29 s. Upload, then **check the duration the host shows** (YouTube sometimes rounds up).
- [ ] Upload to YouTube (Unlisted is fine) or Google Drive (Anyone with the link → Viewer). Open the link in a private
      window, signed out: it must play without a login.
- [ ] Paste the link into the form's Project Demonstration field (PROJECT_PAGE.md field 3), README.md (`<<VIDEO URL>>`)
      and slide 7 (`videoUrl` in `docs/submission/slides/deck.config.json`, then `npm run slides:build`).

## 10-minute dry run (fewest takes)

Order chosen so the slow parts are captured once and the state stays clean.

1. **0:00–1:00 Setup** (steps 1–5 above). Start the screen recorder once and leave it running; cut later.
2. **1:00–2:30 Body (shots 1a, 1b, 6).** Three passes of Earth → Space → Personal, each 7 s; then switch to Combined
   and record 10 s of slow rotation for shot 6. Pick the best pass in the editor.
3. **2:30–4:00 Storm (shot 4).** `/environment?replaySpeed=3600` → Replay SPE. The whole profile at 3600× lasts about
   36 s; S2 is on screen from about 3 s to 7 s after the click. If a take is bad, press **Replay again** (no reset
   needed). Then press **Stop replay** so the modeled dose is removed before the next shot.
4. **4:00–5:30 Earth link (shot 5).** `/earth?crew=c3&flags=1` → Send to flight surgeon. Each take adds one packet
   (harmless). The packet arrives after 11 s; record at least 6 s after the click.
5. **5:30–6:00 Reaction test (shot 3).** `/lab/pvt?pvtTest=1&pvtProfile=slow` → Start → result. Instant; two takes.
6. **6:00–8:00 Camera (shot 2), last.** Good, even light on the face, no window behind, sit still about 60 cm from the
   screen. Lab → Camera pulse → Continue → Start 30-second measurement. Use the first take with quality **Good** or
   **Fair**. Do not press Save; press **Discard and exit**.
7. **8:00–10:00 Check.** Scrub the raw recording for the honesty items above, note the time codes of the best takes,
   then **Settings → Reset demo** so the live demo is clean for judges.
