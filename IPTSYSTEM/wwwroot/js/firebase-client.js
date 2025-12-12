// Firebase client initialization module
// NOTE: This file intentionally contains the public Firebase web config as requested.
// It initializes Firebase (Auth + Firestore + Analytics) and exposes window.firebaseRegister

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, query, where, collection, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, arrayUnion, getCountFromServer } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

const firebaseConfig = { apiKey: "AIzaSyBHhIZv1_Ecryd3nw99S_osVwvdLT1Z9sA", authDomain: "recommerce2-c5f5c.firebaseapp.com", projectId: "recommerce2-c5f5c", storageBucket: "recommerce2-c5f5c.firebasestorage.app", messagingSenderId: "769830240332", appId: "1:769830240332:web:de0489490afe9a2242b4e9", measurementId: "G-2W1Y5M0REW" };
const app = initializeApp(firebaseConfig);
let analytics = null; try { analytics = getAnalytics(app); } catch (e) { console.debug('Firebase analytics not available:', e?.message || e); }
const auth = getAuth(app); const db = getFirestore(app); const storage = getStorage(app);

// ========== GLOBAL CACHE SYSTEM ==========
// Reduces Firestore reads by caching frequently accessed data
const CACHE_TTL = {
    PRODUCTS: 3 * 60 * 1000,      // 3 minutes for all products
    PROFILE: 10 * 60 * 1000,      // 10 minutes for user profiles
    SAVED: 5 * 60 * 1000,         // 5 minutes for saved products
    CONVERSATIONS: 2 * 60 * 1000  // 2 minutes for conversations
};

const dataCache = {
    allProducts: { data: null, timestamp: 0 },
    sellerProducts: new Map(),
    categoryProducts: new Map(),
    productById: new Map(),
    profiles: new Map(),
    savedProducts: new Map(),
    savedIds: new Map(),
    conversations: new Map()
};
dataCache.soldItems = new Map();
dataCache.messagesByConversation = new Map();

// Extra TTLs for specific caches
CACHE_TTL.SELLER_PRODUCTS = 1 * 60 * 1000; // 1 minute
CACHE_TTL.CATEGORY = 2 * 60 * 1000; // 2 minutes
CACHE_TTL.SOLD_ITEMS = 10 * 60 * 1000; // 10 minutes
CACHE_TTL.MESSAGES = 1 * 60 * 1000; // 1 minute for conversation messages

function isCacheValid(cacheEntry, ttl) {
    return cacheEntry && cacheEntry.timestamp && (Date.now() - cacheEntry.timestamp < ttl);
}

function setCache(cache, key, data, isMap = true) {
    const entry = { data, timestamp: Date.now() };
    if (isMap) {
        cache.set(key, entry);
    } else {
        cache.data = data;
        cache.timestamp = Date.now();
    }
}

// Clear specific cache types
window.firebaseClearCache = function (cacheType) {
    // Always clear all caches for reliability
    dataCache.allProducts = { data: null, timestamp: 0 };
    dataCache.sellerProducts.clear();
    dataCache.profiles.clear();
    dataCache.savedProducts.clear();
    dataCache.savedIds.clear();
    dataCache.conversations.clear();
    console.log('✅ Cleared ALL caches');
};

// -----------------------
// Geo data (Regions/Provinces/Cities/Barangays) from LOCAL JSON (ZERO Firestore reads!)
// Data file: /data/ph-addresses.json
// Structure: { regions: [], provinces: [], cities: [], barangays: [] }
// -----------------------
const geoCache = {
    loaded: false,
    allData: null,
    regions: null,
    provincesByRegion: {},
    citiesByRegion: {},
    citiesByProvince: {},
    barangaysByCity: {}
};

// Load all geo data from local JSON file (one-time fetch, zero Firestore reads)
async function loadGeoDataFromJson() {
    if (geoCache.loaded && geoCache.allData) {
        return geoCache.allData;
    }

    try {
        console.log('📍 Loading PH address data from local JSON...');
        const response = await fetch('/data/ph-addresses.json');
        if (!response.ok) {
            throw new Error(`Failed to load ph-addresses.json: ${response.status}`);
        }
        const data = await response.json();
        geoCache.allData = data;
        geoCache.loaded = true;
        console.log('✅ PH address data loaded:', {
            regions: data.regions?.length || 0,
            provinces: data.provinces?.length || 0,
            cities: data.cities?.length || 0,
            barangays: data.barangays?.length || 0
        });
        return data;
    } catch (err) {
        console.error('❌ Failed to load PH address JSON:', err);
        // Return empty structure to prevent crashes
        return { regions: [], provinces: [], cities: [], barangays: [] };
    }
}

async function geoLoadRegions() {
    if (geoCache.regions) return geoCache.regions;
    const data = await loadGeoDataFromJson();
    const arr = (data.regions || []).map(r => ({ code: r.code, name: r.name }));
    arr.sort((a, b) => a.name.localeCompare(b.name));
    geoCache.regions = arr;
    return arr;
}

async function geoLoadProvincesByRegion(regionCode) {
    if (!regionCode) return [];
    if (geoCache.provincesByRegion[regionCode]) return geoCache.provincesByRegion[regionCode];
    const data = await loadGeoDataFromJson();
    const results = (data.provinces || [])
        .filter(p => p.regionCode === regionCode)
        .map(p => ({ code: p.code, name: p.name, regionCode: p.regionCode }));
    results.sort((a, b) => a.name.localeCompare(b.name));
    geoCache.provincesByRegion[regionCode] = results;
    return results;
}

async function geoLoadCitiesByRegion(regionCode) {
    if (!regionCode) return [];
    if (geoCache.citiesByRegion[regionCode]) return geoCache.citiesByRegion[regionCode];
    const data = await loadGeoDataFromJson();
    const results = (data.cities || [])
        .filter(c => c.regionCode === regionCode)
        .map(c => ({ code: c.code, name: c.name, regionCode: c.regionCode, provinceCode: c.provinceCode }));
    results.sort((a, b) => a.name.localeCompare(b.name));
    geoCache.citiesByRegion[regionCode] = results;
    return results;
}

async function geoLoadCitiesByProvince(provinceCode) {
    if (!provinceCode) return [];
    if (geoCache.citiesByProvince[provinceCode]) return geoCache.citiesByProvince[provinceCode];
    const data = await loadGeoDataFromJson();
    const results = (data.cities || [])
        .filter(c => c.provinceCode === provinceCode)
        .map(c => ({ code: c.code, name: c.name, regionCode: c.regionCode, provinceCode: c.provinceCode }));
    results.sort((a, b) => a.name.localeCompare(b.name));
    geoCache.citiesByProvince[provinceCode] = results;
    return results;
}

async function geoLoadBarangaysByCity(cityCode) {
    if (!cityCode) return [];
    if (geoCache.barangaysByCity[cityCode]) return geoCache.barangaysByCity[cityCode];
    const data = await loadGeoDataFromJson();
    const results = (data.barangays || [])
        .filter(b => b.cityCode === cityCode)
        .map(b => ({ code: b.code, name: b.name, cityCode: b.cityCode }));
    results.sort((a, b) => a.name.localeCompare(b.name));
    geoCache.barangaysByCity[cityCode] = results;
    return results;
}

window.firebaseGeo = { loadRegions: geoLoadRegions, loadProvincesByRegion: geoLoadProvincesByRegion, loadCitiesByRegion: geoLoadCitiesByRegion, loadCitiesByProvince: geoLoadCitiesByProvince, loadBarangaysByCity: geoLoadBarangaysByCity };

// Presentation Mode removed: using local JSON and caching by default to reduce reads.

auth.onAuthStateChanged((user) => { if (user) { console.log('Firebase user authenticated:', user.uid, user.email); } else { console.log('No Firebase user authenticated'); tryAutoSignInFromSession(); } });
async function tryAutoSignInFromSession() { try { const userEmail = document.querySelector('[data-user-email]')?.getAttribute('data-user-email'); const sessionEmail = sessionStorage.getItem('SessionEmail'); if (!userEmail && !sessionEmail) { console.log('No user email in session, auto-sign in skipped'); return; } const email = userEmail || sessionEmail; console.log('Attempting auto-sign in with:', email); console.log('Auto-sign in prepared for:', email); } catch (err) { console.debug('Auto-sign in not available:', err.message); } }
window.tryAutoSignInFromSession = tryAutoSignInFromSession;

window.firebaseRegister = async function (firstName, lastName, email, password, username, accountType, phoneNumber, region, province, city, barangay, postalCode, streetAddress, composedAddress) {
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        await setDoc(doc(db, 'users', uid), { first_name: firstName || '', last_name: lastName || '', email: email || '', username: username || '', account_type: accountType || 'Buyer', phone_number: phoneNumber || '', region: region || '', province: province || '', city: city || '', barangay: barangay || '', postal_code: postalCode || '', street_address: streetAddress || '', address_full: composedAddress || '', user_id: uid, photo_url: '', date_created: serverTimestamp() });
        try { const createdSnap = await getDoc(doc(db, 'users', uid)); if (!createdSnap.exists()) { console.warn('User doc not found immediately after setDoc', { uid }); return { success: false, code: 'user-doc-missing', message: 'User created in Auth but profile document not found after write.' }; } console.info('Firebase registration succeeded', { uid }); return { success: true, uid, profile: createdSnap.data() }; } catch (re) { console.error('Error verifying created user document', re); return { success: false, code: 'user-doc-verify-failed', message: re?.message || String(re) }; }
    } catch (err) { const code = err?.code || null; const message = err?.message || String(err); console.error('Firebase register error', { code, message, err }); return { success: false, code, message }; }
};

// Listing helpers
window.firebaseCreateListing = async function (listing) {
    try {
        console.log('🔥 firebaseCreateListing called with:', listing);

        let userId = null;
        const user = auth.currentUser;

        console.log('👤 Current Firebase Auth User:', user ? user.uid : 'null (not signed in)');

        if (user) {
            userId = user.uid;
            console.log('✅ Using Firebase authenticated user:', userId);
        } else {
            userId = sessionStorage.getItem('UserId') || 'anonymous-' + Date.now();
            console.log('⚠️  Using session/anonymous user ID (Unauthenticated):', userId);
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

        if (!docId) {
            try {
                await updateDoc(doc(db, 'tbl_listing', docRefAdded.id), { product_id: docRefAdded.id });
                console.log('✅ Updated product_id field to:', docRefAdded.id);
            } catch (updateErr) {
                console.warn('⚠️  Failed to update product_id, but document was created:', updateErr.message);
            }
        }
        console.log('✅ Listing saved successfully to Firestore!');
        return { success: true, id: docRefAdded.id };
    } catch (err) {
        console.error('❌ firebaseCreateListing error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};
window.firebaseUpdateListing = async function (listing) { try { console.log('firebaseUpdateListing called with:', listing); const col = collection(db, 'tbl_listing'); const q = query(col, where('product_id', '==', listing.id)); const snaps = await getDocs(q); console.log('Found', snaps.size, 'documents with product_id:', listing.id); if (snaps.size === 0) { console.log('No docs found by product_id, trying as firestore doc id'); const docReference = doc(db, 'tbl_listing', String(listing.id)); await updateDoc(docReference, { title: listing.title, description: listing.description, price: listing.price, category: listing.category, condition: listing.condition, imageUrl: listing.imageUrl || '' }); console.log('Updated doc by firestore id'); return { success: true }; } for (const d of snaps.docs) { console.log('Updating doc:', d.id); await updateDoc(doc(db, 'tbl_listing', d.id), { title: listing.title, description: listing.description, price: listing.price, category: listing.category, condition: listing.condition, imageUrl: listing.imageUrl || '' }); } console.log('Update completed successfully'); return { success: true }; } catch (err) { console.error('firebaseUpdateListing error', err); return { success: false, message: err?.message || String(err) }; } };
window.firebaseDeleteListing = async function (productIdOrDocId) { try { console.log('firebaseDeleteListing called with:', productIdOrDocId); const col = collection(db, 'tbl_listing'); const q = query(col, where('product_id', '==', productIdOrDocId)); const snaps = await getDocs(q); console.log('Found', snaps.size, 'documents with product_id:', productIdOrDocId); if (snaps.size === 0) { try { console.log('No docs found by product_id, trying as firestore doc id'); await deleteDoc(doc(db, 'tbl_listing', String(productIdOrDocId))); console.log('Deleted doc by firestore id'); return { success: true }; } catch (e) { console.error('Error deleting by doc id:', e); return { success: false, message: 'No matching listing found' }; } } for (const d of snaps.docs) { console.log('Deleting doc:', d.id); await deleteDoc(doc(db, 'tbl_listing', d.id)); } console.log('Delete completed successfully'); return { success: true }; } catch (err) { console.error('firebaseDeleteListing error', err); return { success: false, message: err?.message || String(err) }; } };
window.firebaseMarkAsSold = async function (productIdOrDocId) { try { console.log('firebaseMarkAsSold called with:', productIdOrDocId); const col = collection(db, 'tbl_listing'); const q = query(col, where('product_id', '==', productIdOrDocId)); const snaps = await getDocs(q); console.log('Found', snaps.size, 'documents with product_id:', productIdOrDocId); if (snaps.size === 0) { try { console.log('No docs found by product_id, trying as firestore doc id'); const docReference = doc(db, 'tbl_listing', String(productIdOrDocId)); await updateDoc(docReference, { status: 'sold', sold_date: serverTimestamp() }); console.log('Marked as sold by firestore id'); return { success: true }; } catch (e) { console.error('Error marking as sold by doc id:', e); return { success: false, message: 'No matching listing found' }; } } for (const d of snaps.docs) { console.log('Marking as sold doc:', d.id); await updateDoc(doc(db, 'tbl_listing', d.id), { status: 'sold', sold_date: serverTimestamp() }); } console.log('Mark as sold completed successfully'); return { success: true }; } catch (err) { console.error('firebaseMarkAsSold error', err); return { success: false, message: err?.message || String(err) }; } };
window.firebaseFetchSoldItems = async function (sellerUserId, forceRefresh = false, limitCount = 200) {
    try {
        if (!sellerUserId) return { success: true, items: [], count: 0 };
        // Check cache first
        if (!forceRefresh) {
            const cached = dataCache.soldItems.get(sellerUserId);
            if (isCacheValid(cached, CACHE_TTL.SOLD_ITEMS)) {
                console.log('✅ Using cached sold items for seller:', sellerUserId);
                return { success: true, items: cached.data, count: cached.data.length, cached: true };
            }
        } else {
            dataCache.soldItems.delete(sellerUserId);
        }

        console.log('🔍 Fetching sold items for seller:', sellerUserId);
        const col = collection(db, 'tbl_listing');
        const q = query(col, where('user_id', '==', sellerUserId), where('status', '==', 'sold'), limit(limitCount));
        let snaps = await getDocs(q);
        console.log('📊 Found', snaps.size, 'sold items');
        const soldItems = [];
        snaps.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.title && typeof data.title === 'string' && data.title.trim() !== '') {
                soldItems.push({ id: docSnap.id, ...data });
            }
        });

        // Cache sold items for this seller
        setCache(dataCache.soldItems, sellerUserId, soldItems);

        console.log('✅ Returning', soldItems.length, 'sold items');
        return { success: true, items: soldItems, count: soldItems.length };
    } catch (err) {
        console.error('firebaseFetchSoldItems error', err);
        return { success: false, message: err?.message || String(err), items: [] };
    }
};
window.__firebaseConfig = firebaseConfig;
window.firebaseSignIn = async function (email, password) {
    try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        const userDocRef = doc(db, 'users', uid);
        const snap = await getDoc(userDocRef);

        // LOGIN RESTRICTION: Check if user document exists in Firestore (deleted user check)
        if (!snap.exists()) {
            console.warn('User document not found in Firestore - account may have been deleted');
            try { await signOut(auth); } catch { }
            return {
                success: false,
                code: 'user-deleted',
                message: 'Your account has been deleted. Please contact the administrator if you believe this is an error.'
            };
        }

        // LOGIN RESTRICTION: Check if user is enabled (disabled user check)
        const profile = snap.data();

        // Check isEnabled field (new system)
        if (profile.isEnabled === false) {
            console.warn('User account is disabled:', uid);
            try { await signOut(auth); } catch { }
            return {
                success: false,
                code: 'user-disabled',
                message: 'Your account is suspended. Please contact the administrator.'
            };
        }

        // BACKWARD COMPATIBILITY: Also check legacy status fields
        let isInactive = false;
        // status string field
        if (profile.status && String(profile.status).trim().toLowerCase() === 'inactive') isInactive = true;
        // account_status alias
        if (!isInactive && profile.account_status && String(profile.account_status).trim().toLowerCase() === 'inactive') isInactive = true;
        // boolean flags
        if (!isInactive && (profile.is_active !== undefined)) {
            if (profile.is_active === false || String(profile.is_active).toLowerCase() === 'false') isInactive = true;
        }
        if (!isInactive && (profile.active !== undefined)) {
            if (profile.active === false || String(profile.active).toLowerCase() === 'false') isInactive = true;
        }

        if (isInactive) {
            try { await signOut(auth); } catch { }
            return {
                success: false,
                code: 'user-disabled',
                message: 'Your account is suspended. Please contact the administrator.'
            };
        }

        // EMAIL VERIFICATION CHECK: Require email verification before login
        if (!userCred.user.emailVerified) {
            console.warn('User email not verified:', uid);
            try { await signOut(auth); } catch { }
            return {
                success: false,
                code: 'email-not-verified',
                message: 'Please verify your email before logging in. Check your inbox for the verification link.'
            };
        }

        console.log('✅ Login successful for user:', uid);
        return { success: true, uid, profile: profile };
    } catch (err) {
        const code = err?.code || null;
        const message = err?.message || String(err);
        console.error('Firebase signIn error', { code, message, err });
        return { success: false, code, message };
    }
};

// Password Reset
window.firebaseSendPasswordResetEmail = async function (email) {
    try {
        console.log('📧 Sending password reset email to:', email);
        const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js');
        await sendPasswordResetEmail(auth, email);
        console.log('✅ Password reset email sent');
        return { success: true };
    } catch (err) {
        console.error('❌ Password reset error:', err);
        return { success: false, message: err.message, code: err.code };
    }
};

// Send Email Verification
window.firebaseSendEmailVerification = async function () {
    try {
        console.log('📧 Sending email verification...');

        if (!auth.currentUser) {
            throw new Error('No user is currently signed in');
        }

        if (auth.currentUser.emailVerified) {
            console.log('✅ Email already verified');
            return { success: true, message: 'Email already verified' };
        }

        const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js');
        await sendEmailVerification(auth.currentUser);

        console.log('✅ Verification email sent');
        return { success: true, message: 'Verification email sent. Please check your inbox.' };
    } catch (err) {
        console.error('❌ Email verification error:', err);
        return { success: false, message: err.message, code: err.code };
    }
};

// Register new user with Firebase Authentication
window.firebaseRegisterUser = async function (userData) {
    try {
        console.log('📝 Registering new user:', userData.email);

        // Validate required fields
        if (!userData.email || !userData.password) {
            throw new Error('Email and password are required');
        }

        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;
        const uid = user.uid;

        console.log('✅ Firebase Auth account created:', uid);

        // Send email verification
        try {
            const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js');
            await sendEmailVerification(user);
            console.log('✅ Verification email sent to:', userData.email);
        } catch (emailError) {
            console.warn('⚠️ Failed to send verification email:', emailError);
            // Continue with registration even if email fails
        }

        // Create user profile in Firestore
        const userProfile = {
            email: userData.email,
            username: userData.username || '',
            first_name: userData.firstName || '',
            last_name: userData.lastName || '',
            phone_number: userData.phoneNumber || '',
            account_type: userData.accountType || 'Buyer',
            region: userData.region || '',
            province: userData.province || '',
            city: userData.city || '',
            barangay: userData.barangay || '',
            postal_code: userData.postalCode || '',
            street_address: userData.streetAddress || '',
            address: userData.address || '',
            isEnabled: true,
            date_created: serverTimestamp(),
            updated_at: serverTimestamp()
        };

        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, userProfile);

        console.log('✅ User profile created in Firestore');

        // Sign out the user (they need to verify email first)
        await signOut(auth);

        return {
            success: true,
            uid: uid,
            message: 'Registration successful! Please check your email to verify your account before logging in.'
        };
    } catch (err) {
        console.error('❌ Registration error:', err);

        // Handle specific Firebase errors
        let message = err.message;
        if (err.code === 'auth/email-already-in-use') {
            message = 'This email is already registered. Please log in or use a different email.';
        } else if (err.code === 'auth/weak-password') {
            message = 'Password is too weak. Please use at least 6 characters.';
        } else if (err.code === 'auth/invalid-email') {
            message = 'Invalid email address format.';
        }

        return {
            success: false,
            code: err.code,
            message: message
        };
    }
};

window.firebaseUserExistsByEmail = async function (email) { try { const q = query(collection(db, 'users'), where('email', '==', email), limit(1)); const snap = await getDocs(q); return snap.size > 0; } catch (err) { console.error('Error checking user exists by email', err); return false; } };
window.establishServerSession = async function (email, uid) { try { let profile = null; try { const userDocRef = doc(db, 'users', uid); const s = await getDoc(userDocRef); if (s.exists()) profile = s.data(); } catch (e) { console.debug('Could not load user profile for server session:', e); } const payload = { Email: email, Uid: uid, Username: profile?.username || null, UserType: profile?.account_type || null, FullName: profile?.first_name || profile?.last_name ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() : null }; const resp = await fetch('/Home/ClientLogin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) }); return await resp.json(); } catch (e) { console.error('Failed to establish server session', e); return { success: false, message: e?.message || String(e) }; } };
window.firebaseFetchSellerProducts = async function (sellerUserId, forceRefresh = false, includeSold = false, limitCount = 200) {
    try {
        // Normal caching behavior remains for fetchSellerProducts
        // Check cache first (unless forced)
        if (!forceRefresh) {
            const cached = dataCache.sellerProducts.get(sellerUserId);
            if (isCacheValid(cached, CACHE_TTL.SELLER_PRODUCTS)) {
                console.log('✅ Using cached seller products for:', sellerUserId);
                return { success: true, products: cached.data, count: cached.data.length, cached: true };
            }
        } else {
            dataCache.sellerProducts.delete(sellerUserId);
        }

        console.log('🔍 Fetching products for seller:', sellerUserId);
        const col = collection(db, 'tbl_listing');
        let q = query(col, where('user_id', '==', sellerUserId), limit(limitCount));
        let snaps = await getDocs(q);
        console.log('📊 Found', snaps.size, 'products for user_id:', sellerUserId);

        if (snaps.size === 0 && sellerUserId.includes(' ')) {
            console.log('⚠️  No products found with exact user_id, trying seller_name match...');
            q = query(col, where('seller_name', '==', sellerUserId));
            snaps = await getDocs(q);
            console.log('📊 Found', snaps.size, 'products by seller_name');
        }
        if (snaps.size === 0) {
            console.log('⚠️  No products found, trying seller_username match...');
            q = query(col, where('seller_username', '==', sellerUserId));
            snaps = await getDocs(q);
            console.log('📊 Found', snaps.size, 'products by seller_username');
        }

        const products = [];
        snaps.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.title && typeof data.title === 'string' && data.title.trim() !== '') {
                // Filter by status - exclude sold items unless includeSold is true
                if (includeSold || data.status !== 'sold') {
                    products.push({ id: docSnap.id, ...data });
                }
            }
        });

        // Cache results
        setCache(dataCache.sellerProducts, sellerUserId, products);

        console.log('✅ Returning', products.length, 'valid products');
        return { success: true, products, count: products.length };
    } catch (err) {
        console.error('firebaseFetchSellerProducts error', err);
        return { success: false, message: err?.message || String(err), products: [] };
    }
};
window.firebaseFetchAllProducts = async function (forceRefresh = false, limitCount = 100) {
    try {
        // Keep normal caching behavior for all products
        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            const cached = dataCache.allProducts?.data;
            const cacheAge = Date.now() - (dataCache.allProducts?.timestamp || 0);
            if (cached && cacheAge < 30000) { // 30 second cache
                console.log('✅ Using cached products (', cached.length, 'items)');
                return { success: true, products: cached, count: cached.length, cached: true };
            }
        }

        console.log('🔄 Fetching products from Firestore', limitCount ? `(limit: ${limitCount})` : '');
        const col = collection(db, 'tbl_listing');

        // Use a limited query to reduce reads and transfer
        const snaps = await getDocs(query(col, limit(limitCount)));
        console.log('📦 Found', snaps.size, 'total documents');

        // Collect unique user IDs and filter out sold items
        const userIds = new Set();
        const productsRaw = [];

        snaps.forEach(docSnap => {
            const data = docSnap.data();
            // Filter out sold items and empty titles
            if (data.title && typeof data.title === 'string' && data.title.trim() !== '' && data.status !== 'sold') {
                productsRaw.push({ id: docSnap.id, ...data });
                if (data.user_id) userIds.add(data.user_id);
            }
        });

        // Sort by date (newest first) and apply limit if specified
        productsRaw.sort((a, b) => {
            const dateA = a.created_at?.seconds || a.date_created?.seconds || 0;
            const dateB = b.created_at?.seconds || b.date_created?.seconds || 0;
            return dateB - dateA;
        });

        const productsFiltered = limitCount ? productsRaw.slice(0, limitCount) : productsRaw;
        console.log('📦 After filtering:', productsFiltered.length, 'active products');

        // Batch fetch all unique sellers at once (much faster!)
        const userCache = {};
        if (userIds.size > 0) {
            console.log('👥 Fetching', userIds.size, 'unique sellers in batches...');
            const idsArr = Array.from(userIds);
            const chunkSize = 10; // Firestore 'in' query limit
            for (let i = 0; i < idsArr.length; i += chunkSize) {
                const chunk = idsArr.slice(i, i + chunkSize);
                try {
                    // Use cached profiles when available; fetch from Firestore for the rest
                    const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
                    const usersSnap = await getDocs(usersQuery);
                    usersSnap.forEach(uDoc => {
                        const userId = uDoc.id;
                        const userData = uDoc.data();
                        userCache[userId] = {
                            fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username || 'Unknown Seller',
                            username: userData.username || userData.email?.split('@')[0] || ''
                        };
                    });
                } catch (err) {
                    console.debug('Could not fetch user chunk:', chunk, err);
                }
            }
        }

        // Map seller info to products
        const products = productsFiltered.map(product => {
            const sellerInfo = userCache[product.user_id];
            return {
                ...product,
                seller_name: sellerInfo?.fullName || product.seller_name || 'Unknown Seller',
                seller_username: sellerInfo?.username || product.seller_username || ''
            };
        });

        // Cache the results
        setCache(dataCache.allProducts, null, products, false);

        console.log('✅ Products loaded successfully');
        return { success: true, products, count: products.length };
    } catch (err) {
        console.error('❌ firebaseFetchAllProducts error', err);
        return { success: false, message: err?.message || String(err), products: [] };
    }
};

// Fetch products for a specific user (optimized for Profile page)
window.firebaseFetchUserProducts = async function (userId, includeSold = false, forceRefresh = false, limitCount = 200) {
    try {
        console.log('🔄 Fetching products for user:', userId, 'includeSold:', includeSold);
        const cacheKey = `${userId}:${includeSold ? 'all' : 'active'}`;
        if (!forceRefresh) {
            const cached = dataCache.sellerProducts.get(cacheKey);
            if (isCacheValid(cached, CACHE_TTL.SELLER_PRODUCTS)) {
                console.log('✅ Using cached user products for:', userId);
                return { success: true, products: cached.data, count: cached.data.length, cached: true };
            }
        } else {
            dataCache.sellerProducts.delete(cacheKey);
        }
        const col = collection(db, 'tbl_listing');

        // Query only for this user's products - no orderBy to avoid missing field issues
        const q = query(col, where('user_id', '==', userId), limit(limitCount));

        const snaps = await getDocs(q);
        console.log('📦 Found', snaps.size, 'total products for user');

        const products = [];
        snaps.forEach(docSnap => {
            const data = docSnap.data();
            // Filter out sold items client-side if not included
            const shouldInclude = data.title && typeof data.title === 'string' && data.title.trim() !== '' && (includeSold || data.status !== 'sold');
            if (shouldInclude) {
                products.push({ id: docSnap.id, ...data });
            }
        });

        // Sort by date (newest first)
        products.sort((a, b) => {
            const dateA = a.created_at?.seconds || a.date_created?.seconds || 0;
            const dateB = b.created_at?.seconds || b.date_created?.seconds || 0;
            return dateB - dateA;
        });

        console.log('📦 After filtering:', products.length, 'products');
        setCache(dataCache.sellerProducts, cacheKey, products);

        // Fetch user info for seller name
        if (products.length > 0) {
            try {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username || 'Unknown Seller';
                    const username = userData.username || userData.email?.split('@')[0] || '';
                    products.forEach(p => {
                        p.seller_name = fullName;
                        p.seller_username = username;
                    });
                }
            } catch (err) {
                console.debug('Could not fetch user info');
            }
        }

        console.log('✅ User products loaded successfully');
        return { success: true, products, count: products.length };
    } catch (err) {
        console.error('❌ firebaseFetchUserProducts error', err);
        return { success: false, message: err?.message || String(err), products: [] };
    }
};

window.firebaseFetchProductById = async function (productId, forceRefresh = false) {
    try {
        // Normal caching behavior remains for fetchProductById
        if (!productId) return { success: false, message: 'Invalid product id' };
        if (!forceRefresh) {
            const cached = dataCache.productById.get(productId);
            if (isCacheValid(cached, CACHE_TTL.PRODUCTS)) {
                console.log('✅ Using cached product:', productId);
                return { success: true, product: cached.data, cached: true };
            }
        } else {
            dataCache.productById.delete(productId);
        }

        console.log('Fetching product:', productId);
        const docRef = doc(db, 'tbl_listing', productId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            console.warn('Product not found:', productId);
            return { success: false, message: 'Product not found' };
        }
        const product = { id: snap.id, ...snap.data() };
        setCache(dataCache.productById, productId, product);
        console.log('Product found:', product);
        return { success: true, product };
    } catch (err) {
        console.error('firebaseFetchProductById error', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// ========== MESSAGING FUNCTIONS ==========

// Create or get existing conversation
window.firebaseStartConversation = async function (buyerId, buyerName, sellerId, sellerName, listingId, listingTitle) {
    try {
        console.log('🔥 Starting conversation:', { buyerId, buyerName, sellerId, sellerName, listingId, listingTitle });

        if (!buyerId || !sellerId || !listingId) {
            console.error('❌ Missing required fields for conversation');
            return { success: false, message: 'Missing required fields' };
        }

        // Validate Auth
        if (!auth.currentUser) {
            console.warn('⚠️ User not authenticated in Firebase. Write operation may fail.');
            // Attempt to restore session if possible (optional logic here)
        } else {
            console.log('👤 Authenticated as:', auth.currentUser.uid);
        }

        // Create a readable conversation ID: buyer_seller_listing
        const conversationId = `${buyerId}_${sellerId}_${listingId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        console.log('🆔 Generated Conversation ID:', conversationId);

        // Check if conversation already exists
        const conversationRef = doc(db, 'conversations', conversationId);
        const existingSnap = await getDoc(conversationRef);

        if (existingSnap.exists()) {
            console.log('✅ Found existing conversation:', conversationId);
            return { success: true, conversation: { id: existingSnap.id, ...existingSnap.data() } };
        }

        // Create new conversation with specific ID
        const conversationData = {
            buyerId: buyerId,
            buyerName: buyerName || 'Buyer',
            sellerId: sellerId,
            sellerName: sellerName || 'Seller',
            listingId: listingId,
            listingTitle: listingTitle || 'Item',
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp(),
            members: [buyerId, sellerId] // Array for easier querying in rules
        };

        await setDoc(conversationRef, conversationData);
        console.log('✅ Created new conversation:', conversationId);

        return { success: true, conversation: { id: conversationId, ...conversationData } };
    } catch (err) {
        console.error('❌ firebaseStartConversation error:', err);
        console.error('Error Code:', err.code || 'unknown');
        console.error('Error Message:', err.message || '');
        return { success: false, message: err?.message || String(err) };
    }
};

// Get user conversations (with caching)
// Get user conversations (with caching)
window.firebaseGetUserConversations = async function (userId, forceRefresh = false, limitCount = 100) {
    try {
        // Normal caching behavior remains for getUserConversations
        // Check cache first
        const cached = dataCache.conversations.get(userId);
        if (!forceRefresh && isCacheValid(cached, CACHE_TTL.CONVERSATIONS)) {
            console.log('💬 Using cached conversations for:', userId);
            return { success: true, conversations: cached.data, cached: true };
        }

        console.log('🔥 Getting conversations for user:', userId);
        const conversationsCol = collection(db, 'conversations');
        const conversations = [];
        const processedIds = new Set();

        // Helper to process snapshots
        const processSnapshots = (snaps) => {
            snaps.forEach(docSnap => {
                if (!processedIds.has(docSnap.id)) {
                    processedIds.add(docSnap.id);
                    const data = docSnap.data();
                    // Only add if document has required fields
                    if (data.buyerId || data.sellerId) {
                        conversations.push({ id: docSnap.id, ...data });
                    }
                }
            });
        };

        // Query where user is buyer
        try {
            // fast path: sorted query (requires index)
            const buyerQuery = query(conversationsCol, where('buyerId', '==', userId), orderBy('lastMessageTime', 'desc'), limit(limitCount));
            const buyerSnaps = await getDocs(buyerQuery);
            processSnapshots(buyerSnaps);
            console.log('📊 Found', buyerSnaps.size, 'conversations as buyer (sorted)');
        } catch (e) {
            console.warn('⚠️ Index missing for buyer query? Falling back to unsorted query', e.message);
            // Fallback: simple query (no sort), sort in memory
            try {
                const buyerQueryFallback = query(conversationsCol, where('buyerId', '==', userId), limit(limitCount));
                const buyerSnaps = await getDocs(buyerQueryFallback);
                processSnapshots(buyerSnaps);
                console.log('📊 Found', buyerSnaps.size, 'conversations as buyer (fallback)');
            } catch (err2) {
                console.error('❌ Buyer query failed completely', err2);
            }
        }

        // Query where user is seller
        try {
            // fast path: sorted query (requires index)
            const sellerQuery = query(conversationsCol, where('sellerId', '==', userId), orderBy('lastMessageTime', 'desc'), limit(limitCount));
            const sellerSnaps = await getDocs(sellerQuery);
            processSnapshots(sellerSnaps);
            console.log('📊 Found', sellerSnaps.size, 'conversations as seller (sorted)');
        } catch (e) {
            console.warn('⚠️ Index missing for seller query? Falling back to unsorted query', e.message);
            // Fallback: simple query (no sort), sort in memory
            try {
                const sellerQueryFallback = query(conversationsCol, where('sellerId', '==', userId), limit(limitCount));
                const sellerSnaps = await getDocs(sellerQueryFallback);
                processSnapshots(sellerSnaps);
                console.log('📊 Found', sellerSnaps.size, 'conversations as seller (fallback)');
            } catch (err2) {
                console.error('❌ Seller query failed completely', err2);
            }
        }

        // Sort by lastMessageTime descending (memory sort handles the fallback cases)
        conversations.sort((a, b) => {
            const getTime = (t) => {
                if (!t) return 0;
                if (t.seconds) return t.seconds;
                if (t.toDate && typeof t.toDate === 'function') return t.toDate().getTime() / 1000;
                if (t instanceof Date) return t.getTime() / 1000;
                return new Date(t).getTime() / 1000;
            };
            return getTime(b.lastMessageTime) - getTime(a.lastMessageTime);
        });

        // Cache the results
        setCache(dataCache.conversations, userId, conversations);

        console.log('✅ Total conversations found:', conversations.length);
        return { success: true, conversations };
    } catch (err) {
        console.error('❌ firebaseGetUserConversations error:', err);
        return { success: false, message: err?.message || String(err), conversations: [] };
    }
};

// Get messages for a conversation
window.firebaseGetMessages = async function (conversationId, forceRefresh = false, limitCount = 200) {
    try {
        // Normal caching behavior remains for getMessages
        if (!conversationId) return { success: false, message: 'Invalid conversation id', messages: [] };
        if (!forceRefresh) {
            const cached = dataCache.messagesByConversation.get(conversationId);
            if (isCacheValid(cached, CACHE_TTL.MESSAGES)) {
                console.log('✅ Using cached messages for conversation:', conversationId);
                return { success: true, messages: cached.data, cached: true };
            }
        } else {
            dataCache.messagesByConversation.delete(conversationId);
        }

        console.log('🔥 Getting messages for conversation:', conversationId);
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        // Default to retrieving recent messages only to avoid massive reads
        const q = query(messagesCol, orderBy('timestamp', 'desc'), limit(limitCount));
        const snaps = await getDocs(q);

        const messages = [];
        snaps.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        // Reverse so messages are ascending by timestamp
        messages.reverse();

        // Cache messages
        setCache(dataCache.messagesByConversation, conversationId, messages);

        console.log('✅ Found', messages.length, 'messages');
        return { success: true, messages };
    } catch (err) {
        console.error('❌ firebaseGetMessages error:', err);
        return { success: false, message: err?.message || String(err), messages: [] };
    }
};

// Real-time message listener (uses onSnapshot - more efficient than polling!)
// Returns an unsubscribe function
window.firebaseListenToMessages = function (conversationId, callback, limitCount = 100) {
    try {
        // If we have cached messages, call the callback immediately to populate UI fast
        const cached = dataCache.messagesByConversation.get(conversationId);
        if (cached && cached.data) setTimeout(() => callback(cached.data), 20);
        console.log('🔔 Setting up real-time message listener for:', conversationId);
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        // Only listen to last N messages to reduce reads
        const q = query(messagesCol, orderBy('timestamp', 'desc'), limit(limitCount));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });

            // Messages from query are descending; reverse to ascending
            messages.reverse();

            callback(messages);
        }, (error) => {
            console.error('❌ Message listener error:', error);
        });

        return unsubscribe;
    } catch (err) {
        console.error('❌ firebaseListenToMessages error:', err);
        return null;
    }
};

// Send a message
window.firebaseSendMessage = async function (conversationId, senderId, senderName, text) {
    try {
        console.log('🔥 Sending message:', { conversationId, senderId, senderName, text });

        if (!conversationId || !senderId || !text) {
            console.error('❌ Missing fields for message');
            return { success: false, message: 'Missing fields' };
        }

        // Validate Auth
        if (!auth.currentUser) {
            console.warn('⚠️ User not authenticated in Firebase. Write may fail.');
        }

        // First, ensure the conversation document exists
        const conversationRef = doc(db, 'conversations', conversationId);

        // Optimistically add message first? No, standard flow.

        // Add message to subcollection
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        const messageData = {
            senderId: senderId,
            senderName: senderName || 'User',
            text: text,
            timestamp: serverTimestamp()
        };

        const newMsgRef = await addDoc(messagesCol, messageData);
        console.log('✅ Message added with ID:', newMsgRef.id);

        // Update parent conversation with last message and sender for notifications
        try {
            await updateDoc(conversationRef, {
                lastMessage: text,
                lastMessageTime: serverTimestamp(),
                lastMessageSenderId: senderId
            });
            console.log('✅ Conversation updated');
        } catch (updateErr) {
            console.warn('⚠️ Could not update conversation lastMessage:', updateErr.message);
            // It's possible the conversation doc doesn't exist or we don't have permission to update it
            // checking if doc exists
            try {
                const snap = await getDoc(conversationRef);
                if (!snap.exists()) {
                    console.error('❌ Conversation document MISSING when sending message!');
                    // Attempt to recreate it?
                }
            } catch (e) {
                console.error('Check failed:', e);
            }
        }

        return { success: true, messageId: newMsgRef.id };
    } catch (err) {
        console.error('❌ firebaseSendMessage error:', err);
        console.error('Code:', err.code);
        return { success: false, message: err?.message || String(err) };
    }
};

// Send a product inquiry message (includes product details)
window.firebaseSendProductInquiry = async function (conversationId, senderId, senderName, productData) {
    try {
        console.log('📦 Sending product inquiry:', { conversationId, productData });

        if (!conversationId || !senderId || !productData) {
            throw new Error('Missing required fields');
        }

        const messageData = {
            senderId: senderId,
            senderName: senderName || 'User',
            text: `I'm interested in this item:`,
            messageType: 'product_inquiry',
            productData: {
                productId: productData.productId || productData.id,
                title: productData.title || 'Product',
                price: productData.price || 0,
                imageUrl: productData.imageUrl || productData.image_url || '',
                condition: productData.condition || 'New'
            },
            timestamp: serverTimestamp()
        };

        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        const newMsgRef = await addDoc(messagesCol, messageData);

        // Update conversation's last message
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
            lastMessage: `📦 Product inquiry: ${productData.title}`,
            lastMessageTime: serverTimestamp(),
            lastMessageSenderId: senderId
        });

        console.log('✅ Product inquiry sent:', newMsgRef.id);
        return { success: true, messageId: newMsgRef.id };
    } catch (err) {
        console.error('❌ firebaseSendProductInquiry error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Global helper: Message seller about a specific product
window.messageSellerAboutProduct = async function (productData) {
    try {
        console.log('📦 Starting product inquiry:', productData);

        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) {
            alert('Please log in to message sellers');
            window.location.href = '/Home/Login';
            return;
        }

        const sellerId = productData.sellerId || productData.user_id;
        const sellerName = productData.sellerName || productData.seller_name || 'Seller';

        if (!sellerId) {
            alert('Seller information not available');
            return;
        }

        if (currentUserId === sellerId) {
            alert('You cannot message yourself');
            return;
        }

        // Get current user name
        let currentUserName = 'User';
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUserId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                currentUserName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username || 'User';
            }
        } catch (e) {
            console.warn('Could not fetch user name:', e);
        }

        // Start or get conversation
        const convResult = await window.firebaseStartConversation(
            currentUserId,
            currentUserName,
            sellerId,
            sellerName,
            productData.id || productData.productId || 'product',
            `Product inquiry: ${productData.title}`
        );

        if (!convResult.success || !convResult.conversation) {
            alert('Failed to start conversation: ' + (convResult.message || 'Unknown error'));
            return;
        }

        const conversationId = convResult.conversation.id;

        // Send product inquiry message
        const inquiryResult = await window.firebaseSendProductInquiry(
            conversationId,
            currentUserId,
            currentUserName,
            {
                productId: productData.id || productData.productId,
                title: productData.title,
                price: productData.price,
                imageUrl: productData.imageUrl || productData.image_url,
                condition: productData.condition
            }
        );

        if (inquiryResult.success) {
            // Redirect to messages page
            window.location.href = `/Home/Messages?conversationId=${conversationId}`;
        } else {
            alert('Failed to send product inquiry: ' + (inquiryResult.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('❌ messageSellerAboutProduct error:', err);
        alert('An error occurred. Please try again.');
    }
};

// Get conversation by ID
window.firebaseGetConversation = async function (conversationId) {
    try {
        console.log('🔥 Getting conversation:', conversationId);
        const docRef = doc(db, 'conversations', conversationId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.warn('⚠️ Conversation document does not exist:', conversationId);
            return { success: false, message: 'Conversation not found' };
        }

        const data = snap.data();

        // Check if conversation has required fields
        if (!data.buyerId && !data.sellerId) {
            console.warn('⚠️ Conversation missing required fields:', conversationId);
            return { success: false, message: 'Conversation data is incomplete' };
        }

        return { success: true, conversation: { id: snap.id, ...data } };
    } catch (err) {
        console.error('❌ firebaseGetConversation error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Fix/update an existing conversation document that might be missing fields
window.firebaseFixConversation = async function (conversationId, buyerId, buyerName, sellerId, sellerName, listingId, listingTitle) {
    try {
        console.log('🔧 Fixing conversation:', conversationId);
        const conversationRef = doc(db, 'conversations', conversationId);

        await setDoc(conversationRef, {
            buyerId: buyerId,
            buyerName: buyerName,
            sellerId: sellerId,
            sellerName: sellerName,
            listingId: listingId || '',
            listingTitle: listingTitle || '',
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp()
        }, { merge: true });

        console.log('✅ Conversation fixed:', conversationId);
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseFixConversation error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};
window.firebaseFetchProductsByCategory = async function (category, forceRefresh = false, limitCount = 100) {
    try {
        if (!category) return { success: true, products: [], count: 0 };
        const cacheKey = String(category || '').toLowerCase();
        if (!forceRefresh) {
            const cached = dataCache.categoryProducts.get(cacheKey);
            if (isCacheValid(cached, CACHE_TTL.CATEGORY)) {
                console.log('✅ Using cached products for category:', category);
                return { success: true, products: cached.data, count: cached.data.length, cached: true };
            }
        } else {
            dataCache.categoryProducts.delete(cacheKey);
        }

        console.log('Fetching products in category:', category);
        const col = collection(db, 'tbl_listing');
        const q = query(col, where('category', '==', category), limit(limitCount));
        const snaps = await getDocs(q);
        console.log('Found', snaps.size, 'products in category:', category);
        const products = [];
        snaps.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.title && typeof data.title === 'string' && data.title.trim() !== '') {
                if (data.is_active !== false) {
                    products.push({ id: docSnap.id, ...data });
                }
            }
        });

        // Cache results
        setCache(dataCache.categoryProducts, cacheKey, products);
        return { success: true, products, count: products.length };
    } catch (err) {
        console.error('firebaseFetchProductsByCategory error', err);
        return { success: false, message: err?.message || String(err), products: [] };
    }
};

// ========== PROFILE UPDATE FUNCTIONS ==========

// Update user profile in Firebase
window.firebaseUpdateProfile = async function (userId, profileData) {
    try {
        console.log('🔥 Updating profile for user:', userId, profileData);
        const userRef = doc(db, 'users', userId);

        // Check if user exists
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            console.error('❌ User not found:', userId);
            return { success: false, message: 'User not found in Firebase' };
        }

        // Build update object
        const updateData = {
            updated_at: serverTimestamp()
        };

        if (profileData.username !== undefined) updateData.username = profileData.username;
        if (profileData.firstName !== undefined) updateData.first_name = profileData.firstName;
        if (profileData.lastName !== undefined) updateData.last_name = profileData.lastName;
        if (profileData.middleName !== undefined) updateData.middle_name = profileData.middleName;
        if (profileData.fullName !== undefined) updateData.full_name = profileData.fullName;
        if (profileData.phoneNumber !== undefined) updateData.phone_number = profileData.phoneNumber;
        if (profileData.additionalEmails !== undefined) updateData.additional_emails = profileData.additionalEmails;
        if (profileData.additionalPhones !== undefined) updateData.additional_phones = profileData.additionalPhones;
        if (profileData.photoUrl !== undefined) updateData.photo_url = profileData.photoUrl;

        await updateDoc(userRef, updateData);
        console.log('✅ Profile updated successfully');

        return { success: true, message: 'Profile updated successfully' };
    } catch (err) {
        console.error('❌ firebaseUpdateProfile error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Upload profile photo to Firebase Storage
window.firebaseUploadProfilePhoto = async function (userId, file) {
    try {
        console.log('🔥 Uploading profile photo for user:', userId);

        if (!file) {
            return { success: false, message: 'No file provided' };
        }

        // Check file size (max 800KB for base64 storage in Firestore)
        if (file.size > 800000) {
            return { success: false, message: 'File too large. Please use an image under 800KB.' };
        }

        // Convert to base64 and store directly in Firestore
        // This avoids Firebase Storage permission issues
        return new Promise(function (resolve) {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const base64Url = e.target.result;
                    console.log('📤 Saving photo to Firestore user document...');

                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, {
                        photo_url: base64Url,
                        updated_at: serverTimestamp()
                    });
                    console.log('✅ Profile photo saved successfully!');

                    resolve({ success: true, photoUrl: base64Url });
                } catch (err) {
                    console.error('❌ Error saving photo:', err);
                    resolve({ success: false, message: err.message || 'Failed to save photo' });
                }
            };
            reader.onerror = function () {
                console.error('❌ FileReader error');
                resolve({ success: false, message: 'Failed to read file' });
            };
            reader.readAsDataURL(file);
        });
    } catch (err) {
        console.error('❌ firebaseUploadProfilePhoto error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get user profile from Firebase (with caching)
window.firebaseGetUserProfile = async function (userId, forceRefresh = false) {
    try {
        // Check cache first
        const cached = dataCache.profiles.get(userId);
        if (!forceRefresh && isCacheValid(cached, CACHE_TTL.PROFILE)) {
            console.log('👤 Using cached profile for:', userId);
            return { success: true, profile: cached.data, cached: true };
        }

        console.log('🔥 Getting profile for user:', userId);
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            return { success: false, message: 'User not found' };
        }

        const profile = snap.data();
        // Cache the profile
        setCache(dataCache.profiles, userId, profile);

        return { success: true, profile };
    } catch (err) {
        console.error('❌ firebaseGetUserProfile error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// ========== MESSAGE DELETE FUNCTION ==========

// Delete a single message
window.firebaseDeleteMessage = async function (conversationId, messageId) {
    try {
        console.log('🔥 Deleting message:', messageId, 'from conversation:', conversationId);

        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
        await deleteDoc(messageRef);

        console.log('✅ Message deleted');
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseDeleteMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Delete entire conversation
window.firebaseDeleteConversation = async function (conversationId) {
    try {
        console.log('🔥 Deleting conversation:', conversationId);

        // Delete messages in batches (to avoid fetching all messages at once)
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        let totalDeleted = 0;
        const batchSize = 200; // delete 200 at a time to reduce read spikes
        while (true) {
            const q = query(messagesCol, limit(batchSize));
            const messagesSnap = await getDocs(q);
            if (!messagesSnap || messagesSnap.size === 0) break;
            const deletePromises = [];
            messagesSnap.forEach(msgDoc => {
                deletePromises.push(deleteDoc(doc(db, 'conversations', conversationId, 'messages', msgDoc.id)));
            });
            await Promise.all(deletePromises);
            totalDeleted += deletePromises.length;
            // If fewer than batchSize were returned, we're done
            if (messagesSnap.size < batchSize) break;
        }
        console.log('✅ Deleted', totalDeleted, 'messages');

        // Then delete the conversation document
        await deleteDoc(doc(db, 'conversations', conversationId));
        console.log('✅ Conversation deleted');

        return { success: true };
    } catch (err) {
        console.error('❌ firebaseDeleteConversation error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// ========== MESSAGE NOTIFICATION FUNCTIONS ==========

// Listen for new messages in real-time (returns unsubscribe function)
let messageUnsubscribers = {};

// Mark conversation as read by user
window.firebaseMarkConversationRead = async function (conversationId, userId) {
    try {
        const conversationRef = doc(db, 'conversations', conversationId);
        const readField = `lastReadBy_${userId}`;
        await updateDoc(conversationRef, {
            [readField]: serverTimestamp()
        });
        console.log('✅ Marked conversation as read:', conversationId);
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseMarkConversationRead error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

window.firebaseListenForNewMessages = function (userId, callback, limitCount = 50) {
    try {
        // Remove existing listeners to prevent duplicates
        if (messageUnsubscribers[userId]) {
            try { if (messageUnsubscribers[userId].buyer) messageUnsubscribers[userId].buyer(); } catch (e) { /**/ }
            try { if (messageUnsubscribers[userId].seller) messageUnsubscribers[userId].seller(); } catch (e) { /**/ }
            delete messageUnsubscribers[userId];
        }
        console.log('🔔 Setting up message listener for user:', userId);

        const conversationsCol = collection(db, 'conversations');

        // Listen for conversations where user is buyer
        const buyerQuery = query(conversationsCol, where('buyerId', '==', userId), orderBy('lastMessageTime', 'desc'), limit(limitCount));
        const unsubBuyer = onSnapshot(buyerQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const conv = { id: change.doc.id, ...change.doc.data() };
                    const readField = `lastReadBy_${userId}`;
                    const lastReadTime = conv[readField]?.seconds || 0;
                    const lastMessageTime = conv.lastMessageTime?.seconds || 0;

                    // Only notify if: message not from user AND message is newer than last read
                    if (conv.lastMessage && conv.lastMessageSenderId !== userId && lastMessageTime > lastReadTime) {
                        callback({
                            type: 'new_message',
                            conversationId: conv.id,
                            senderName: conv.sellerName || 'Someone',
                            message: conv.lastMessage,
                            listingTitle: conv.listingTitle
                        });
                    }
                }
            });
        });

        // Listen for conversations where user is seller
        const sellerQuery = query(conversationsCol, where('sellerId', '==', userId), orderBy('lastMessageTime', 'desc'), limit(limitCount));
        const unsubSeller = onSnapshot(sellerQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const conv = { id: change.doc.id, ...change.doc.data() };
                    const readField = `lastReadBy_${userId}`;
                    const lastReadTime = conv[readField]?.seconds || 0;
                    const lastMessageTime = conv.lastMessageTime?.seconds || 0;

                    // Only notify if: message not from user AND message is newer than last read
                    if (conv.lastMessage && conv.lastMessageSenderId !== userId && lastMessageTime > lastReadTime) {
                        callback({
                            type: 'new_message',
                            conversationId: conv.id,
                            senderName: conv.buyerName || 'Someone',
                            message: conv.lastMessage,
                            listingTitle: conv.listingTitle
                        });
                    }
                }
            });
        });

        // Store unsubscribers
        messageUnsubscribers[userId] = { buyer: unsubBuyer, seller: unsubSeller };

        console.log('✅ Message listener set up');
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseListenForNewMessages error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Stop listening for messages
window.firebaseStopMessageListener = function (userId) {
    if (messageUnsubscribers[userId]) {
        if (messageUnsubscribers[userId].buyer) messageUnsubscribers[userId].buyer();
        if (messageUnsubscribers[userId].seller) messageUnsubscribers[userId].seller();
        delete messageUnsubscribers[userId];
        console.log('🔕 Message listener stopped for user:', userId);
    }
};

// Get unread message count
window.firebaseGetUnreadCount = async function (userId) {
    try {
        // This is a simplified version - in production you'd track read status per message
        const result = await window.firebaseGetUserConversations(userId);
        if (!result.success) return { success: false, count: 0 };

        // Count conversations with recent messages not from user
        let unreadCount = 0;
        for (const conv of result.conversations) {
            if (conv.lastMessageSenderId && conv.lastMessageSenderId !== userId && conv.lastMessage) {
                unreadCount++;
            }
        }

        return { success: true, count: unreadCount };
    } catch (err) {
        console.error('❌ firebaseGetUnreadCount error', err);
        return { success: false, count: 0 };
    }
};

// ========== SAVED PRODUCTS FUNCTIONS ==========
// Uses tbl_saved collection - each user has their own saved products

// Save a product to user's saved list (tbl_saved collection)
window.firebaseSaveProduct = async function (userId, productId, productData) {
    try {
        console.log('💾 Saving product:', productId, 'for user:', userId);
        console.log('📦 Product data:', productData);

        if (!userId || !productId) {
            console.error('❌ Missing userId or productId');
            return { success: false, message: 'Missing userId or productId' };
        }

        // Clear saved cache for this user (will be refreshed on next fetch)
        dataCache.savedProducts.delete(userId);
        dataCache.savedIds.delete(userId);

        // Document ID format: {userId}_{productId} to ensure uniqueness
        const docId = `${userId}_${productId}`;
        console.log('📝 Document ID:', docId);

        const savedData = {
            user_id: userId,
            product_id: productId,
            title: productData.title || '',
            price: typeof productData.price === 'number' ? productData.price : parseFloat(productData.price) || 0,
            imageUrl: productData.imageUrl || '',
            category: productData.category || '',
            condition: productData.condition || '',
            seller_name: productData.sellerName || '',
            seller_username: productData.sellerUsername || '',
            seller_id: productData.sellerId || '',
            saved_at: serverTimestamp()
        };

        console.log('📄 Data to save:', savedData);

        // Try using setDoc with merge option
        const savedRef = doc(db, 'tbl_saved', docId);
        await setDoc(savedRef, savedData, { merge: true });

        // Verify the save worked by reading it back
        const verifySnap = await getDoc(savedRef);
        if (verifySnap.exists()) {
            console.log('✅ Product saved and verified in tbl_saved:', verifySnap.data());
            return { success: true };
        } else {
            // Fallback: Try using addDoc instead
            console.log('⚠️ setDoc may have failed, trying addDoc...');
            const col = collection(db, 'tbl_saved');
            const docRef = await addDoc(col, savedData);
            console.log('✅ Product saved via addDoc with ID:', docRef.id);
            return { success: true };
        }
    } catch (err) {
        console.error('❌ firebaseSaveProduct error:', err);
        console.error('Error code:', err?.code);
        console.error('Error message:', err?.message);
        return { success: false, message: err?.message || String(err) };
    }
};

// Remove a product from user's saved list
window.firebaseUnsaveProduct = async function (userId, productId) {
    try {
        console.log('🗑️ Removing saved product:', productId, 'for user:', userId);

        // Clear saved cache for this user
        dataCache.savedProducts.delete(userId);
        dataCache.savedIds.delete(userId);

        // Try the compound ID first
        const savedRef = doc(db, 'tbl_saved', `${userId}_${productId}`);
        const snap = await getDoc(savedRef);

        if (snap.exists()) {
            await deleteDoc(savedRef);
            console.log('✅ Product removed from tbl_saved (by compound ID)');
            return { success: true };
        }

        // Fallback: Query by user_id and product_id
        const col = collection(db, 'tbl_saved');
        const q = query(col, where('user_id', '==', userId), where('product_id', '==', productId));
        const snaps = await getDocs(q);

        for (const docSnap of snaps.docs) {
            await deleteDoc(doc(db, 'tbl_saved', docSnap.id));
        }

        console.log('✅ Product removed from tbl_saved');
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseUnsaveProduct error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Check if a product is saved by user
window.firebaseIsProductSaved = async function (userId, productId) {
    try {
        // Try compound ID first
        const savedRef = doc(db, 'tbl_saved', `${userId}_${productId}`);
        const snap = await getDoc(savedRef);

        if (snap.exists()) {
            return { success: true, isSaved: true };
        }

        // Fallback: Query by user_id and product_id
        const col = collection(db, 'tbl_saved');
        const q = query(col, where('user_id', '==', userId), where('product_id', '==', productId));
        const snaps = await getDocs(q);

        return { success: true, isSaved: snaps.size > 0 };
    } catch (err) {
        console.error('❌ firebaseIsProductSaved error:', err);
        return { success: false, isSaved: false };
    }
};

// Get all saved products for a specific user (only their own saved items) - with caching
window.firebaseGetSavedProducts = async function (userId, forceRefresh = false, limitCount = 100) {
    try {
        // Check cache first
        const cached = dataCache.savedProducts.get(userId);
        if (!forceRefresh && isCacheValid(cached, CACHE_TTL.SAVED)) {
            console.log('💾 Using cached saved products for:', userId);
            return { success: true, products: cached.data, count: cached.data.length, cached: true };
        }

        console.log('📚 Fetching saved products from tbl_saved for user:', userId);

        const col = collection(db, 'tbl_saved');
        const q = query(col, where('user_id', '==', userId), limit(limitCount));
        const snaps = await getDocs(q);

        const savedProducts = [];
        snaps.forEach((docSnap) => {
            const data = docSnap.data();
            savedProducts.push({
                id: docSnap.id,
                productId: data.product_id,
                title: data.title,
                price: data.price,
                imageUrl: data.imageUrl,
                category: data.category,
                condition: data.condition,
                sellerName: data.seller_name,
                sellerUsername: data.seller_username,
                sellerId: data.seller_id,
                savedAt: data.saved_at,
                ...data
            });
        });

        // Cache the results
        setCache(dataCache.savedProducts, userId, savedProducts);

        console.log('✅ Found', savedProducts.length, 'saved products for user:', userId);
        return { success: true, products: savedProducts, count: savedProducts.length };
    } catch (err) {
        console.error('❌ firebaseGetSavedProducts error', err);
        return { success: false, products: [], message: err?.message || String(err) };
    }
};

// Get saved product IDs for quick lookup (only for current user) - with caching
window.firebaseGetSavedProductIds = async function (userId, forceRefresh = false, limitCount = 100) {
    try {
        // Check cache first
        const cached = dataCache.savedIds.get(userId);
        if (!forceRefresh && isCacheValid(cached, CACHE_TTL.SAVED)) {
            console.log('💾 Using cached saved IDs for:', userId);
            return { success: true, savedIds: cached.data, cached: true };
        }

        const col = collection(db, 'tbl_saved');
        const q = query(col, where('user_id', '==', userId), limit(limitCount));
        const snaps = await getDocs(q);

        const savedIds = [];
        snaps.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.product_id) savedIds.push(data.product_id);
        });

        // Cache the results
        setCache(dataCache.savedIds, userId, savedIds);

        console.log('✅ Found', savedIds.length, 'saved product IDs for user:', userId);
        return { success: true, savedIds };
    } catch (err) {
        console.error('❌ firebaseGetSavedProductIds error', err);
        return { success: false, savedIds: [] };
    }
};

// Toggle save/unsave product
window.firebaseToggleSaveProduct = async function (userId, productId, productData) {
    try {
        const checkResult = await window.firebaseIsProductSaved(userId, productId);

        if (checkResult.isSaved) {
            await window.firebaseUnsaveProduct(userId, productId);
            return { success: true, isSaved: false };
        } else {
            await window.firebaseSaveProduct(userId, productId, productData);
            return { success: true, isSaved: true };
        }
    } catch (err) {
        console.error('❌ firebaseToggleSaveProduct error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Alias for backward compatibility
window.firebaseFetchSavedProducts = window.firebaseGetSavedProducts;

// ========== USER REVIEWS FUNCTIONS ==========

// Add a review for a seller (buyers and sellers can add reviews) with optional multiple images and video
window.firebaseAddReview = async function (reviewData) {
    try {
        const { sellerId, sellerName, buyerId, buyerName, buyerUsername, rating, comment, image, images, video } = reviewData;

        if (!sellerId || !buyerId || !rating) {
            throw new Error('Missing required fields: sellerId, buyerId, rating');
        }

        const reviewDoc = {
            seller_id: sellerId,
            seller_name: sellerName || '',
            buyer_id: buyerId,
            buyer_name: buyerName || '',
            buyer_username: buyerUsername || '',
            rating: parseInt(rating),
            comment: comment || '',
            // media
            image: image || '',              // backward compatibility
            images: Array.isArray(images) ? images : [],
            video: video || '',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'user_reviews'), reviewDoc);
        console.log('✅ Review added with ID:', docRef.id);

        return { success: true, reviewId: docRef.id };
    } catch (err) {
        console.error('❌ firebaseAddReview error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get all reviews for a specific seller
window.firebaseGetSellerReviews = async function (sellerId) {
    try {
        if (!sellerId) {
            throw new Error('Seller ID is required');
        }

        const col = collection(db, 'user_reviews');
        const q = query(col, where('seller_id', '==', sellerId));
        const snapshot = await getDocs(q);

        const reviews = [];
        snapshot.forEach(doc => {
            reviews.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by created_at descending (newest first)
        reviews.sort((a, b) => {
            const aTime = a.created_at?.seconds || 0;
            const bTime = b.created_at?.seconds || 0;
            return bTime - aTime;
        });

        console.log('✅ Found', reviews.length, 'reviews for seller:', sellerId);
        return { success: true, reviews, count: reviews.length };
    } catch (err) {
        console.error('❌ firebaseGetSellerReviews error', err);
        return { success: false, reviews: [], message: err?.message || String(err) };
    }
};

// Delete a review (only the buyer who created it can delete)
window.firebaseDeleteReview = async function (reviewId, buyerId) {
    try {
        if (!reviewId || !buyerId) {
            throw new Error('Review ID and Buyer ID are required');
        }

        // First check if the review belongs to this buyer
        const reviewRef = doc(db, 'user_reviews', reviewId);
        const reviewSnap = await getDoc(reviewRef);

        if (!reviewSnap.exists()) {
            throw new Error('Review not found');
        }

        const reviewData = reviewSnap.data();
        if (reviewData.buyer_id !== buyerId) {
            throw new Error('You can only delete your own reviews');
        }

        await deleteDoc(reviewRef);
        console.log('✅ Review deleted:', reviewId);

        return { success: true };
    } catch (err) {
        console.error('❌ firebaseDeleteReview error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Update a review (only the buyer who created it can update)
window.firebaseUpdateReview = async function (reviewId, buyerId, updates) {
    try {
        if (!reviewId || !buyerId) {
            throw new Error('Review ID and Buyer ID are required');
        }

        // First check if the review belongs to this buyer
        const reviewRef = doc(db, 'user_reviews', reviewId);
        const reviewSnap = await getDoc(reviewRef);

        if (!reviewSnap.exists()) {
            throw new Error('Review not found');
        }

        const reviewData = reviewSnap.data();
        if (reviewData.buyer_id !== buyerId) {
            throw new Error('You can only update your own reviews');
        }

        const updateData = {
            ...updates,
            updated_at: serverTimestamp()
        };

        await updateDoc(reviewRef, updateData);
        console.log('✅ Review updated:', reviewId);

        return { success: true };
    } catch (err) {
        console.error('❌ firebaseUpdateReview error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// ========== ADMIN DASHBOARD FUNCTIONS ==========

// Get dashboard statistics (total users, items, disabled users, reports, messages)
window.firebaseGetAdminDashboardStats = async function () {
    try {
        console.log('📊 Fetching admin dashboard stats...');

        const stats = {
            totalUsers: 0,
            totalItems: 0,
            totalDisabledUsers: 0,
            totalReports: 0,
            totalMessages: 0
        };

        // Get total users count
        try {
            const usersCol = collection(db, 'users');
            const usersSnap = await getDocs(query(usersCol, limit(1000)));
            stats.totalUsers = usersSnap.size;

            // Count disabled users
            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.isEnabled === false) {
                    stats.totalDisabledUsers++;
                }
            });
            console.log('✅ Users stats loaded:', { totalUsers: stats.totalUsers, totalDisabledUsers: stats.totalDisabledUsers });
        } catch (err) {
            console.error('⚠️ Error fetching users stats:', err);
        }

        // Get total listings count (all items in tbl_listing)
        try {
            const listingsCol = collection(db, 'tbl_listing');
            const listingsSnap = await getDocs(query(listingsCol, limit(1000)));

            // Count ALL items in tbl_listing collection
            stats.totalItems = listingsSnap.size;
            console.log('✅ Listings stats loaded:', { totalItems: stats.totalItems, totalDocs: listingsSnap.size });
        } catch (err) {
            console.error('⚠️ Error fetching listings stats:', err);
        }

        // Get total reports count
        try {
            const reportsCol = collection(db, 'reports');
            const reportsSnap = await getDocs(query(reportsCol, limit(1000)));
            stats.totalReports = reportsSnap.size;
            console.log('✅ Reports stats loaded:', { totalReports: stats.totalReports });
        } catch (err) {
            console.error('⚠️ Error fetching reports stats:', err);
        }

        // Get total admin messages count
        try {
            const adminMsgsCol = collection(db, 'admin_messages');
            const adminMsgsSnap = await getDocs(query(adminMsgsCol, limit(1000)));
            stats.totalMessages = adminMsgsSnap.size;
            console.log('✅ Admin messages stats loaded:', { totalMessages: stats.totalMessages });
        } catch (err) {
            console.error('⚠️ Error fetching admin messages stats:', err);
        }

        console.log('✅ Admin dashboard stats loaded:', stats);
        return { success: true, stats };
    } catch (err) {
        console.error('❌ firebaseGetAdminDashboardStats error:', err);
        return { success: false, message: err?.message || String(err), stats: {} };
    }
};

// Get recent users (5 most recently registered)
window.firebaseGetRecentUsers = async function (limitCount = 5) {
    try {
        console.log('👥 Fetching recent users...');

        const usersCol = collection(db, 'users');
        const q = query(usersCol, orderBy('date_created', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                id: doc.id,
                name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.username || 'Unknown',
                email: data.email || 'N/A',
                joinDate: data.date_created,
                status: data.isEnabled === false ? 'disabled' : 'active',
                accountType: data.account_type || 'buyer',
                ...data
            });
        });

        console.log('✅ Found', users.length, 'recent users');
        return { success: true, users };
    } catch (err) {
        console.error('❌ firebaseGetRecentUsers error:', err);
        return { success: false, users: [], message: err?.message || String(err) };
    }
};

// Get recent listings (5 most recently created items)
window.firebaseGetRecentListings = async function (limitCount = 5) {
    try {
        console.log('📦 Fetching recent listings...');

        const listingsCol = collection(db, 'tbl_listing');
        const q = query(listingsCol, orderBy('date_created', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const listings = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            listings.push({
                id: doc.id,
                title: data.title || 'Untitled',
                price: data.price || 0,
                status: data.status || 'active',
                category: data.category || 'Uncategorized',
                imageUrl: data.imageUrl || '',
                seller_name: data.seller_name || 'Unknown',
                date_created: data.date_created,
                ...data
            });
        });

        console.log('✅ Found', listings.length, 'recent listings');
        return { success: true, listings };
    } catch (err) {
        console.error('❌ firebaseGetRecentListings error:', err);
        return { success: false, listings: [], message: err?.message || String(err) };
    }
};

// Get all reports for admin (all user reports)
window.firebaseGetAllReports = async function (limitCount = 100) {
    try {
        console.log('📋 Fetching all reports...');

        const reportsCol = collection(db, 'reports');
        const q = query(reportsCol, orderBy('created_at', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const reports = [];
        snapshot.forEach(doc => {
            reports.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log('✅ Found', reports.length, 'reports');
        return { success: true, reports, count: reports.length };
    } catch (err) {
        console.error('❌ firebaseGetAllReports error:', err);
        return { success: false, reports: [], message: err?.message || String(err) };
    }
};

// ========== ADMIN MESSAGING FUNCTIONS ==========

// Send message to admin (from buyer/seller)
window.firebaseSendAdminMessage = async function (userId, userName, userEmail, subject, message) {
    try {
        console.log('📧 Sending message to admin from:', userId);

        const adminMsgsCol = collection(db, 'admin_messages');
        const msgData = {
            user_id: userId,
            user_name: userName || 'Unknown',
            user_email: userEmail || '',
            subject: subject || 'No Subject',
            message: message,
            status: 'unread',
            created_at: serverTimestamp(),
            replies: []
        };

        const docRef = await addDoc(adminMsgsCol, msgData);
        console.log('✅ Admin message sent with ID:', docRef.id);

        return { success: true, messageId: docRef.id };
    } catch (err) {
        console.error('❌ firebaseSendAdminMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get all admin messages (for admin view)
window.firebaseGetAllAdminMessages = async function (limitCount = 100) {
    try {
        console.log('📬 Fetching all admin messages...');

        const adminMsgsCol = collection(db, 'admin_messages');
        const q = query(adminMsgsCol, orderBy('created_at', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const messages = [];
        snapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log('✅ Found', messages.length, 'admin messages');
        return { success: true, messages, count: messages.length };
    } catch (err) {
        console.error('❌ firebaseGetAllAdminMessages error:', err);
        return { success: false, messages: [], message: err?.message || String(err) };
    }
};

// Get user's messages to admin (for user view)
window.firebaseGetUserAdminMessages = async function (userId, limitCount = 50) {
    try {
        console.log('📬 Fetching admin messages for user:', userId);

        const adminMsgsCol = collection(db, 'admin_messages');
        const q = query(adminMsgsCol, where('user_id', '==', userId), orderBy('created_at', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const messages = [];
        snapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log('✅ Found', messages.length, 'admin messages for user');
        return { success: true, messages };
    } catch (err) {
        console.error('❌ firebaseGetUserAdminMessages error:', err);
        return { success: false, messages: [], message: err?.message || String(err) };
    }
};

// Admin reply to user message
window.firebaseAdminReplyMessage = async function (messageId, replyText) {
    try {
        console.log('💬 Admin replying to message:', messageId);

        const msgRef = doc(db, 'admin_messages', messageId);
        const msgSnap = await getDoc(msgRef);

        if (!msgSnap.exists()) {
            return { success: false, message: 'Message not found' };
        }

        const currentData = msgSnap.data();
        const replies = currentData.replies || [];

        replies.push({
            from: 'admin',
            text: replyText,
            timestamp: new Date().toISOString()
        });

        await updateDoc(msgRef, {
            replies: replies,
            status: 'replied',
            updated_at: serverTimestamp()
        });

        console.log('✅ Admin reply added');
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseAdminReplyMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// User reply to admin message thread
window.firebaseUserReplyAdminMessage = async function (messageId, userId, replyText) {
    try {
        console.log('💬 User replying to admin message:', messageId);

        const msgRef = doc(db, 'admin_messages', messageId);
        const msgSnap = await getDoc(msgRef);

        if (!msgSnap.exists()) {
            return { success: false, message: 'Message not found' };
        }

        const currentData = msgSnap.data();

        // Verify this message belongs to the user
        if (currentData.user_id !== userId) {
            return { success: false, message: 'Unauthorized' };
        }

        const replies = currentData.replies || [];

        replies.push({
            from: 'user',
            text: replyText,
            timestamp: new Date().toISOString()
        });

        await updateDoc(msgRef, {
            replies: replies,
            status: 'unread', // Mark as unread for admin
            updated_at: serverTimestamp()
        });

        console.log('✅ User reply added');
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseUserReplyAdminMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Mark admin message as read
window.firebaseMarkAdminMessageRead = async function (messageId) {
    try {
        const msgRef = doc(db, 'admin_messages', messageId);
        await updateDoc(msgRef, {
            status: 'read',
            read_at: serverTimestamp()
        });
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseMarkAdminMessageRead error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get unread admin messages count (for notifications)
window.firebaseGetUnreadAdminMessagesCount = async function () {
    try {
        const adminMsgsCol = collection(db, 'admin_messages');
        const q = query(adminMsgsCol, where('status', '==', 'unread'), limit(100));
        const snapshot = await getDocs(q);

        return { success: true, count: snapshot.size };
    } catch (err) {
        console.error('❌ firebaseGetUnreadAdminMessagesCount error:', err);
        return { success: false, count: 0 };
    }
};

// ========== USER MANAGEMENT FUNCTIONS (Admin) ==========

// Disable user (set isEnabled = false)
window.firebaseDisableUser = async function (userId) {
    try {
        console.log('🚫 Disabling user:', userId);

        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            isEnabled: false,
            disabled_at: serverTimestamp()
        });

        console.log('✅ User disabled:', userId);
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseDisableUser error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Enable user (set isEnabled = true)
window.firebaseEnableUser = async function (userId) {
    try {
        console.log('✅ Enabling user:', userId);

        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            isEnabled: true,
            enabled_at: serverTimestamp()
        });

        console.log('✅ User enabled:', userId);
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseEnableUser error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Delete user from Firestore (NOT Firebase Auth)
window.firebaseDeleteUserFromFirestore = async function (userId) {
    try {
        console.log('🗑️ Deleting user from Firestore:', userId);

        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);

        console.log('✅ User deleted from Firestore:', userId);
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseDeleteUserFromFirestore error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Check if user exists in Firestore (for login validation)
window.firebaseCheckUserExists = async function (userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);

        return { success: true, exists: snap.exists() };
    } catch (err) {
        console.error('❌ firebaseCheckUserExists error:', err);
        return { success: false, exists: false };
    }
};

// Check if user is enabled (for login validation)
window.firebaseCheckUserEnabled = async function (userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            return { success: false, enabled: false, reason: 'deleted' };
        }

        const data = snap.data();
        const isEnabled = data.isEnabled !== false; // Default to true if not set

        return {
            success: true,
            enabled: isEnabled,
            reason: isEnabled ? null : 'disabled',
            profile: data
        };
    } catch (err) {
        console.error('❌ firebaseCheckUserEnabled error:', err);
        return { success: false, enabled: false, reason: 'error' };
    }
};

// Get all users for admin (with isEnabled status)
window.firebaseGetAllUsers = async function (limitCount = 200) {
    try {
        console.log('👥 Fetching all users for admin...');

        const usersCol = collection(db, 'users');
        const q = query(usersCol, orderBy('date_created', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                id: doc.id,
                name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.username || 'Unknown',
                email: data.email || 'N/A',
                username: data.username || '',
                accountType: data.account_type || 'buyer',
                isEnabled: data.isEnabled !== false,
                date_created: data.date_created,
                ...data
            });
        });

        console.log('✅ Found', users.length, 'users');
        return { success: true, users };
    } catch (err) {
        console.error('❌ firebaseGetAllUsers error:', err);
        return { success: false, users: [], message: err?.message || String(err) };
    }
};

// ========== SELLER REPORTS / ANALYTICS ==========
// Fetch all sold items with details for reports and analytics
window.firebaseGetSellerReports = async function (sellerId, startDate = null, endDate = null, limitCount = 1000) {
    try {
        if (!sellerId) {
            throw new Error('Seller ID is required');
        }

        console.log('📊 Fetching reports for seller:', sellerId);

        // Query the reports collection - fetch by seller_id only (avoid composite index requirement)
        const reportsCol = collection(db, 'reports');
        let q;
        // Default to last 12 months if dates not provided to limit reads
        const now = new Date();
        if (!startDate && !endDate) {
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            startDate = oneYearAgo;
            endDate = now;
        }
        // To avoid composite index requirements, query only by seller_id and perform
        // date filtering client-side. This avoids Firestore index errors and keeps
        // the client functional without requiring manual index creation.
        q = query(reportsCol, where('seller_id', '==', sellerId), limit(limitCount));
        const snapshot = await getDocs(q);

        const reports = [];
        snapshot.forEach(doc => {
            reports.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Filter by date range if provided (client-side) and sort by sold_date descending
        const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
        const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
        let filteredReports = reports;
        if (start || end) {
            filteredReports = reports.filter(r => {
                const d = r.sold_date && r.sold_date.seconds ? new Date(r.sold_date.seconds * 1000) : (r.sold_date ? new Date(r.sold_date) : null);
                if (!d) return false;
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            });
        }
        // Now sort the filtered results
        filteredReports.sort((a, b) => {
            const dateA = a.sold_date?.seconds || 0;
            const dateB = b.sold_date?.seconds || 0;
            return dateB - dateA;
        });

        console.log('✅ Found', filteredReports.length, 'reports for seller:', sellerId, '(client-filtered from', reports.length, 'fetched)');

        return { success: true, reports: filteredReports, count: filteredReports.length };
    } catch (err) {
        console.error('❌ firebaseGetSellerReports error:', err);
        return { success: false, reports: [], message: err?.message || String(err) };
    }
};

// Fetch and aggregate sold items for analytics
// ADMIN VERSION: Get sales analytics for ALL sellers (aggregated platform-wide)
window.firebaseGetAllSalesAnalytics = async function (startDate = null, endDate = null, limitCount = 5000) {
    try {
        console.log('📈 Generating platform-wide sales analytics (ALL sellers)');

        // Get all SOLD items from tbl_listing across all sellers
        const listingsCol = collection(db, 'tbl_listing');

        // Default to last 12 months if no date range provided
        const now = new Date();
        if (!startDate && !endDate) {
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            startDate = oneYearAgo;
            endDate = now;
        }

        // Query all listings with status='sold' to minimize fetching
        // We use status filter only to avoid massive data pulls
        const q = query(listingsCol, where('status', '==', 'sold'), limit(limitCount));
        const snapshot = await getDocs(q);

        const soldItems = [];
        snapshot.forEach(doc => {
            soldItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Filter by date range client-side
        const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
        const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
        const filteredItems = soldItems.filter(it => {
            const d = it.sold_date && it.sold_date.seconds ? new Date(it.sold_date.seconds * 1000) : (it.sold_date ? new Date(it.sold_date) : null);
            if (!d) return true; // Include items without date for aggregate stats
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });

        console.log('📊 Fetched', soldItems.length, 'sold items, filtered to', filteredItems.length);

        if (filteredItems.length === 0) {
            return {
                success: true,
                analytics: {
                    totalSales: 0,
                    totalRevenue: 0,
                    totalQuantity: 0,
                    uniqueSellers: 0,
                    itemsSold: {},
                    byCategory: {},
                    bySeller: {},
                    byDate: {},
                    dailySales: {},
                    rawItems: []
                }
            };
        }

        // Initialize analytics data
        const analytics = {
            totalSales: 0,
            totalRevenue: 0,
            totalQuantity: 0,
            uniqueSellers: new Set(),
            itemsSold: {},
            byCategory: {},
            bySeller: {},
            byDate: {},
            dailySales: {},
            rawItems: []
        };

        // Process each sold item
        filteredItems.forEach(item => {
            // Parse the date
            let dateStr = null;
            let dateObj = null;

            const dateField = item.sold_date || item.date_sold || item.updated_at || item.created_at;
            if (dateField) {
                try {
                    if (dateField.seconds) {
                        dateObj = new Date(dateField.seconds * 1000);
                    } else if (typeof dateField === 'string') {
                        dateObj = new Date(dateField);
                    } else if (dateField instanceof Date) {
                        dateObj = dateField;
                    }
                    if (dateObj && !isNaN(dateObj.getTime())) {
                        dateStr = dateObj.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.warn('Could not parse date:', dateField);
                }
            }

            // Basic totals
            analytics.totalSales++;
            const price = parseFloat(item.price) || parseFloat(item.Price) || 0;
            analytics.totalRevenue += price;
            analytics.totalQuantity += 1;

            // Track unique sellers
            const sellerId = item.user_id || item.seller_id || 'unknown';
            analytics.uniqueSellers.add(sellerId);

            // Store raw item for detailed table
            const itemName = item.title || item.Title || 'Unknown';
            const category = item.category || item.Category || 'Uncategorized';
            const sellerName = item.seller_name || item.user_name || sellerId;

            analytics.rawItems.push({
                id: item.id,
                title: itemName,
                category: category,
                seller: sellerName,
                sellerId: sellerId,
                quantity: 1,
                price: price,
                total: price,
                date: dateStr,
                dateObj: dateObj
            });

            // Items sold
            if (!analytics.itemsSold[itemName]) {
                analytics.itemsSold[itemName] = {
                    quantity: 0,
                    revenue: 0,
                    category: category
                };
            }
            analytics.itemsSold[itemName].quantity += 1;
            analytics.itemsSold[itemName].revenue += price;

            // By category
            if (!analytics.byCategory[category]) {
                analytics.byCategory[category] = {
                    count: 0,
                    revenue: 0,
                    quantity: 0
                };
            }
            analytics.byCategory[category].count++;
            analytics.byCategory[category].revenue += price;
            analytics.byCategory[category].quantity += 1;

            // By seller
            if (!analytics.bySeller[sellerName]) {
                analytics.bySeller[sellerName] = {
                    count: 0,
                    revenue: 0,
                    sellerId: sellerId
                };
            }
            analytics.bySeller[sellerName].count++;
            analytics.bySeller[sellerName].revenue += price;

            // By date
            const dateKey = dateStr || 'Unknown';
            if (!analytics.byDate[dateKey]) {
                analytics.byDate[dateKey] = {
                    count: 0,
                    revenue: 0,
                    quantity: 0
                };
            }
            analytics.byDate[dateKey].count++;
            analytics.byDate[dateKey].revenue += price;
            analytics.byDate[dateKey].quantity += 1;

            // Daily sales
            if (!analytics.dailySales[dateKey]) {
                analytics.dailySales[dateKey] = 0;
            }
            analytics.dailySales[dateKey] += price;
        });

        // Convert uniqueSellers Set to count
        analytics.uniqueSellers = analytics.uniqueSellers.size;

        // Sort rawItems by date descending
        analytics.rawItems.sort((a, b) => {
            if (!a.dateObj && !b.dateObj) return 0;
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj - a.dateObj;
        });

        console.log('✅ Platform-wide analytics generated:', analytics);
        return { success: true, analytics };
    } catch (err) {
        console.error('❌ firebaseGetAllSalesAnalytics error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// SELLER VERSION: Get sales analytics for a specific seller
window.firebaseGetSalesAnalytics = async function (sellerId, startDate = null, endDate = null, limitCount = 2000) {
    try {
        if (!sellerId) {
            throw new Error('Seller ID is required');
        }

        console.log('📈 Generating sales analytics for seller:', sellerId);

        // Get all SOLD items from tbl_listing (History) instead of reports collection
        // This pulls from the actual sold items in the system
        const listingsCol = collection(db, 'tbl_listing');
        // Default to last 12 months if no date range provided to minimize reads
        const now = new Date();
        if (!startDate && !endDate) {
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            startDate = oneYearAgo;
            endDate = now;
        }
        // To avoid composite index errors, query by user_id only and filter by
        // status/date client-side. This avoids requiring a composite index in
        // Firestore while still allowing the app to fetch analytics.
        const q = query(listingsCol, where('user_id', '==', sellerId), limit(limitCount));
        const snapshot = await getDocs(q);

        const soldItems = [];
        snapshot.forEach(doc => {
            soldItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Now filter the fetched items for status='sold' and the requested date range
        const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
        const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
        const filteredItems = soldItems.filter(it => {
            if (!it || it.status !== 'sold') return false;
            const d = it.sold_date && it.sold_date.seconds ? new Date(it.sold_date.seconds * 1000) : (it.sold_date ? new Date(it.sold_date) : null);
            if (!d) return false;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });
        console.log('📊 Fetched', soldItems.length, 'items and filtered to', filteredItems.length, 'sold items for seller:', sellerId);

        if (soldItems.length === 0) {
            return {
                success: true,
                analytics: {
                    totalSales: 0,
                    totalRevenue: 0,
                    totalQuantity: 0,
                    itemsSold: {},
                    byCategory: {},
                    byDate: {},
                    dailySales: {},
                    rawItems: [] // Include raw items for detailed table
                }
            };
        }

        const reports = filteredItems;

        // Initialize analytics data
        const analytics = {
            totalSales: 0,
            totalRevenue: 0,
            totalQuantity: 0,
            itemsSold: {},
            byCategory: {},
            byDate: {},
            dailySales: {},
            rawItems: [] // Store raw items with dates for detailed report
        };

        // Process each sold item from tbl_listing
        reports.forEach(report => {
            // Parse the date first
            let dateStr = null;
            let dateObj = null;

            // Try multiple date fields
            const dateField = report.sold_date || report.date_sold || report.updated_at || report.created_at;
            if (dateField) {
                try {
                    if (dateField.seconds) {
                        // Firestore timestamp
                        dateObj = new Date(dateField.seconds * 1000);
                    } else if (typeof dateField === 'string') {
                        // Date string
                        dateObj = new Date(dateField);
                    } else if (dateField instanceof Date) {
                        dateObj = dateField;
                    }
                    if (dateObj && !isNaN(dateObj.getTime())) {
                        dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
                    }
                } catch (e) {
                    console.warn('Could not parse date:', dateField);
                }
            }

            // Basic totals - use tbl_listing field names
            analytics.totalSales++;
            const price = parseFloat(report.price) || parseFloat(report.Price) || 0;
            analytics.totalRevenue += price;
            analytics.totalQuantity += 1; // Each sold item counts as 1 unit

            // Store raw item for detailed table
            const itemName = report.title || report.Title || 'Unknown';
            const category = report.category || report.Category || 'Uncategorized';

            analytics.rawItems.push({
                id: report.id,
                title: itemName,
                category: category,
                quantity: 1,
                price: price,
                total: price,
                date: dateStr,
                dateObj: dateObj
            });

            // Items purchased
            if (!analytics.itemsSold[itemName]) {
                analytics.itemsSold[itemName] = {
                    quantity: 0,
                    revenue: 0,
                    category: category
                };
            }
            analytics.itemsSold[itemName].quantity += 1;
            analytics.itemsSold[itemName].revenue += price;

            // By category
            if (!analytics.byCategory[category]) {
                analytics.byCategory[category] = {
                    count: 0,
                    revenue: 0,
                    quantity: 0
                };
            }
            analytics.byCategory[category].count++;
            analytics.byCategory[category].revenue += price;
            analytics.byCategory[category].quantity += 1;

            // By date
            const dateKey = dateStr || 'Unknown';
            if (!analytics.byDate[dateKey]) {
                analytics.byDate[dateKey] = {
                    count: 0,
                    revenue: 0,
                    quantity: 0
                };
            }
            analytics.byDate[dateKey].count++;
            analytics.byDate[dateKey].revenue += price;
            analytics.byDate[dateKey].quantity += 1;

            // Daily sales (alternative format)
            if (!analytics.dailySales[dateKey]) {
                analytics.dailySales[dateKey] = 0;
            }
            analytics.dailySales[dateKey] += price;
        });

        // Sort rawItems by date descending (newest first)
        analytics.rawItems.sort((a, b) => {
            if (!a.dateObj && !b.dateObj) return 0;
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj - a.dateObj;
        });

        console.log('✅ Analytics generated:', analytics);
        return { success: true, analytics };
    } catch (err) {
        console.error('❌ firebaseGetSalesAnalytics error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// ========== ADMIN MESSAGING & USER SAFETY FUNCTIONS ==========

// Update user profile (Admin function)
window.firebaseUpdateUser = async function (userId, updateData) {
    try {
        console.log('Updating user:', userId, updateData);
        const userRef = doc(db, 'users', userId);

        // Add updated_at timestamp
        const dataToUpdate = {
            ...updateData,
            updated_at: serverTimestamp()
        };

        await updateDoc(userRef, dataToUpdate);
        console.log('✅ User updated successfully');
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseUpdateUser error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Send a message to admin (or report a user)
window.firebaseSendAdminMessage = async function (userId, userName, userEmail, subject, message) {
    try {
        if (!userId || !subject || !message) throw new Error('Missing required fields');

        const msgData = {
            user_id: userId,
            user_name: userName || 'Anonymous',
            user_email: userEmail || '',
            subject: subject,
            message: message,
            status: 'pending', // pending, read, replied
            created_at: serverTimestamp(),
            replies: []
        };

        const docRef = await addDoc(collection(db, 'admin_messages'), msgData);
        console.log('✅ Admin message sent:', docRef.id);
        return { success: true, messageId: docRef.id };
    } catch (err) {
        console.error('❌ firebaseSendAdminMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get messages for a specific user
// Get messages for a specific user
window.firebaseGetUserAdminMessages = async function (userId) {
    try {
        console.log('Fetching admin messages for user:', userId);
        let messages = [];

        try {
            // Try primary query with sort
            const q = query(collection(db, 'admin_messages'), where('user_id', '==', userId), orderBy('created_at', 'desc'));
            const snaps = await getDocs(q);
            snaps.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
        } catch (indexError) {
            console.warn('Primary admin message query failed (likely missing index), falling back to client-side sort:', indexError);

            // Fallback: Query without sort
            const qFallback = query(collection(db, 'admin_messages'), where('user_id', '==', userId));
            const snaps = await getDocs(qFallback);
            snaps.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));

            // Sort in memory
            messages.sort((a, b) => {
                const timeA = a.created_at?.seconds || 0;
                const timeB = b.created_at?.seconds || 0;
                return timeB - timeA;
            });
        }

        console.log(`Found ${messages.length} admin messages`);
        return { success: true, messages };
    } catch (err) {
        console.error('❌ firebaseGetUserAdminMessages error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get ALL admin messages (for Admin Dashboard)
window.firebaseGetAllAdminMessages = async function () {
    try {
        const q = query(collection(db, 'admin_messages'), orderBy('created_at', 'desc'));
        const snaps = await getDocs(q);
        const messages = [];
        snaps.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
        return { success: true, messages };
    } catch (err) {
        console.error('❌ firebaseGetAllAdminMessages error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Reply to an admin message (by user)
window.firebaseUserReplyAdminMessage = async function (messageId, userId, text) {
    try {
        const msgRef = doc(db, 'admin_messages', messageId);
        const snap = await getDoc(msgRef);

        if (!snap.exists()) throw new Error('Message not found');
        if (snap.data().user_id !== userId) throw new Error('Unauthorized');

        const reply = {
            from: 'user',
            text: text,
            timestamp: Date.now() // Use client timestamp for array or serverTimestamp if complex
        };

        await updateDoc(msgRef, {
            replies: arrayUnion(reply),
            status: 'pending' // Re-open status if user replies?
        });
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseUserReplyAdminMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Reply to message (Admin side)
window.firebaseAdminReplyMessage = async function (messageId, text) {
    try {
        const msgRef = doc(db, 'admin_messages', messageId);
        const reply = {
            from: 'admin',
            text: text,
            timestamp: Date.now()
        };

        await updateDoc(msgRef, {
            replies: arrayUnion(reply),
            status: 'replied'
        });

        return { success: true };
    } catch (err) {
        console.error('❌ firebaseAdminReplyMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Mark admin message as read
window.firebaseMarkAdminMessageRead = async function (messageId) {
    try {
        await updateDoc(doc(db, 'admin_messages', messageId), {
            status: 'read'
        });
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseMarkAdminMessageRead error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get unread admin messages count
window.firebaseGetUnreadAdminMessagesCount = async function () {
    try {
        const q = query(collection(db, 'admin_messages'), where('status', '==', 'pending'));
        const snap = await getCountFromServer(q);
        return { success: true, count: snap.data().count };
    } catch (err) {
        console.error('❌ firebaseGetUnreadAdminMessagesCount error:', err);
        try {
            const q = query(collection(db, 'admin_messages'), where('status', '==', 'pending'));
            const snap = await getDocs(q);
            return { success: true, count: snap.size };
        } catch (e) {
            return { success: false, message: err?.message };
        }
    }
};

// Block a user
window.firebaseBlockUser = async function (blockerId, blockedId) {
    try {
        const blockId = `${blockerId}_${blockedId}`;
        await setDoc(doc(db, 'user_blocks', blockId), {
            blocker_id: blockerId,
            blocked_id: blockedId,
            created_at: serverTimestamp()
        });
        console.log('✅ User blocked:', blockedId);
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseBlockUser error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Check if a user is blocked (returns true if allowed to chat, false if blocked)
window.firebaseCheckVerifyBlock = async function (senderId, recipientId) {
    try {
        // Check if I blocked them
        const myBlock = await getDoc(doc(db, 'user_blocks', `${senderId}_${recipientId}`));
        if (myBlock.exists()) return { allowed: false, reason: 'You blocked this user.' };

        // Check if they blocked me
        const theirBlock = await getDoc(doc(db, 'user_blocks', `${recipientId}_${senderId}`));
        if (theirBlock.exists()) return { allowed: false, reason: 'You have been blocked by this user.' };

        return { allowed: true };
    } catch (err) {
        console.warn('⚠️ Block check failed, assuming allowed:', err);
        return { allowed: true };
    }
};

// Delete a conversation (Hides it for the user)
window.firebaseDeleteConversation = async function (conversationId) {
    try {
        // NOTE: Real deletion requires deleting subcollections which is hard client-side.
        // For now, we delete the conversation document. Messages remain orphaned.
        if (!conversationId) throw new Error('Conversation ID missing');

        await deleteDoc(doc(db, 'conversations', conversationId));
        console.log('✅ Conversation deleted:', conversationId);
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseDeleteConversation error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Wrapper for Reporting User specifically
window.firebaseReportUser = async function (reporterId, reporterName, reportedId, reason, description) {
    try {
        // Fetch the reported user's profile to get their username
        let reportedUsername = reportedId; // Fallback to ID if username not found
        try {
            const userDoc = await getDoc(doc(db, 'users', reportedId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                reportedUsername = userData.username || userData.email?.split('@')[0] || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || reportedId;
            }
        } catch (err) {
            console.warn('Could not fetch reported user profile, using ID:', err);
        }

        // Use username in subject and body for readability
        const subject = `[REPORT] User ${reportedUsername} - ${reason}`;
        const body = `Reported User: ${reportedUsername}\nReported User ID: ${reportedId}\nReason: ${reason}\n\nDetails:\n${description}`;

        // Send the message with the reported_user_id field for backend functionality
        const result = await window.firebaseSendAdminMessage(reporterId, reporterName, '', subject, body);

        // Add the reported_user_id to the message document for reference
        if (result.success && result.messageId) {
            try {
                await updateDoc(doc(db, 'admin_messages', result.messageId), {
                    reported_user_id: reportedId,
                    reported_username: reportedUsername
                });
            } catch (err) {
                console.warn('Could not add reported_user_id field:', err);
            }
        }

        return result;
    } catch (err) {
        console.error('❌ firebaseReportUser error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// ========== USER REVIEWS FUNCTIONS ==========

// Add a review for a seller
window.firebaseAddReview = async function (payload) {
    try {
        console.log('Adding review:', payload);

        if (!payload.sellerId || !payload.buyerId || !payload.rating || !payload.comment) {
            throw new Error('Missing required fields: sellerId, buyerId, rating, comment');
        }

        const reviewData = {
            seller_id: payload.sellerId,
            seller_name: payload.sellerName || '',
            buyer_id: payload.buyerId,
            buyer_name: payload.buyerName || '',
            buyer_username: payload.buyerUsername || '',
            rating: parseInt(payload.rating),
            comment: payload.comment,
            images: payload.images || [],
            video: payload.video || '',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'user_reviews'), reviewData);
        console.log('✅ Review added successfully:', docRef.id);
        return { success: true, reviewId: docRef.id };
    } catch (err) {
        console.error('❌ firebaseAddReview error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get all reviews for a specific seller
window.firebaseGetSellerReviews = async function (sellerId) {
    try {
        console.log('Fetching reviews for seller:', sellerId);

        if (!sellerId) {
            throw new Error('Seller ID is required');
        }

        let reviews = [];

        try {
            // Try primary query with orderBy
            const q = query(
                collection(db, 'user_reviews'),
                where('seller_id', '==', sellerId),
                orderBy('created_at', 'desc')
            );

            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                reviews.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        } catch (indexError) {
            console.warn('Primary review query failed (likely missing index), falling back to client-side sort:', indexError);

            // Fallback: Query without orderBy
            const qFallback = query(
                collection(db, 'user_reviews'),
                where('seller_id', '==', sellerId)
            );

            const snapshot = await getDocs(qFallback);
            snapshot.forEach(doc => {
                reviews.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Sort in memory by created_at (newest first)
            reviews.sort((a, b) => {
                const timeA = a.created_at?.seconds || 0;
                const timeB = b.created_at?.seconds || 0;
                return timeB - timeA;
            });
        }

        console.log(`✅ Found ${reviews.length} reviews for seller`);
        return { success: true, reviews };
    } catch (err) {
        console.error('❌ firebaseGetSellerReviews error:', err);
        return { success: false, message: err?.message || String(err), reviews: [] };
    }
};

// Delete a review (only by the review author)
window.firebaseDeleteReview = async function (reviewId, userId) {
    try {
        console.log('Deleting review:', reviewId);

        if (!reviewId || !userId) {
            throw new Error('Review ID and User ID are required');
        }

        // First check if the user owns this review
        const reviewRef = doc(db, 'user_reviews', reviewId);
        const reviewSnap = await getDoc(reviewRef);

        if (!reviewSnap.exists()) {
            throw new Error('Review not found');
        }

        const reviewData = reviewSnap.data();
        if (reviewData.buyer_id !== userId) {
            throw new Error('You can only delete your own reviews');
        }

        await deleteDoc(reviewRef);
        console.log('✅ Review deleted successfully');
        return { success: true };
    } catch (err) {
        console.error('❌ firebaseDeleteReview error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

export default app;
