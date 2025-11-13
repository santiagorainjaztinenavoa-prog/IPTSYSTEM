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

// Listen for authentication state changes
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('Firebase user authenticated:', user.uid, user.email);
  } else {
    console.log('No Firebase user authenticated');
    // Try to auto-sign in using server session
    tryAutoSignInFromSession();
  }
});

// Try to auto-sign in using server session credentials
async function tryAutoSignInFromSession() {
  try {
    // Get user email from the page (if available)
    const userEmail = document.querySelector('[data-user-email]')?.getAttribute('data-user-email');
    const sessionEmail = sessionStorage.getItem('SessionEmail');
    
    if (!userEmail && !sessionEmail) {
      console.log('No user email in session, auto-sign in skipped');
      return;
    }
    
    const email = userEmail || sessionEmail;
    console.log('Attempting auto-sign in with:', email);
    
    // Note: This requires the user to be already authenticated server-side
    // For now, we'll just log that we tried
    console.log('Auto-sign in prepared for:', email);
  } catch (err) {
    console.debug('Auto-sign in not available:', err.message);
  }
}

window.tryAutoSignInFromSession = tryAutoSignInFromSession;

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

// Proper create using addDoc - MODIFIED TO WORK WITH UNAUTHENTICATED USERS
window.firebaseCreateListing = async function(listing) {
  try {
    console.log('🔥 firebaseCreateListing called with:', listing);
    
    // Try to get Firebase user, but don't fail if not authenticated
    let userId = null;
    const user = auth.currentUser;
    
    if (user) {
      userId = user.uid;
      console.log('✅ Using Firebase authenticated user:', userId);
    } else {
      // Generate a pseudo-user ID from session or create anonymous
      userId = sessionStorage.getItem('UserId') || 'anonymous-' + Date.now();
      console.log('⚠️  Using session/anonymous user ID:', userId);
    }

    const docId = listing.id || null;
    const payload = {
      title: listing.title || '',
      description: listing.description || '',
      price: typeof listing.price === 'number' ? listing.price : parseFloat(listing.price) || 0,
      category: listing.category || '',
      condition: listing.condition || '',
      imageUrl: listing.imageUrl || '',
      user_id: userId,
      seller_name: sessionStorage.getItem('FullName') || 'Unknown Seller',
      seller_username: sessionStorage.getItem('Username') || 'unknown',
      product_id: docId,
      date_created: serverTimestamp()
    };
    
    console.log('📝 Payload to save:', JSON.stringify(payload, null, 2));

    const col = collection(db, 'tbl_listing');
    console.log('📍 Saving to collection: tbl_listing');
    
    const docRefAdded = await addDoc(col, payload);
    console.log('✅ Document added successfully with ID:', docRefAdded.id);

    // If product_id wasn't provided in payload, update the document to set product_id = firestore doc id
    if (!docId) {
      try {
        await updateDoc(doc(db, 'tbl_listing', docRefAdded.id), { product_id: docRefAdded.id });
        console.log('✅ Updated product_id field to:', docRefAdded.id);
      } catch (updateErr) {
        console.warn('⚠️  Failed to update product_id, but document was created:', updateErr.message);
        // Continue anyway - the document is created, just the product_id update failed
      }
    }

    console.log('✅ Listing saved successfully to Firestore!');
    return { success: true, id: docRefAdded.id };
  } catch (err) {
    console.error('❌ firebaseCreateListing error:', err);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    return { success: false, message: err?.message || String(err) };
  }
};

// Update listing by matching product_id (server id) or by doc id
window.firebaseUpdateListing = async function(listing) {
  try {
    console.log('firebaseUpdateListing called with:', listing);
    const col = collection(db, 'tbl_listing');
    
    // Try to find doc by product_id first
    const q = query(col, where('product_id', '==', listing.id));
    const snaps = await getDocs(q);
    
    console.log('Found', snaps.size, 'documents with product_id:', listing.id);
    
    if (snaps.size === 0) {
      // Maybe listing.id is the firestore doc id
      console.log('No docs found by product_id, trying as firestore doc id');
      const docReference = doc(db, 'tbl_listing', String(listing.id));
      await updateDoc(docReference, {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        imageUrl: listing.imageUrl || ''
      });
      console.log('Updated doc by firestore id');
      return { success: true };
    }

    // Update all matching docs
    for (const d of snaps.docs) {
      console.log('Updating doc:', d.id);
      await updateDoc(doc(db, 'tbl_listing', d.id), {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        imageUrl: listing.imageUrl || ''
      });
    }

    console.log('Update completed successfully');
    return { success: true };
  } catch (err) {
    console.error('firebaseUpdateListing error', err);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    return { success: false, message: err?.message || String(err) };
  }
};

// Delete listing by product_id or doc id
window.firebaseDeleteListing = async function(productIdOrDocId) {
  try {
    console.log('firebaseDeleteListing called with:', productIdOrDocId);
    const col = collection(db, 'tbl_listing');
    const q = query(col, where('product_id', '==', productIdOrDocId));
    const snaps = await getDocs(q);
    
    console.log('Found', snaps.size, 'documents with product_id:', productIdOrDocId);
    
    if (snaps.size === 0) {
      // try deleting by doc id
      try {
        console.log('No docs found by product_id, trying as firestore doc id');
        await deleteDoc(doc(db, 'tbl_listing', String(productIdOrDocId)));
        console.log('Deleted doc by firestore id');
        return { success: true };
      } catch (e) {
        console.error('Error deleting by doc id:', e);
        return { success: false, message: 'No matching listing found' };
      }
    }

    for (const d of snaps.docs) {
      console.log('Deleting doc:', d.id);
      await deleteDoc(doc(db, 'tbl_listing', d.id));
    }
    
    console.log('Delete completed successfully');
    return { success: true };
  } catch (err) {
    console.error('firebaseDeleteListing error', err);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
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

// Fetch all products by a specific seller
window.firebaseFetchSellerProducts = async function(sellerUserId) {
  try {
    console.log('🔍 Fetching products for seller:', sellerUserId);
    const col = collection(db, 'tbl_listing');
    
    // Try to fetch by user_id
    let q = query(col, where('user_id', '==', sellerUserId));
    let snaps = await getDocs(q);
    
    console.log('📊 Found', snaps.size, 'products for user_id:', sellerUserId);
    
    // If no results and sellerUserId contains special chars, try alternative matching
    if (snaps.size === 0 && sellerUserId.includes(' ')) {
      console.log('⚠️  No products found with exact user_id, trying seller_name match...');
      q = query(col, where('seller_name', '==', sellerUserId));
      snaps = await getDocs(q);
      console.log('📊 Found', snaps.size, 'products by seller_name');
    }
    
    // If still no results, try seller_username
    if (snaps.size === 0) {
      console.log('⚠️  No products found, trying seller_username match...');
      q = query(col, where('seller_username', '==', sellerUserId));
      snaps = await getDocs(q);
      console.log('📊 Found', snaps.size, 'products by seller_username');
    }
    
    const products = [];
    snaps.forEach((doc) => {
      const data = doc.data();
      // Filter out dummy documents (boolean or placeholder docs)
      if (data.title && typeof data.title === 'string' && data.title.trim() !== '') {
        products.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    console.log('✅ Returning', products.length, 'valid products');
    return { success: true, products, count: products.length };
  } catch (err) {
    console.error('firebaseFetchSellerProducts error', err);
    return { success: false, message: err?.message || String(err), products: [] };
  }
};

// Fetch all active products (for browse page)
window.firebaseFetchAllProducts = async function() {
  try {
    console.log('Fetching all active products');
    const col = collection(db, 'tbl_listing');
    const snaps = await getDocs(col);
    
    console.log('Found', snaps.size, 'total products');
    
    const products = [];
    snaps.forEach((doc) => {
      const data = doc.data();
      // Filter out dummy documents (boolean or placeholder docs)
      // Only include documents with a valid title
      if (data.title && typeof data.title === 'string' && data.title.trim() !== '') {
        if (data.is_active !== false) { // Include unless explicitly inactive
          products.push({
            id: doc.id,
            ...data
          });
        }
      }
    });
    
    return { success: true, products, count: products.length };
  } catch (err) {
    console.error('firebaseFetchAllProducts error', err);
    return { success: false, message: err?.message || String(err), products: [] };
  }
};

// Fetch a single product by ID
window.firebaseFetchProductById = async function(productId) {
  try {
    console.log('Fetching product:', productId);
    const docRef = doc(db, 'tbl_listing', productId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      console.warn('Product not found:', productId);
      return { success: false, message: 'Product not found' };
    }
    
    const product = {
      id: snap.id,
      ...snap.data()
    };
    
    console.log('Product found:', product);
    return { success: true, product };
  } catch (err) {
    console.error('firebaseFetchProductById error', err);
    return { success: false, message: err?.message || String(err) };
  }
};

// Fetch products by category
window.firebaseFetchProductsByCategory = async function(category) {
  try {
    console.log('Fetching products in category:', category);
    const col = collection(db, 'tbl_listing');
    const q = query(col, where('category', '==', category));
    const snaps = await getDocs(q);
    
    console.log('Found', snaps.size, 'products in category:', category);
    
    const products = [];
    snaps.forEach((doc) => {
      const data = doc.data();
      // Filter out dummy documents
      if (data.title && typeof data.title === 'string' && data.title.trim() !== '') {
        if (data.is_active !== false) {
          products.push({
            id: doc.id,
            ...data
          });
        }
      }
    });
    
    return { success: true, products, count: products.length };
  } catch (err) {
    console.error('firebaseFetchProductsByCategory error', err);
    return { success: false, message: err?.message || String(err), products: [] };
  }
};

export default app;
