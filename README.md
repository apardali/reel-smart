# Reel Smart

Movie & TV party trivia. The TV shows the clips and questions; everyone answers on their phone with a 4-letter room code. No accounts needed for players.

- **Game:** `index.html`. TV + phones mode, or One screen pass-and-play.
- **Admin:** `admin.html`. Email + password + Authenticator app. Add clips, write questions, import a folder of clips.
- **Hosting:** GitHub Pages (static files).
- **Backend:** Firebase for live sync (Firestore), clip storage (Cloud Storage) and the admin login (Authentication).

## One-time setup (about 20 minutes)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and click **Create a project** (e.g. `reel-smart`). Google Analytics is optional.
2. Upgrade to the **Blaze (pay-as-you-go)** plan (bottom-left of the console). Cloud Storage requires it, but the no-cost allowance still applies, so a home game night normally costs nothing. Set a **budget alert** (e.g. $5) in Google Cloud Billing so you're warned if usage ever grows.

### 2. Add the web app and paste its config
1. Project settings (gear icon) → **General** → **Your apps** → **Web** (`</>`). Name it `reel-smart`; you don't need Firebase Hosting.
2. Copy the `firebaseConfig` values into **`js/firebase-config.js`** and commit. These values aren't secret; the rules files are what protect your data.

### 3. Turn on sign-in methods
Build → **Authentication** → Get started → **Sign-in method**:
- Enable **Email/Password**.
- Enable **Anonymous** (players and the TV sign in invisibly, so no accounts are needed).

Then **Settings → Authorized domains** → **Add domain**: `YOUR-GITHUB-USERNAME.github.io` (plus any custom domain you add later).

### 4. Turn on the Authenticator (TOTP) second factor
1. Authentication → **Settings** → upgrade to **Firebase Authentication with Identity Platform** (the console prompts you).
2. Open **Google Cloud Shell** (the `>_` icon at the top of <https://console.cloud.google.com>, with your project selected) and run, replacing `PROJECT_ID`:

```bash
curl -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/PROJECT_ID/config?updateMask=mfa" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: PROJECT_ID" \
  -d '{"mfa":{"providerConfigs":[{"state":"ENABLED","totpProviderConfig":{"adjacentIntervals":5}}]}}'
```

### 5. Create your admin account
Authentication → **Users** → **Add user** → `alex@polyq.ai` with a strong password.
(The admin email is set in `js/firebase-config.js`, `firestore.rules` and `storage.rules`. Change all three if it ever changes.)

### 6. Create the database and storage, and paste the rules
- Build → **Firestore Database** → Create database → **production mode**, location near you (e.g. `northamerica-northeast2` Toronto). Then the **Rules** tab → paste the contents of **`firestore.rules`** → **Publish**.
- Build → **Storage** → Get started → same region. Then the **Rules** tab → paste **`storage.rules`** → **Publish**.

(Or, with the Firebase CLI: `firebase deploy --only firestore:rules,storage --project PROJECT_ID`.)

### 7. GitHub Pages
Repo **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)`. The site appears at `https://YOUR-GITHUB-USERNAME.github.io/reel-smart/` within a minute or two.

### 8. First admin sign-in
1. Open `…/reel-smart/admin.html` and sign in with your email and password.
2. **Verify your email**: tap Send, click the link in your inbox, and sign in again.
3. **Set up your Authenticator**: scan the QR code, type the 6-digit code, then sign in again with password + code.
4. **Import clips** → select your whole *Movie Clips* folder. Files named after a movie (e.g. `Fargo.mp4`) attach to their "Name that scene" questions automatically.

## Playing
- **TV:** open the site (TV browser, or a laptop cast/HDMI to the TV) → **TV + phones** → pick a category → **Open the lobby**.
- **Phones:** open the same site → **Join a game** → name + room code.
- Everyone answers every question; faster correct answers score more. The TV moves on automatically after each reveal.

## How the security works
- **Players and the TV** sign in anonymously. They can create and run a game room and write only their own answers.
- **Clips and questions** can be read by anyone but changed only by an account that is `alex@polyq.ai`, has a verified email **and** signed in with the Authenticator code. Firebase's servers enforce this in `firestore.rules` and `storage.rules`, so it holds even if someone copies the website code.

## Notes
- Clips up to 100 MB each (mp4/H.264 plays everywhere).
- Nothing about a game is saved: scores live only in the TV's memory, and the live game room is deleted when the TV exits the game or closes the page. If a TV loses power mid-game its room can be left behind; optionally add a Firestore **TTL policy** on the `rooms` collection group using the `expiresAt` field so those are wiped automatically after 6 hours.
- **Licensing:** a public site streaming studio clips needs licenses from the rights holders before you launch commercially.

## Local testing
Serve the folder with any static server (e.g. `npx serve .`) and open `http://localhost:3000`. With the Firebase emulators running (`firebase emulators:start`), add `?emu=1` to the URL.
