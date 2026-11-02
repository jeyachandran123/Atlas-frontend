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
  OAuthProvider,
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

/** What went wrong in the sign-in popup, said plainly. */
function popupError(error: unknown, provider: string): Error {
  if (error && typeof error === "object" && "code" in error) {
    const e = error as { code: string; message: string };
    const detail = e.message ?? "";
    // Firebase passes the provider's own reply through verbatim — a paragraph of
    // URL-encoded text. Keep it for whoever is debugging, show a sentence.
    console.debug(`${provider} sign-in failed:`, e.code, detail);

    if (detail.includes("AADSTS50194") || detail.includes("not configured as a multi-tenant")) {
      return new Error(
        `${provider} sign-in is registered for one organisation only. Set ` +
        "NEXT_PUBLIC_MICROSOFT_TENANT to your Azure directory (tenant) id, or make the " +
        "app multi-tenant in Azure.",
      );
    }
    if (detail.includes("AADSTS")) {
      // Any other complaint from Microsoft Entra ID, minus the wall of text.
      const code = /AADSTS\d+/.exec(detail)?.[0];
      return new Error(
        `${provider} refused the sign-in${code ? ` (${code})` : ""}. Check the app registration in Azure.`,
      );
    }

    switch (e.code) {
      case "auth/invalid-credential":
        return new Error(`${provider} refused the sign-in. Check the provider's setup in Firebase and Azure.`);
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return new Error("Sign-in cancelled.");
      case "auth/popup-blocked":
        return new Error("Your browser blocked the sign-in window. Allow pop-ups for this site and try again.");
      case "auth/account-exists-with-different-credential":
        return new Error(`This email already signs in another way. Use that method instead of ${provider}.`);
      case "auth/operation-not-allowed":
        return new Error(`${provider} sign-in isn't switched on for this app yet.`);
      case "auth/unauthorized-domain":
        return new Error("This address isn't allowed to sign in. Add it to Firebase's authorised domains.");
      default:
        return new Error(e.message || `${provider} sign-in failed.`);
    }
  }
  return error instanceof Error ? error : new Error(`${provider} sign-in failed.`);
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
    throw popupError(error, "Google");
  }
}

/**
 * Sign in with a Microsoft work, school or personal account.
 *
 * NEXT_PUBLIC_MICROSOFT_TENANT limits it to one organisation (its directory id);
 * unset, any Microsoft account may sign in. The backend already knows this
 * provider — it reads "microsoft.com" from the token as "microsoft".
 */
export async function signInWithMicrosoft(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({
    prompt: "select_account",
    tenant: process.env.NEXT_PUBLIC_MICROSOFT_TENANT || "common",
  });
  // The account's address is what the backend identifies the user by.
  provider.addScope("email");
  provider.addScope("profile");
  try {
    return await signInWithPopup(auth, provider);
  } catch (error: unknown) {
    throw popupError(error, "Microsoft");
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
