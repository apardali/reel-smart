# Reel Smart

Movie & TV party trivia. The TV shows the clips and questions; everyone answers on their phone with a 4-letter room code. No accounts, no database. Everything runs from this GitHub repo.

**Play:** <https://apardali.github.io/reel-smart/>
**Admin:** <https://apardali.github.io/reel-smart/admin.html>

## How it works
- **Hosting:** GitHub Pages serves the files in this repo. Nothing else to set up.
- **TV ↔ phones:** peer-to-peer (WebRTC via [PeerJS](https://peerjs.com)). PeerJS's free public service only introduces each phone to the TV; after that they talk directly.
- **Nothing is saved:** scores live only in the TV's memory and disappear when the game ends.
- **Clips and questions are files in this repo:**
  - `clips/`: the video files (each under 100 MB; mp4/H.264 plays everywhere).
  - `data/clips.json`: which built-in question each clip belongs to.
  - `data/custom.json`: questions you add, each with its own clip.
  - `js/questions.js`: the built-in question bank.
- **Admin security:** only people who can edit this repo can change the game. Turn on **two-factor authentication** in GitHub (Settings → Password and authentication) with your Authenticator app, and every change requires your password + code.

## Playing
1. **TV:** open the site (TV browser, or a laptop cast/HDMI to the TV) → **TV + phones** → category → **Open the lobby**.
2. **Phones:** open the same site → **Join a game** → name + room code.
3. Everyone answers every question; faster correct answers score more. The TV moves on automatically after each reveal.

**One screen** mode is pass-and-play on a single device, with no phones needed.

## Adding a clip
Open **admin.html**, choose the clip, enter the title and answers, and click **Get it ready for GitHub**. It then walks you through:
1. Uploading the video to `clips/` (with the file name it gives you).
2. Pasting the generated entry into `data/custom.json`.
3. Committing. The site updates in about a minute.

**Difficulty:** every built-in question has a level in `js/questions.js` (`lv:1` easy, `lv:2` medium, `lv:3` hard), and the setup screen's Easy / Medium / Hard buttons only deal questions of that level (Mixed deals all three). If a level runs short for the chosen category, the game tops up from the next level so a full game always plays. For your own questions in `data/custom.json`, add `"level": "easy"`, `"medium"` or `"hard"` to the entry (or to one clip question inside it); without it they count as medium.

To attach a clip to an existing built-in question, upload it to `clips/` and add a line to `data/clips.json`:
```json
"name-that-scene-jurassic-park": "clips/jurassic-park.mp4"
```

## Limits to know
- **Connections:** most home Wi-Fi and mobile networks work. Some strict networks (hotels, offices, some carriers) block direct connections; if a phone can't join there, try switching it between Wi-Fi and mobile data.
- **The free PeerJS service has no uptime guarantee.** For a commercial launch, run your own PeerJS server (and a TURN relay for strict networks) and point the game at it with `?peerhost=your.server&peerport=443`.
- **GitHub Pages:** site up to 1 GB and about 100 GB of downloads a month (soft limits). Each file must be under 100 MB.
- **Licensing:** clips in a public repo can be downloaded by anyone. Studio clips need licenses from the rights holders before a commercial launch.

## Local testing
Serve the folder with any static server (e.g. `npx serve .`). To test phones without the internet, run a local PeerJS server (`npx peerjs --port 9000`) and add `?peerhost=127.0.0.1&peerport=9000&peersecure=0` to the URL.
