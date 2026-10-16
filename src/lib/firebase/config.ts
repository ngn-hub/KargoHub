import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// KargoHub Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDWbKYS3Ujgy4n03e-Ph35WItmHpDmZu24",
  authDomain: "kargohub.firebaseapp.com",
  projectId: "kargohub",
  storageBucket: "kargohub.firebasestorage.app",
  messagingSenderId: "842482335808",
  appId: "1:842482335808:web:724415eed3e1a95a47dfa5"
};

// Initialize Firebase (singleton pattern safe for Next.js SSR)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
