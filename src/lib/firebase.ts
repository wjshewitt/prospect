"use client";

// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED,
  enableIndexedDbPersistence,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase config is available (prevents build-time errors)
const isFirebaseConfigured = Object.values(firebaseConfig).every(value => value && value !== 'undefined');

// Initialize Firebase only when config is available
let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

if (isFirebaseConfigured) {
  // Initialize Firebase
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();

  // Enable persistence
  if (typeof window !== "undefined") {
    try {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == "failed-precondition") {
          // Multiple tabs open, persistence can only be enabled in one tab at a time.
          console.warn("Firestore persistence failed: multiple tabs open.");
        } else if (err.code == "unimplemented") {
          // The current browser does not support all of the
          // features required to enable persistence
          console.warn("Firestore persistence not available in this browser.");
        }
      });
    } catch (error) {
      console.error("Error enabling Firestore persistence:", error);
    }
  }
}

export { app, auth, db, googleProvider, isFirebaseConfigured };
