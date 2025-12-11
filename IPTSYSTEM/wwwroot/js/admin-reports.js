import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    enableIndexedDbPersistence,
    getCountFromServer
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// Firebase config - keep in sync with other admin scripts
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

// Enable IndexedDB persistence (best-effort)
try {
    enableIndexedDbPersistence(db).then(() => {
        console.log('✅ Firestore persistence enabled for reports');
    }).catch((err) => {
        console.warn('⚠️ Firestore persistence not enabled (reports):', err);
    });
} catch (e) {
    console.warn('⚠️ enableIndexedDbPersistence not available (reports):', e);
}

// DOM references
const totalUsersEl = document.getElementById('totalUsers');
const totalListingsEl = document.getElementById('totalListings');
const totalRevenueEl = document.getElementById('totalRevenue');
const activeTransactionsEl = document.getElementById('activeTransactions');
const recentUsersBody = document.getElementById('recentUsersBody');
const recentListingsBody = document.getElementById('recentListingsBody');

// Helpers
function trySetText(el, value) {
    if (!el) return;
    el.textContent = value;
}

function formatCurrencyPH(value) {
    try {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(value || 0);
    } catch {
        return '₱' + (Number(value || 0)).toFixed(2);
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) return timestamp.toDate().toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    try { return new Date(timestamp).toLocaleString('en-PH'); } catch { return 'N/A'; }
}

function renderUserRow(u) {
    const name = ((u.first_name || u.name || '') + (u.last_name ? (' ' + u.last_name) : '')).trim() || 'Unknown';
    const email = u.email || 'N/A';
    const joinDate = formatDate(u.date_created);
    const status = (u.status || 'inactive').toLowerCase();
    const badgeClass = status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-300';
    return `
        <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
            <td class="py-3 px-2 font-medium text-white">${name}</td>
            <td class="py-3 px-2 text-gray-300">${email}</td>
            <td class="py-3 px-2 text-gray-300">${joinDate}</td>
            <td class="py-3 px-2">
                <span class="px-3 py-1 rounded-full text-xs font-medium ${badgeClass}">
                    ${status}
                </span>
            </td>
        </tr>
    `;
}

function renderListingRow(l) {
    const title = l.title || l.name || 'Untitled';
    const price = l.price != null ? '₱' + Number(l.price).toLocaleString('en-PH') : '₱0';
    const views = l.views != null ? l.views : 0;
    const status = (l.status || 'inactive').toLowerCase();
    const badgeClass = status === 'active' ? 'bg-green-900 text-green-300' : status === 'flagged' ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-300';
    return `
        <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
            <td class="py-3 px-2 font-medium text-white">${title}</td>
            <td class="py-3 px-2 text-gray-300">${price}</td>
            <td class="py-3 px-2 text-gray-300">${views}</td>
            <td class="py-3 px-2">
                <span class="px-3 py-1 rounded-full text-xs font-medium ${badgeClass}">
                    ${status}
                </span>
            </td>
            <td class="py-3 px-2 text-center">
                <button class="px-3 py-1 rounded-lg bg-blue-900 text-blue-300 text-xs">View</button>
            </td>
        </tr>
    `;
}

// Primary listeners & fetchers

// Recent users (realtime, limited)
let recentUsersUnsub = null;
function startRecentUsersListener() {
    if (recentUsersUnsub) return;
    try {
        const usersColl = collection(db, 'users');
        const usersQ = query(usersColl, orderBy('date_created', 'desc'), limit(5));
        recentUsersUnsub = onSnapshot(usersQ, (snap) => {
            if (!recentUsersBody) return;
            recentUsersBody.innerHTML = '';
            const rows = [];
            snap.forEach(docSnap => {
                rows.push(renderUserRow({ id: docSnap.id, ...docSnap.data() }));
            });
            recentUsersBody.innerHTML = rows.join('');
            console.log('✅ Reports: recent users updated (count:', snap.size, ')');
        }, (err) => {
            console.error('❌ Reports recent users snapshot error:', err);
        });
    } catch (err) {
        console.error('❌ startRecentUsersListener failed:', err);
    }
}

// Recent listings (realtime, limited)
let recentListingsUnsub = null;
function startRecentListingsListener() {
    if (recentListingsUnsub) return;
    try {
        const listingsColl = collection(db, 'listings');
        const listingsQ = query(listingsColl, orderBy('created_at', 'desc'), limit(5));
        recentListingsUnsub = onSnapshot(listingsQ, (snap) => {
            if (!recentListingsBody) return;
            recentListingsBody.innerHTML = '';
            const rows = [];
            snap.forEach(docSnap => {
                rows.push(renderListingRow({ id: docSnap.id, ...docSnap.data() }));
            });
            recentListingsBody.innerHTML = rows.join('');
            console.log('✅ Reports: recent listings updated (count:', snap.size, ')');
        }, (err) => {
            console.warn('⚠️ Reports recent listings snapshot error (collection may not exist or permission denied):', err);
        });
    } catch (err) {
        console.error('❌ startRecentListingsListener failed:', err);
    }
}

// Transactions listener - compute revenue & active transactions
let transactionsUnsub = null;
function startTransactionsListener() {
    if (transactionsUnsub) return;
    try {
        const txColl = collection(db, 'transactions');
        transactionsUnsub = onSnapshot(txColl, (snap) => {
            let revenue = 0;
            let activeTx = 0;
            snap.forEach(docSnap => {
                const d = docSnap.data() || {};
                const status = (d.status || '').toLowerCase();
                // Accept common amount fields
                const amount = Number(d.amount ?? d.total ?? d.price ?? 0);
                revenue += isNaN(amount) ? 0 : amount;
                if (status === 'active' || status === 'pending') activeTx++;
            });
            trySetText(totalRevenueEl, formatCurrencyPH(revenue));
            trySetText(activeTransactionsEl, activeTx);
            console.log('✅ Reports: transactions updated (revenue:', revenue, 'active:', activeTx, ')');
        }, (err) => {
            console.warn('⚠️ Reports transactions snapshot error (may not exist):', err);
        });
    } catch (err) {
        console.error('❌ startTransactionsListener failed:', err);
    }
}

// Lightweight counts using aggregation API where possible (one-time / periodic)
async function fetchCounts() {
    try {
        // total users - use getCountFromServer to avoid fetching all docs
        const usersCountSnapshot = await getCountFromServer(query(collection(db, 'users')));
        trySetText(totalUsersEl, usersCountSnapshot.data().count ?? '0');
    } catch (err) {
        console.warn('⚠️ getCountFromServer(users) failed, falling back to 0:', err);
        trySetText(totalUsersEl, '0');
    }

    try {
        // active listings count - aggregation with where(status == 'active')
        const activeListingsQ = query(collection(db, 'listings'), where('status', '==', 'active'));
        const listingsCountSnapshot = await getCountFromServer(activeListingsQ);
        trySetText(totalListingsEl, listingsCountSnapshot.data().count ?? '0');
    } catch (err) {
        console.warn('⚠️ getCountFromServer(listings) failed, falling back to 0:', err);
        trySetText(totalListingsEl, '0');
    }
}

// Initialize listeners when auth / DOM ready and on correct menu
function initializeReportsModule() {
    // Only run if the reports UI is present or active
    if (!(document.getElementById('recentUsersBody') || document.getElementById('recentListingsBody'))) return;

    // Listen to auth state — still start listeners regardless of auth to allow cached reads
    onAuthStateChanged(auth, (user) => {
        console.log('🔐 Reports auth state changed:', user ? user.email : 'No user');
        // start realtime listeners (limited queries where possible)
        startRecentUsersListener();
        startRecentListingsListener();
        startTransactionsListener();
        // fetch lightweight counts (uses aggregation API)
        fetchCounts();
    });
}

// Start on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReportsModule);
} else {
    initializeReportsModule();
}