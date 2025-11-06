// Firebase client initialization module
// NOTE: This file intentionally contains the public Firebase web config as requested.
// It initializes Firebase (Auth + Firestore + Analytics) and exposes window.firebaseRegister

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, query, where, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// Your web app's Firebase configuration (public)
const firebaseConfig = {
  apiKey: "AIzaSyBNWCNxC0d-YAem0Za51epjfl_WXcyDZSE",
  authDomain: "carousell-c3b3f.firebaseapp.com",
  projectId: "carousell-c3b3f",
  storageBucket: "carousell-c3b3f.firebasestorage.app",
  messagingSenderId: "33772869337",
  appId: "1:33772869337:web:f1f86a5cc8f71d0c1050c8",
  measurementId: "G-YR7F7YER8V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // Analytics may fail in non-browser or preview environments; ignore silently
  console.debug('Firebase analytics not available:', e && e.message ? e.message : e);
}

const auth = getAuth(app);
const db = getFirestore(app);

// Expose a simple register helper used by the page
window.firebaseRegister = async function(firstName, lastName, email, password, username, accountType) {
  try {
    // create user in Firebase Auth
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;

    // create user profile doc in Firestore
    await setDoc(doc(db, 'users', uid), {
      first_name: firstName || '',
      last_name: lastName || '',
      email: email || '',
      username: username || '',
      account_type: accountType || 'Buyer',
      date_created: serverTimestamp()
    });

    console.info('Firebase registration succeeded', { uid });
    return { success: true, uid };
  } catch (err) {
    // Return standardized error info for the UI
    const code = err?.code || null;
    const message = err?.message || String(err);
    console.error('Firebase register error', { code, message, err });
    return { success: false, code, message };
  }
};

// Also expose the raw firebaseConfig for debugging if needed
window.__firebaseConfig = firebaseConfig;

// Sign-in helper that ensures a corresponding Firestore user doc exists.
window.firebaseSignIn = async function(email, password) {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;

    // Check for profile doc at users/{uid}
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      // No profile document - sign the user out and return an error
      try { await signOut(auth); } catch (e) { /* ignore */ }
      return { success: false, code: 'user-doc-not-found', message: 'User authenticated but profile not found in Firestore.' };
    }

    return { success: true, uid, profile: snap.data() };
  } catch (err) {
    const code = err?.code || null;
    const message = err?.message || String(err);
    console.error('Firebase signIn error', { code, message, err });
    return { success: false, code, message };
  }
};

// Optional: helper to check if a user exists by email (search users collection)
window.firebaseUserExistsByEmail = async function(email) {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    return snap.size > 0;
  } catch (err) {
    console.error('Error checking user exists by email', err);
    return false;
  }
};

// After client sign-in, ask the server to create a server-side session for UI personalization.
// This call requires same-origin credentials so the server's session cookie is set.
window.establishServerSession = async function(email, uid) {
  try {
    // Attempt to send username and account_type from Firestore profile if available
    let profile = null;
    try {
      const userDocRef = doc(db, 'users', uid);
      const s = await getDoc(userDocRef);
      if (s.exists()) profile = s.data();
    } catch (e) {
      console.debug('Could not load user profile for server session:', e);
    }

    const payload = {
      Email: email,
      Uid: uid,
      Username: profile?.username || null,
      UserType: profile?.account_type || null,
      FullName: profile?.first_name || profile?.last_name ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() : null
    };

    const resp = await fetch('/Home/ClientLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    return await resp.json();
  } catch (e) {
    console.error('Failed to establish server session', e);
    return { success: false, message: e?.message || String(e) };
  }
};

export default app;
