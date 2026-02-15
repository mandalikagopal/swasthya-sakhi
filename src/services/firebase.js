import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBqt53TJftgH6TTgxcMPMH1g3H6ZbEbsSM",
  authDomain: "swasthya-sakhi-2e7bd.firebaseapp.com",
  projectId: "swasthya-sakhi-2e7bd",
  storageBucket: "swasthya-sakhi-2e7bd.firebasestorage.app",
  messagingSenderId: "934869387204",
  appId: "1:934869387204:web:73e7c831d852dca3f34691"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;