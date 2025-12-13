// Admin Dashboard Overview Statistics
// This file loads statistics for the admin dashboard overview page

document.addEventListener('DOMContentLoaded', async function () {
    console.log('📊 Loading admin dashboard statistics...');

    // Wait for Firebase to be ready
    let retries = 0;
    while (typeof window.firebaseApp === 'undefined' && retries < 30) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
    }

    if (typeof window.firebaseApp === 'undefined') {
        console.error('❌ Firebase not loaded');
        showError();
        return;
    }

    // Load all statistics
    await Promise.all([
        loadTotalUsers(),
        loadTotalListings(),
        loadDisabledUsers(),
        loadTotalReports(),
        loadTotalMessages(),
        loadRecentUsers(),
        loadRecentItems()
    ]);
});

// Load total users count
async function loadTotalUsers() {
    try {
        const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore(window.firebaseApp);

        const usersSnapshot = await getDocs(collection(db, 'users'));
        const count = usersSnapshot.size;

        document.getElementById('totalUsers').textContent = count;
        console.log('✅ Total users:', count);
    } catch (error) {
        console.error('❌ Error loading total users:', error);
        document.getElementById('totalUsers').textContent = 'Error';
    }
}

// Load total listings count
async function loadTotalListings() {
    try {
        const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore(window.firebaseApp);

        const listingsSnapshot = await getDocs(collection(db, 'tbl_listing'));
        const count = listingsSnapshot.size;

        document.getElementById('totalListings').textContent = count;
        console.log('✅ Total listings:', count);
    } catch (error) {
        console.error('❌ Error loading total listings:', error);
        document.getElementById('totalListings').textContent = 'Error';
    }
}

// Load disabled users count
async function loadDisabledUsers() {
    try {
        const { getFirestore, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore(window.firebaseApp);

        const q = query(collection(db, 'users'), where('isEnabled', '==', false));
        const disabledSnapshot = await getDocs(q);
        const count = disabledSnapshot.size;

        document.getElementById('totalDisabledUsers').textContent = count;
        console.log('✅ Disabled users:', count);
    } catch (error) {
        console.error('❌ Error loading disabled users:', error);
        document.getElementById('totalDisabledUsers').textContent = 'Error';
    }
}

// Load total reports count
async function loadTotalReports() {
    try {
        const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore(window.firebaseApp);

        const reportsSnapshot = await getDocs(collection(db, 'admin_messages'));
        const count = reportsSnapshot.size;

        document.getElementById('totalReports').textContent = count;
        console.log('✅ Total reports:', count);
    } catch (error) {
        console.error('❌ Error loading total reports:', error);
        document.getElementById('totalReports').textContent = 'Error';
    }
}

// Load total messages count
async function loadTotalMessages() {
    try {
        const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore(window.firebaseApp);

        const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
        const count = conversationsSnapshot.size;

        document.getElementById('totalMessages').textContent = count;
        console.log('✅ Total conversations:', count);
    } catch (error) {
        console.error('❌ Error loading total messages:', error);
        document.getElementById('totalMessages').textContent = 'Error';
    }
}

// Load recent users for the table
async function loadRecentUsers() {
    try {
        const { getFirestore, collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore(window.firebaseApp);

        const q = query(collection(db, 'users'), orderBy('date_created', 'desc'), limit(5));
        const snapshot = await getDocs(q);

        const tbody = document.getElementById('recentUsersBody');
        if (!tbody) return;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-400">No users found</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
            const email = user.email || 'N/A';
            const joined = user.date_created ? new Date(user.date_created.seconds * 1000).toLocaleDateString() : 'N/A';
            const isActive = user.isEnabled !== false;

            html += `
                <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
                    <td class="py-3 px-2 text-white">${name}</td>
                    <td class="py-3 px-2 text-gray-400">${email}</td>
                    <td class="py-3 px-2 text-gray-400">${joined}</td>
                    <td class="py-3 px-2">
                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">
                            ${isActive ? 'active' : 'disabled'}
                        </span>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        console.log('✅ Loaded recent users');
    } catch (error) {
        console.error('❌ Error loading recent users:', error);
        const tbody = document.getElementById('recentUsersBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-400">Error loading users</td></tr>';
        }
    }
}

// Load recent items for the table
async function loadRecentItems() {
    try {
        const { getFirestore, collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore(window.firebaseApp);

        const q = query(collection(db, 'tbl_listing'), orderBy('date_created', 'desc'), limit(5));
        const snapshot = await getDocs(q);

        const tbody = document.getElementById('recentItemsBody');
        if (!tbody) return;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-400">No items found</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const title = item.title || 'Untitled';
            const price = item.price ? `₱${item.price.toLocaleString()}` : 'N/A';
            const category = item.category || 'Uncategorized';
            const status = item.status || 'active';

            html += `
                <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
                    <td class="py-3 px-2 text-white">${title}</td>
                    <td class="py-3 px-2 text-gray-400">${price}</td>
                    <td class="py-3 px-2 text-gray-400">${category}</td>
                    <td class="py-3 px-2">
                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}">
                            ${status}
                        </span>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        console.log('✅ Loaded recent items');
    } catch (error) {
        console.error('❌ Error loading recent items:', error);
        const tbody = document.getElementById('recentItemsBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-400">Error loading items</td></tr>';
        }
    }
}

// Show error state
function showError() {
    const elements = ['totalUsers', 'totalListings', 'totalDisabledUsers', 'totalReports', 'totalMessages'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'Error';
    });
}
