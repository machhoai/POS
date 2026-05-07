// =============================================================================
// Firebase Client SDK — Runs in the browser (Tauri webview)
// =============================================================================
// This file initializes the Firebase Client SDK using public environment
// variables. It is safe to include in the frontend bundle.
// NO secrets or Admin credentials should ever be imported here.
//
// Auth uses IndexedDB persistence (browserLocalPersistence) because the POS
// runs as a static Tauri app — there are no server-side cookies/sessions.
// =============================================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
    connectFunctionsEmulator,
    getFunctions,
    type Functions,
} from "firebase/functions";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    type Auth,
} from "firebase/auth";

/**
 * Firebase client configuration.
 * All values come from NEXT_PUBLIC_ env vars (safe for client-side).
 */
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Initialize Firebase App (singleton pattern).
 * Reuses existing instance if already initialized (important for HMR in dev).
 */
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Firestore database instance.
 * Used for all client-side reads/writes and real-time subscriptions.
 */
const db: Firestore = getFirestore(app);
const functions: Functions = getFunctions(app, "asia-southeast1");

/**
 * Firebase Auth instance with IndexedDB persistence.
 * Uses browserLocalPersistence (IndexedDB under the hood) so the user
 * stays logged in across Tauri restarts without needing server cookies.
 */
const auth: Auth = getAuth(app);

// Set persistence to IndexedDB (local) — this is a no-op if already set,
// but ensures the correct persistence layer for the Tauri environment.
if (typeof window !== "undefined") {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.error("[Firebase] Lỗi khi cấu hình persistence:", err);
    });
}

const isLocalDevelopmentHost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

if (isLocalDevelopmentHost) {
    connectFunctionsEmulator(functions, "127.0.0.1", 4400);
}

export { app, db, auth, functions };
