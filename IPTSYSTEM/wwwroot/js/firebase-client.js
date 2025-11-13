// Firebase client initialization module
// NOTE: This file intentionally contains the public Firebase web config as requested.
// It initializes Firebase (Auth + Firestore + Analytics) and exposes window.firebaseRegister

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, query, where, collection, getDocs, addDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

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
      phone_number: '',
      user_id: uid,
      date_created: serverTimestamp()
    });

    // Read back to verify the document was written and return the profile
    try {
      const createdSnap = await getDoc(doc(db, 'users', uid));
      if (!createdSnap.exists()) {
        console.warn('User doc not found immediately after setDoc', { uid });
        return { success: false, code: 'user-doc-missing', message: 'User created in Auth but profile document not found after write.' };
      }

      console.info('Firebase registration succeeded', { uid });
      return { success: true, uid, profile: createdSnap.data() };
    } catch (re) {
      console.error('Error verifying created user document', re);
      return { success: false, code: 'user-doc-verify-failed', message: re?.message || String(re) };
    }
  } catch (err) {
    // Return standardized error info for the UI
    const code = err?.code || null;
    const message = err?.message || String(err);
    console.error('Firebase register error', { code, message, err });
    return { success: false, code, message };
  }
};

// Create a listing document in Firestore. If `listing.product_id` is provided (server id), store it
// so server<->firestore records can be correlated.
// (listing helpers implemented below using addDoc/updateDoc/deleteDoc)

// The required Firestore helpers are already imported above from the firebase-firestore module.
// (Avoid re-importing to prevent duplicate identifier errors.)

// Proper create using addDoc
window.firebaseCreateListing = async function(listing) {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, message: 'User not signed in' };

    const payload = {
      title: listing.title || '',
      description: listing.description || '',
      price: listing.price || 0,
      category: listing.category || '',
      condition: listing.condition || '',
      imageUrl: listing.imageUrl || '',
      user_id: user.uid,
      product_id: listing.id ?? null,
      date_created: serverTimestamp()
    };

    const col = collection(db, 'listings');
    const docRefAdded = await addDoc(col, payload);

    // If product_id wasn't provided, set product_id to the generated doc id
    if (!payload.product_id) {
      await updateDoc(doc(db, 'listings', docRefAdded.id), { product_id: docRefAdded.id });
    }

    return { success: true, id: docRefAdded.id };
  } catch (err) {
    console.error('firebaseCreateListing error', err);
    return { success: false, message: err?.message || String(err) };
  }
};

// Update listing by matching product_id (server id) or by doc id
window.firebaseUpdateListing = async function(listing) {
  try {
  const col = collection(db, 'listings');
  // Try to find doc by product_id
  const q = query(col, where('product_id', '==', listing.id));
  const snaps = await getDocs(q);
    if (snaps.size === 0) {
      // maybe listing.id is the firestore doc id
  const docReference = doc(db, 'listings', String(listing.id));
      await updateDoc(docReference, {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        imageUrl: listing.imageUrl || ''
      });
      return { success: true };
    }

    // Update all matching docs
    for (const d of snaps.docs) {
      await updateDoc(doc(db, 'listings', d.id), {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        imageUrl: listing.imageUrl || ''
      });
    }

    return { success: true };
  } catch (err) {
    console.error('firebaseUpdateListing error', err);
    return { success: false, message: err?.message || String(err) };
  }
};

// Delete listing by product_id or doc id
window.firebaseDeleteListing = async function(productIdOrDocId) {
  try {
  const col = collection(db, 'listings');
  const q = query(col, where('product_id', '==', productIdOrDocId));
  const snaps = await getDocs(q);
    if (snaps.size === 0) {
      // try deleting by doc id
      try {
  await deleteDoc(doc(db, 'listings', String(productIdOrDocId)));
        return { success: true };
      } catch (e) {
        return { success: false, message: 'No matching listing found' };
      }
    }

    for (const d of snaps.docs) {
  await deleteDoc(doc(db, 'listings', d.id));
    }
    return { success: true };
  } catch (err) {
    console.error('firebaseDeleteListing error', err);
    return { success: false, message: err?.message || String(err) };
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
      // No profile document - attempt to auto-create a minimal profile document so
      // users that were created in Auth but missing a profile can still use the app.
      try {
        console.warn('Profile document missing for uid, attempting to create minimal profile', { uid });
        await setDoc(userDocRef, {
          first_name: userCred.user.displayName ? userCred.user.displayName.split(' ')[0] : '',
          last_name: userCred.user.displayName ? userCred.user.displayName.split(' ').slice(1).join(' ') : '',
          email: userCred.user.email || '',
          username: (userCred.user.email ? userCred.user.email.split('@')[0] : uid),
          account_type: 'Buyer',
          phone_number: '',
          user_id: uid,
          date_created: serverTimestamp()
        });

        // Re-read the profile
        const newSnap = await getDoc(userDocRef);
        if (newSnap.exists()) {
          return { success: true, uid, profile: newSnap.data(), migrated: true };
        } else {
          // Couldn't verify the document after write
          try { await signOut(auth); } catch (e) { /* ignore */ }
          return { success: false, code: 'user-doc-missing-after-create', message: 'Authenticated but profile could not be created in Firestore.' };
        }
      } catch (createErr) {
        console.error('Failed to auto-create user profile document', createErr);
        try { await signOut(auth); } catch (e) { /* ignore */ }
        return { success: false, code: createErr?.code || 'user-doc-create-failed', message: createErr?.message || String(createErr) };
      }
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
