// Admin Dashboard - Overview (realtime + cached)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
    getFirestore,
    collection,
    onSnapshot,
    enableIndexedDbPersistence,
    query,
    orderBy
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// Firebase config (keep in sync with other admin scripts)
const firebaseConfig = {
    apiKey: "AIzaSyBNWCNxC0d-YAem0Za51epjfl_WXcyDZSE",
    authDomain: "carousell-c3b3f.firebaseapp.com",
    projectId: "carousell-c3b3f",
    storageBucket: "carousell-c3b3f.firebasestorage.app",
    messagingSenderId: "33772869337",
    appId: "1:33772869337:web:f1f86a5cc8f71d0c1050c8",
    measurementId: "G-YR7F7YER8V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Enable persistence (best-effort)
try {
    enableIndexedDbPersistence(db).then(() => {
        console.log('? Firestore persistence enabled (overview)');
    }).catch((err) => {
        console.warn('?? Firestore persistence not enabled (overview):', err);
    });
} catch (e) {
    console.warn('?? enableIndexedDbPersistence not available (overview):', e);
}

// DOM elements (optional — script is robust if they are absent)
const totalUsersEl = document.getElementById('overviewTotalUsers');
const activeUsersEl = document.getElementById('overviewActiveUsers');
const sellersEl = document.getElementById('overviewSellers');
const buyersEl = document.getElementById('overviewBuyers');
const newUsers7DaysEl = document.getElementById('overviewNewUsers7Days');
const totalListingsEl = document.getElementById('overviewTotalListings');

// Helpers
function trySetText(el, text) {
    if (!el) return;
    el.textContent = text;
}

function computeUserStats(users) {
    const total = users.length;
    let active = 0;
    let sellers = 0;
    let buyers = 0;
    let new7 = 0;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    users.forEach(u => {
        const status = (u.status || '').toLowerCase();
        if (status === 'active') active++;
        const type = (u.account_type || u.accountType || 'buyer').toLowerCase();
        if (type === 'seller') sellers++; else buyers++;

        const ts = u.date_created;
        let createdMs = 0;
        if (ts && ts.toDate) createdMs = ts.toDate().getTime();
        else if (typeof ts === 'string') createdMs = new Date(ts).getTime();

        if (createdMs && createdMs >= sevenDaysAgo) new7++;
    });

    return { total, active, sellers, buyers, new7 };
}

// Start listening to users collection for overview stats
function startOverviewListeners() {
    try {
        const usersColl = collection(db, 'users');
        const usersQ = query(usersColl, orderBy('date_created', 'desc'));
        onSnapshot(usersQ, (snapshot) => {
            const users = [];
            snapshot.forEach(docSnap => users.push({ id: docSnap.id, ...docSnap.data() }));
            const stats = computeUserStats(users);

            trySetText(totalUsersEl, stats.total || '0');
            trySetText(activeUsersEl, stats.active || '0');
            trySetText(sellersEl, stats.sellers || '0');
            trySetText(buyersEl, stats.buyers || '0');
            trySetText(newUsers7DaysEl, stats.new7 || '0');

            console.log('? Overview users updated (count:', stats.total, ')');
        }, (err) => {
            console.error('? Overview - users snapshot error:', err);
        });
    } catch (err) {
        console.error('? Failed to start users overview listener:', err);
    }

    // Optionally listen to listings/items collection if you track listings
    try {
        const listingsColl = collection(db, 'listings'); // adjust to your collection name if different
        const listingsQ = query(listingsColl, orderBy('created_at', 'desc'));
        onSnapshot(listingsQ, (snapshot) => {
            trySetText(totalListingsEl, snapshot.size || '0');
            console.log('? Overview listings updated (count:', snapshot.size, ')');
        }, (err) => {
            // If the collection doesn't exist or permission denied, just log.
            console.warn('?? Overview - listings snapshot error (may be fine if you don't have listings collection): ', err);
        });
    } catch (err) {
        // safe-ignore if collection name differs
        console.debug('? listings listener skipped or failed to start:', err);
    }
}

// Initialize overview on DOM ready and when auth is ready
function initializeOverview() {
    // Only run on pages intended to show overview
    if (document.querySelector('[data-active-menu="overview"]') || window.location.search.includes('menu=overview') || document.getElementById('overviewTotalUsers')) {
        onAuthStateChanged(auth, (user) => {
            console.log('?? Overview auth state:', user ? user.email : 'No user');
            startOverviewListeners();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOverview);
} else {
    initializeOverview();
}