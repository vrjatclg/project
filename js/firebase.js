// Firebase initialization and exports.
// 1) Enable Authentication (Email/Password) and Firestore in Firebase Console.
// 2) Create an admin user: admin@gmail.com (password: admin123).
// 3) Config is injected via window.__FIREBASE_CONFIG__ in HTML.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

// Use injected config if present, otherwise you can hardcode here.
const firebaseConfig = window.__FIREBASE_CONFIG__ ?? {
  apiKey: "AIzaSyA_MrLKnb70PcAY8ZlzbVa3j9_V0kSdNco",
  authDomain: "time2eat-a3617.firebaseapp.com",
  projectId: "time2eat-a3617",
  storageBucket: "time2eat-a3617.appspot.com",
  messagingSenderId: "793900361194",
  appId: "1:793900361194:web:41ef3f737738baf37cfe93",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Admin email used for login and Firestore rules
export const ADMIN_EMAIL = 'admin@gmail.com';
