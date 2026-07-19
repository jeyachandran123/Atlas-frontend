/**
 * Firebase Client SDK Configuration
 * 
 * Initializes Firebase for Google Sign-In authentication.
 * The Firebase ID token is sent to our backend for verification.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onIdTokenChanged,
  type Auth,
  type UserCredential,
} from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Singleton Firebase app
let app: FirebaseApp;
let auth: Auth;

/**
 * Initialize Firebase app (idempotent).
 * Called automatically when importing this module.
 */
export function initializeFirebase(): FirebaseApp {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else {
    app = getApps()[0]!;
    auth = getAuth(app);
  }
  return app;
}

/**
 * Get Firebase Auth instance.
 * @returns Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
}

/**
 * Sign in with Google using a popup window.
 * Returns the UserCredential directly — no redirect needed.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error) {
      const e = error as { code: string; message: string };
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        throw new Error("Sign-in cancelled.");
      }
      throw new Error(e.message || "Google sign-in failed.");
    }
    throw error;
  }
}

/**
 * Get a fresh Firebase ID token for the current user.
 * Always force-refreshes to avoid sending an expired token to the backend.
 */
export async function getFirebaseIdToken(): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("No user signed in");
  return user.getIdToken(true);
}

/**
 * Subscribe to Firebase ID token changes (auto-refresh every ~55 min).
 * Calls the callback with the new token whenever Firebase rotates it.
 * Returns an unsubscribe function.
 */
export function onFirebaseTokenRefresh(callback: (token: string) => void): () => void {
  const auth = getFirebaseAuth();
  return onIdTokenChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      callback(token);
    }
  });
}

/**
 * Sign out from Firebase.
 * Note: This only signs out from Firebase, not from our backend.
 * Use the logout hook to sign out from both.
 */
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

// Initialize Firebase immediately
if (typeof window !== "undefined") {
  initializeFirebase();
}
