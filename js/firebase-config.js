// Paste your Firebase web app config here.
// Firebase console → Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
// These values are not secret: they identify your project. Security comes from firestore.rules and storage.rules.
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// The only account allowed into Admin. It must also match firestore.rules and storage.rules.
export const ADMIN_EMAIL = "alex@polyq.ai";
