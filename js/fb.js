// Firebase setup shared by the game and Admin.
const V = "13.2.0";
const base = `https://www.gstatic.com/firebasejs/${V}`;
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

export const configured = !String(firebaseConfig.apiKey || "").startsWith("PASTE");
export { ADMIN_EMAIL };

let mods = null;
export async function loadFirebase() {
  if (mods) return mods;
  const [app, auth, fs, st] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-storage.js`)
  ]);
  const fbApp = app.initializeApp(firebaseConfig);
  const a = auth.getAuth(fbApp);
  const db = fs.getFirestore(fbApp);
  const storage = st.getStorage(fbApp);
  // Local testing with the Firebase emulators: add ?emu=1 to the URL.
  if (new URLSearchParams(location.search).has("emu")) {
    auth.connectAuthEmulator(a, "http://127.0.0.1:9099", { disableWarnings: true });
    fs.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    st.connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  mods = { app: fbApp, auth: a, db, storage, A: auth, F: fs, S: st };
  return mods;
}

export function setupBanner(el) {
  if (configured || !el) return;
  el.innerHTML = `<div class="setupnote"><strong>Almost there.</strong> Add your Firebase project details to <code>js/firebase-config.js</code> (see README). Until then only One screen mode works, without clips.</div>`;
}
