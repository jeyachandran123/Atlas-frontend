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
    app = getApps()[0];
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
 * Sign in with Google using Firebase popup.
 * @returns UserCredential containing the user and ID token
 * @throws Error if sign-in fails or is cancelled
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  
  // Optional: Add scopes for additional permissions
  // provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  // provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error: unknown) {
    // Handle specific Firebase errors
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string; message: string };
      
      switch (firebaseError.code) {
        case "auth/popup-closed-by-user":
          throw new Error("Sign-in cancelled. Please try again.");
        case "auth/popup-blocked":
          throw new Error("Pop-up blocked by browser. Please allow pop-ups and try again.");
        case "auth/cancelled-popup-request":
          throw new Error("Sign-in cancelled. Please try again.");
        case "auth/network-request-failed":
          throw new Error("Network error. Please check your connection and try again.");
        default:
          throw new Error(firebaseError.message || "Failed to sign in with Google");
      }
    }
    throw error;
  }
}

/**
 * Get Firebase ID token for the current user.
 * This token is sent to our backend for verification.
 * @returns Firebase ID token (JWT)
 * @throws Error if no user is signed in
 */
export async function getFirebaseIdToken(): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error("No user signed in");
  }
  
  // Force refresh to get a fresh token
  const token = await user.getIdToken(true);
  return token;
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
