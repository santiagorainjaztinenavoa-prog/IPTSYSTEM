// Firebase client initialization module
// NOTE: This file intentionally contains the public Firebase web config as requested.
// It initializes Firebase (Auth + Firestore + Analytics) and exposes window.firebaseRegister

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, query, where, collection, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

const firebaseConfig = { apiKey: "AIzaSyBNWCNxC0d-YAem0Za51epjfl_WXcyDZSE", authDomain: "carousell-c3b3f.firebaseapp.com", projectId: "carousell-c3b3f", storageBucket: "carousell-c3b3f.firebasestorage.app", messagingSenderId: "33772869337", appId: "1:33772869337:web:f1f86a5cc8f71d0c1050c8", measurementId: "G-YR7F7YER8V" };
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
    profiles: new Map(),
    savedProducts: new Map(),
    savedIds: new Map(),
    conversations: new Map()
};

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
window.firebaseClearCache = function(cacheType) {
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
    arr.sort((a,b) => a.name.localeCompare(b.name)); 
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
    results.sort((a,b) => a.name.localeCompare(b.name)); 
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
    results.sort((a,b) => a.name.localeCompare(b.name)); 
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
    results.sort((a,b) => a.name.localeCompare(b.name)); 
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
    results.sort((a,b) => a.name.localeCompare(b.name)); 
    geoCache.barangaysByCity[cityCode] = results; 
    return results; 
}

window.firebaseGeo = { loadRegions: geoLoadRegions, loadProvincesByRegion: geoLoadProvincesByRegion, loadCitiesByRegion: geoLoadCitiesByRegion, loadCitiesByProvince: geoLoadCitiesByProvince, loadBarangaysByCity: geoLoadBarangaysByCity };

auth.onAuthStateChanged((user) => { if (user) { console.log('Firebase user authenticated:', user.uid, user.email); } else { console.log('No Firebase user authenticated'); tryAutoSignInFromSession(); } });
async function tryAutoSignInFromSession() { try { const userEmail = document.querySelector('[data-user-email]')?.getAttribute('data-user-email'); const sessionEmail = sessionStorage.getItem('SessionEmail'); if (!userEmail && !sessionEmail) { console.log('No user email in session, auto-sign in skipped'); return; } const email = userEmail || sessionEmail; console.log('Attempting auto-sign in with:', email); console.log('Auto-sign in prepared for:', email); } catch (err) { console.debug('Auto-sign in not available:', err.message); } }
window.tryAutoSignInFromSession = tryAutoSignInFromSession;

window.firebaseRegister = async function(firstName, lastName, email, password, username, accountType, phoneNumber, region, province, city, barangay, postalCode, streetAddress, composedAddress) {
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;
    await setDoc(doc(db, 'users', uid), { first_name: firstName || '', last_name: lastName || '', email: email || '', username: username || '', account_type: accountType || 'Buyer', phone_number: phoneNumber || '', region: region || '', province: province || '', city: city || '', barangay: barangay || '', postal_code: postalCode || '', street_address: streetAddress || '', address_full: composedAddress || '', user_id: uid, photo_url: '', date_created: serverTimestamp() });
    try { const createdSnap = await getDoc(doc(db, 'users', uid)); if (!createdSnap.exists()) { console.warn('User doc not found immediately after setDoc', { uid }); return { success: false, code: 'user-doc-missing', message: 'User created in Auth but profile document not found after write.' }; } console.info('Firebase registration succeeded', { uid }); return { success: true, uid, profile: createdSnap.data() }; } catch (re) { console.error('Error verifying created user document', re); return { success: false, code: 'user-doc-verify-failed', message: re?.message || String(re) }; }
  } catch (err) { const code = err?.code || null; const message = err?.message || String(err); console.error('Firebase register error', { code, message, err }); return { success: false, code, message }; }
};

// Listing helpers
window.firebaseCreateListing = async function(listing) { try { console.log('🔥 firebaseCreateListing called with:', listing); let userId = null; const user = auth.currentUser; if (user) { userId = user.uid; console.log('✅ Using Firebase authenticated user:', userId); } else { userId = sessionStorage.getItem('UserId') || 'anonymous-' + Date.now(); console.log('⚠️  Using session/anonymous user ID:', userId); } const docId = listing.id || null; const payload = { title: listing.title || '', description: listing.description || '', price: typeof listing.price === 'number' ? listing.price : parseFloat(listing.price) || 0, category: listing.category || '', condition: listing.condition || '', imageUrl: listing.imageUrl || '', user_id: userId, seller_name: sessionStorage.getItem('FullName') || 'Unknown Seller', seller_username: sessionStorage.getItem('Username') || 'unknown', product_id: docId, date_created: serverTimestamp() }; console.log('📝 Payload to save:', JSON.stringify(payload, null, 2)); const col = collection(db, 'tbl_listing'); console.log('📍 Saving to collection: tbl_listing'); const docRefAdded = await addDoc(col, payload); console.log('✅ Document added successfully with ID:', docRefAdded.id); if (!docId) { try { await updateDoc(doc(db, 'tbl_listing', docRefAdded.id), { product_id: docRefAdded.id }); console.log('✅ Updated product_id field to:', docRefAdded.id); } catch (updateErr) { console.warn('⚠️  Failed to update product_id, but document was created:', updateErr.message); } } console.log('✅ Listing saved successfully to Firestore!'); return { success: true, id: docRefAdded.id }; } catch (err) { console.error('❌ firebaseCreateListing error:', err); return { success: false, message: err?.message || String(err) }; } };
window.firebaseUpdateListing = async function(listing) { try { console.log('firebaseUpdateListing called with:', listing); const col = collection(db, 'tbl_listing'); const q = query(col, where('product_id', '==', listing.id)); const snaps = await getDocs(q); console.log('Found', snaps.size, 'documents with product_id:', listing.id); if (snaps.size === 0) { console.log('No docs found by product_id, trying as firestore doc id'); const docReference = doc(db, 'tbl_listing', String(listing.id)); await updateDoc(docReference, { title: listing.title, description: listing.description, price: listing.price, category: listing.category, condition: listing.condition, imageUrl: listing.imageUrl || '' }); console.log('Updated doc by firestore id'); return { success: true }; } for (const d of snaps.docs) { console.log('Updating doc:', d.id); await updateDoc(doc(db, 'tbl_listing', d.id), { title: listing.title, description: listing.description, price: listing.price, category: listing.category, condition: listing.condition, imageUrl: listing.imageUrl || '' }); } console.log('Update completed successfully'); return { success: true }; } catch (err) { console.error('firebaseUpdateListing error', err); return { success: false, message: err?.message || String(err) }; } };
window.firebaseDeleteListing = async function(productIdOrDocId) { try { console.log('firebaseDeleteListing called with:', productIdOrDocId); const col = collection(db, 'tbl_listing'); const q = query(col, where('product_id', '==', productIdOrDocId)); const snaps = await getDocs(q); console.log('Found', snaps.size, 'documents with product_id:', productIdOrDocId); if (snaps.size === 0) { try { console.log('No docs found by product_id, trying as firestore doc id'); await deleteDoc(doc(db, 'tbl_listing', String(productIdOrDocId))); console.log('Deleted doc by firestore id'); return { success: true }; } catch (e) { console.error('Error deleting by doc id:', e); return { success: false, message: 'No matching listing found' }; } } for (const d of snaps.docs) { console.log('Deleting doc:', d.id); await deleteDoc(doc(db, 'tbl_listing', d.id)); } console.log('Delete completed successfully'); return { success: true }; } catch (err) { console.error('firebaseDeleteListing error', err); return { success: false, message: err?.message || String(err) }; } };
window.firebaseMarkAsSold = async function(productIdOrDocId) { try { console.log('firebaseMarkAsSold called with:', productIdOrDocId); const col = collection(db, 'tbl_listing'); const q = query(col, where('product_id', '==', productIdOrDocId)); const snaps = await getDocs(q); console.log('Found', snaps.size, 'documents with product_id:', productIdOrDocId); if (snaps.size === 0) { try { console.log('No docs found by product_id, trying as firestore doc id'); const docReference = doc(db, 'tbl_listing', String(productIdOrDocId)); await updateDoc(docReference, { status: 'sold', sold_date: serverTimestamp() }); console.log('Marked as sold by firestore id'); return { success: true }; } catch (e) { console.error('Error marking as sold by doc id:', e); return { success: false, message: 'No matching listing found' }; } } for (const d of snaps.docs) { console.log('Marking as sold doc:', d.id); await updateDoc(doc(db, 'tbl_listing', d.id), { status: 'sold', sold_date: serverTimestamp() }); } console.log('Mark as sold completed successfully'); return { success: true }; } catch (err) { console.error('firebaseMarkAsSold error', err); return { success: false, message: err?.message || String(err) }; } };
window.firebaseFetchSoldItems = async function(sellerUserId) { try { console.log('🔍 Fetching sold items for seller:', sellerUserId); const col = collection(db, 'tbl_listing'); let q = query(col, where('user_id', '==', sellerUserId), where('status', '==', 'sold')); let snaps = await getDocs(q); console.log('📊 Found', snaps.size, 'sold items'); const soldItems = []; snaps.forEach((docSnap) => { const data = docSnap.data(); if (data.title && typeof data.title === 'string' && data.title.trim() !== '') { soldItems.push({ id: docSnap.id, ...data }); } }); console.log('✅ Returning', soldItems.length, 'sold items'); return { success: true, items: soldItems, count: soldItems.length }; } catch (err) { console.error('firebaseFetchSoldItems error', err); return { success: false, message: err?.message || String(err), items: [] }; } };
window.__firebaseConfig = firebaseConfig;
window.firebaseSignIn = async function(email, password) { try { const userCred = await signInWithEmailAndPassword(auth, email, password); const uid = userCred.user.uid; const userDocRef = doc(db, 'users', uid); const snap = await getDoc(userDocRef); if (!snap.exists()) { try { console.warn('Profile document missing for uid, attempting to create minimal profile', { uid }); await setDoc(userDocRef, { first_name: userCred.user.displayName ? userCred.user.displayName.split(' ')[0] : '', last_name: userCred.user.displayName ? userCred.user.displayName.split(' ').slice(1).join(' ') : '', email: userCred.user.email || '', username: (userCred.user.email ? userCred.user.email.split('@')[0] : uid), account_type: 'Buyer', phone_number: '', user_id: uid, date_created: serverTimestamp() }); const newSnap = await getDoc(userDocRef); if (newSnap.exists()) { return { success: true, uid, profile: newSnap.data(), migrated: true }; } else { try { await signOut(auth); } catch { } return { success: false, code: 'user-doc-missing-after-create', message: 'Authenticated but profile could not be created in Firestore.' }; } } catch (createErr) { console.error('Failed to auto-create user profile document', createErr); try { await signOut(auth); } catch { } return { success: false, code: createErr?.code || 'user-doc-create-failed', message: createErr?.message || String(createErr) }; } }

        // SECURITY: block sign-in on client if Firestore profile indicates inactive status
        try {
            const profile = snap.exists() ? snap.data() : null;
            let isInactive = false;
            if (profile) {
                // status string field
                if (profile.status && String(profile.status).trim().toLowerCase() === 'inactive') isInactive = true;
                // account_status alias
                if (!isInactive && profile.account_status && String(profile.account_status).trim().toLowerCase() === 'inactive') isInactive = true;
                // boolean flags
                if (!isInactive && (profile.is_active !== undefined)) {
                    if (profile.is_active === false || String(profile.is_active).ToLowerCase() === 'false') isInactive = true;
                }
                if (!isInactive && (profile.active !== undefined)) {
                    if (profile.active === false || String(profile.active).ToLowerCase() === 'false') isInactive = true;
                }
            }
            if (isInactive) {
                try { await signOut(auth); } catch { /* ignore */ }
                return { success: false, code: 'inactive', message: 'This account has been deactivated. Contact support.' };
            }
        } catch (checkErr) {
            console.debug('Could not verify user status from client Firestore:', checkErr?.message || checkErr);
            // Fall through — do not block sign-in if client-side check fails
        }

         return { success: true, uid, profile: snap.data() }; } catch (err) { const code = err?.code || null; const message = err?.message || String(err); console.error('Firebase signIn error', { code, message, err }); return { success: false, code, message }; } };
window.firebaseUserExistsByEmail = async function(email) { try { const q = query(collection(db, 'users'), where('email', '==', email)); const snap = await getDocs(q); return snap.size > 0; } catch (err) { console.error('Error checking user exists by email', err); return false; } };
window.establishServerSession = async function(email, uid) { try { let profile = null; try { const userDocRef = doc(db, 'users', uid); const s = await getDoc(userDocRef); if (s.exists()) profile = s.data(); } catch (e) { console.debug('Could not load user profile for server session:', e); } const payload = { Email: email, Uid: uid, Username: profile?.username || null, UserType: profile?.account_type || null, FullName: profile?.first_name || profile?.last_name ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() : null }; const resp = await fetch('/Home/ClientLogin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) }); return await resp.json(); } catch (e) { console.error('Failed to establish server session', e); return { success: false, message: e?.message || String(e) }; } };
window.firebaseFetchSellerProducts = async function(sellerUserId, forceRefresh = false, includeSold = false) {
    try {
        // Always fetch live data (ignore cache)
        dataCache.sellerProducts.delete(sellerUserId);
        
        console.log('🔍 Fetching products for seller:', sellerUserId);
        const col = collection(db, 'tbl_listing');
        let q = query(col, where('user_id', '==', sellerUserId));
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
window.firebaseFetchAllProducts = async function(forceRefresh = false, limitCount = null) {
    try {
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
        
        // Simple query without orderBy to avoid missing field issues
        const snaps = await getDocs(col);
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
            console.log('👥 Fetching', userIds.size, 'unique sellers...');
            const userPromises = Array.from(userIds).map(async (userId) => {
                try {
                    const userRef = doc(db, 'users', userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        userCache[userId] = {
                            fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username || 'Unknown Seller',
                            username: userData.username || userData.email?.split('@')[0] || ''
                        };
                    }
                } catch (err) {
                    console.debug('Could not fetch user:', userId);
                }
            });
            await Promise.all(userPromises);
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
window.firebaseFetchUserProducts = async function(userId, includeSold = false) {
    try {
        console.log('🔄 Fetching products for user:', userId, 'includeSold:', includeSold);
        const col = collection(db, 'tbl_listing');
        
        // Query only for this user's products - no orderBy to avoid missing field issues
        const q = query(col, where('user_id', '==', userId));
        
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

window.firebaseFetchProductById = async function(productId) { try { console.log('Fetching product:', productId); const docRef = doc(db, 'tbl_listing', productId); const snap = await getDoc(docRef); if (!snap.exists()) { console.warn('Product not found:', productId); return { success: false, message: 'Product not found' }; } const product = { id: snap.id, ...snap.data() }; console.log('Product found:', product); return { success: true, product }; } catch (err) { console.error('firebaseFetchProductById error', err); return { success: false, message: err?.message || String(err) }; } };

// ========== MESSAGING FUNCTIONS ==========

// Create or get existing conversation
window.firebaseStartConversation = async function(buyerId, buyerName, sellerId, sellerName, listingId, listingTitle) {
    try {
        console.log('🔥 Starting conversation:', { buyerId, buyerName, sellerId, sellerName, listingId, listingTitle });
        
        // Create a readable conversation ID: buyer_seller_listing
        const conversationId = `${buyerId}_${sellerId}_${listingId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        
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
            buyerName: buyerName,
            sellerId: sellerId,
            sellerName: sellerName,
            listingId: listingId,
            listingTitle: listingTitle,
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp()
        };
        
        await setDoc(conversationRef, conversationData);
        console.log('✅ Created new conversation:', conversationId);
        
        return { success: true, conversation: { id: conversationId, ...conversationData } };
    } catch (err) {
        console.error('❌ firebaseStartConversation error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get user conversations (with caching)
window.firebaseGetUserConversations = async function(userId, forceRefresh = false) {
    try {
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
        
        // Query where user is buyer
        try {
            const buyerQuery = query(conversationsCol, where('buyerId', '==', userId));
            const buyerSnaps = await getDocs(buyerQuery);
            buyerSnaps.forEach(docSnap => {
                if (!processedIds.has(docSnap.id)) {
                    processedIds.add(docSnap.id);
                    const data = docSnap.data();
                    // Only add if document has required fields
                    if (data.buyerId || data.sellerId) {
                        conversations.push({ id: docSnap.id, ...data });
                    }
                }
            });
            console.log('📊 Found', buyerSnaps.size, 'conversations as buyer');
        } catch (e) {
            console.warn('Error querying buyer conversations:', e.message);
        }
        
        // Query where user is seller
        try {
            const sellerQuery = query(conversationsCol, where('sellerId', '==', userId));
            const sellerSnaps = await getDocs(sellerQuery);
            sellerSnaps.forEach(docSnap => {
                if (!processedIds.has(docSnap.id)) {
                    processedIds.add(docSnap.id);
                    const data = docSnap.data();
                    // Only add if document has required fields
                    if (data.buyerId || data.sellerId) {
                        conversations.push({ id: docSnap.id, ...data });
                    }
                }
            });
            console.log('📊 Found', sellerSnaps.size, 'conversations as seller');
        } catch (e) {
            console.warn('Error querying seller conversations:', e.message);
        }
        
        // Sort by lastMessageTime descending
        conversations.sort((a, b) => {
            const getTime = (t) => {
                if (!t) return 0;
                if (t.seconds) return t.seconds;
                if (t.toDate) return t.toDate().getTime() / 1000;
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
window.firebaseGetMessages = async function(conversationId) {
    try {
        console.log('🔥 Getting messages for conversation:', conversationId);
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        const q = query(messagesCol);
        const snaps = await getDocs(q);
        
        const messages = [];
        snaps.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by timestamp ascending
        messages.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeA - timeB;
        });
        
        console.log('✅ Found', messages.length, 'messages');
        return { success: true, messages };
    } catch (err) {
        console.error('❌ firebaseGetMessages error:', err);
        return { success: false, message: err?.message || String(err), messages: [] };
    }
};

// Real-time message listener (uses onSnapshot - more efficient than polling!)
// Returns an unsubscribe function
window.firebaseListenToMessages = function(conversationId, callback) {
    try {
        console.log('🔔 Setting up real-time message listener for:', conversationId);
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        
        const unsubscribe = onSnapshot(messagesCol, (snapshot) => {
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort by timestamp ascending
            messages.sort((a, b) => {
                const timeA = a.timestamp?.seconds || 0;
                const timeB = b.timestamp?.seconds || 0;
                return timeA - timeB;
            });
            
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
window.firebaseSendMessage = async function(conversationId, senderId, senderName, text) {
    try {
        console.log('🔥 Sending message:', { conversationId, senderId, senderName, text });
        
        // First, ensure the conversation document exists
        const conversationRef = doc(db, 'conversations', conversationId);
        const convSnap = await getDoc(conversationRef);
        
        if (!convSnap.exists()) {
            console.error('❌ Conversation document does not exist:', conversationId);
            return { success: false, message: 'Conversation not found. Please refresh and try again.' };
        }
        
        // Add message to subcollection
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        const messageData = {
            senderId: senderId,
            senderName: senderName,
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
            // Message was still sent successfully
        }
        
        return { success: true, messageId: newMsgRef.id };
    } catch (err) {
        console.error('❌ firebaseSendMessage error:', err);
        return { success: false, message: err?.message || String(err) };
    }
};

// Get conversation by ID
window.firebaseGetConversation = async function(conversationId) {
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
window.firebaseFixConversation = async function(conversationId, buyerId, buyerName, sellerId, sellerName, listingId, listingTitle) {
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
window.firebaseFetchProductsByCategory = async function(category) { try { console.log('Fetching products in category:', category); const col = collection(db, 'tbl_listing'); const q = query(col, where('category', '==', category)); const snaps = await getDocs(q); console.log('Found', snaps.size, 'products in category:', category); const products = []; snaps.forEach((docSnap) => { const data = docSnap.data(); if (data.title && typeof data.title === 'string' && data.title.trim() !== '') { if (data.is_active !== false) { products.push({ id: docSnap.id, ...data }); } } }); return { success: true, products, count: products.length }; } catch (err) { console.error('firebaseFetchProductsByCategory error', err); return { success: false, message: err?.message || String(err), products: [] }; } };

// ========== PROFILE UPDATE FUNCTIONS ==========

// Update user profile in Firebase
window.firebaseUpdateProfile = async function(userId, profileData) {
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
window.firebaseUploadProfilePhoto = async function(userId, file) {
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
        return new Promise(function(resolve) {
            const reader = new FileReader();
            reader.onload = async function(e) {
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
            reader.onerror = function() {
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
window.firebaseGetUserProfile = async function(userId, forceRefresh = false) {
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
window.firebaseDeleteMessage = async function(conversationId, messageId) {
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
window.firebaseDeleteConversation = async function(conversationId) {
    try {
        console.log('🔥 Deleting conversation:', conversationId);
        
        // First delete all messages in the subcollection
        const messagesCol = collection(db, 'conversations', conversationId, 'messages');
        const messagesSnap = await getDocs(messagesCol);
        
        const deletePromises = [];
        messagesSnap.forEach(msgDoc => {
            deletePromises.push(deleteDoc(doc(db, 'conversations', conversationId, 'messages', msgDoc.id)));
        });
        
        await Promise.all(deletePromises);
        console.log('✅ Deleted', deletePromises.length, 'messages');
        
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
window.firebaseMarkConversationRead = async function(conversationId, userId) {
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

window.firebaseListenForNewMessages = function(userId, callback) {
    try {
        console.log('🔔 Setting up message listener for user:', userId);
        
        const conversationsCol = collection(db, 'conversations');
        
        // Listen for conversations where user is buyer
        const buyerQuery = query(conversationsCol, where('buyerId', '==', userId));
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
        const sellerQuery = query(conversationsCol, where('sellerId', '==', userId));
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
window.firebaseStopMessageListener = function(userId) {
    if (messageUnsubscribers[userId]) {
        if (messageUnsubscribers[userId].buyer) messageUnsubscribers[userId].buyer();
        if (messageUnsubscribers[userId].seller) messageUnsubscribers[userId].seller();
        delete messageUnsubscribers[userId];
        console.log('🔕 Message listener stopped for user:', userId);
    }
};

// Get unread message count
window.firebaseGetUnreadCount = async function(userId) {
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
window.firebaseSaveProduct = async function(userId, productId, productData) {
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
window.firebaseUnsaveProduct = async function(userId, productId) {
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
window.firebaseIsProductSaved = async function(userId, productId) {
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
window.firebaseGetSavedProducts = async function(userId, forceRefresh = false) {
    try {
        // Check cache first
        const cached = dataCache.savedProducts.get(userId);
        if (!forceRefresh && isCacheValid(cached, CACHE_TTL.SAVED)) {
            console.log('💾 Using cached saved products for:', userId);
            return { success: true, products: cached.data, count: cached.data.length, cached: true };
        }
        
        console.log('📚 Fetching saved products from tbl_saved for user:', userId);
        
        const col = collection(db, 'tbl_saved');
        const q = query(col, where('user_id', '==', userId));
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
window.firebaseGetSavedProductIds = async function(userId, forceRefresh = false) {
    try {
        // Check cache first
        const cached = dataCache.savedIds.get(userId);
        if (!forceRefresh && isCacheValid(cached, CACHE_TTL.SAVED)) {
            console.log('💾 Using cached saved IDs for:', userId);
            return { success: true, savedIds: cached.data, cached: true };
        }
        
        const col = collection(db, 'tbl_saved');
        const q = query(col, where('user_id', '==', userId));
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
window.firebaseToggleSaveProduct = async function(userId, productId, productData) {
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
window.firebaseAddReview = async function(reviewData) {
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
window.firebaseGetSellerReviews = async function(sellerId) {
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
window.firebaseDeleteReview = async function(reviewId, buyerId) {
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
window.firebaseUpdateReview = async function(reviewId, buyerId, updates) {
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

// ========== SELLER REPORTS / ANALYTICS ==========
// Fetch all sold items with details for reports and analytics
window.firebaseGetSellerReports = async function(sellerId) {
    try {
        if (!sellerId) {
            throw new Error('Seller ID is required');
        }

        console.log('📊 Fetching reports for seller:', sellerId);

        // Query the reports collection - fetch by seller_id only (avoid composite index requirement)
        const reportsCol = collection(db, 'reports');
        const q = query(reportsCol, where('seller_id', '==', sellerId));
        const snapshot = await getDocs(q);

        const reports = [];
        snapshot.forEach(doc => {
            reports.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by sold_date descending in JavaScript (avoid index requirement)
        reports.sort((a, b) => {
            const dateA = a.sold_date?.seconds || 0;
            const dateB = b.sold_date?.seconds || 0;
            return dateB - dateA;
        });

        console.log('✅ Found', reports.length, 'reports for seller:', sellerId);

        return { success: true, reports, count: reports.length };
    } catch (err) {
        console.error('❌ firebaseGetSellerReports error:', err);
        return { success: false, reports: [], message: err?.message || String(err) };
    }
};

// Fetch and aggregate sold items for analytics
window.firebaseGetSalesAnalytics = async function(sellerId) {
    try {
        if (!sellerId) {
            throw new Error('Seller ID is required');
        }

        console.log('📈 Generating sales analytics for seller:', sellerId);

        // Get all SOLD items from tbl_listing (History) instead of reports collection
        // This pulls from the actual sold items in the system
        const listingsCol = collection(db, 'tbl_listing');
        const q = query(listingsCol, where('user_id', '==', sellerId), where('status', '==', 'sold'));
        const snapshot = await getDocs(q);
        
        const soldItems = [];
        snapshot.forEach(doc => {
            soldItems.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('📊 Found', soldItems.length, 'sold items for seller:', sellerId);
        
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
        
        const reports = soldItems;
        
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

export default app;
