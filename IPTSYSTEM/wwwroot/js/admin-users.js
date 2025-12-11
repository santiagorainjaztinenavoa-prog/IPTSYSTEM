// Admin Dashboard Users Management
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// Firebase config
// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBHhIZv1_Ecryd3nw99S_osVwvdLT1Z9sA",
    authDomain: "recommerce2-c5f5c.firebaseapp.com",
    projectId: "recommerce2-c5f5c",
    storageBucket: "recommerce2-c5f5c.firebasestorage.app",
    messagingSenderId: "769830240332",
    appId: "1:769830240332:web:de0489490afe9a2242b4e9",
    measurementId: "G-2W1Y5M0REW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// UI Elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const usersTableContainer = document.getElementById('usersTableContainer');
const usersTableBody = document.getElementById('usersTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchUsers');
const filterSelect = document.getElementById('filterAccountType');
const refreshBtn = document.getElementById('refreshUsersBtn');
const paginationContainer = document.getElementById('paginationContainer');
const paginationInfo = document.getElementById('paginationInfo');
const pageInfo = document.getElementById('pageInfo');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

// Data storage
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const itemsPerPage = 10;

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';

    let date;
    if (timestamp.toDate) {
        // Firestore Timestamp
        date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else {
        return 'N/A';
    }

    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('en-US', options);
}

// Format account type badge
function getAccountTypeBadge(accountType) {
    const type = (accountType || 'buyer').toLowerCase();
    if (type === 'seller') {
        return '<span class="px-3 py-1 rounded-full text-xs font-medium bg-purple-900 text-purple-300">Seller</span>';
    } else {
        return '<span class="px-3 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-300">Buyer</span>';
    }
}

// Small helper for alerts (replaceable)
function notify(message) {
    try {
        // try in-page toast if you have one; fallback to alert
        alert(message);
    } catch (e) {
        console.log(message);
    }
}

// Render table rows
function renderTable() {
    usersTableBody.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);

    if (pageUsers.length === 0) {
        usersTableContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    usersTableContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    pageUsers.forEach((user) => {
        // Normalize user fields for the renderer
        const userForRow = {
            id: user.id,
            name: ((user.first_name || user.name || 'Unknown') + (user.last_name ? (' ' + user.last_name) : '')).trim(),
            email: user.email || 'N/A',
            accountType: user.account_type || user.accountType || 'buyer',
            createdAt: formatDate(user.date_created),
            status: (user.status || 'active').toLowerCase(),
            isEnabled: user.isEnabled !== false // Default to true if not set
        };

        // Insert the rendered row HTML (renderUserRow returns a full <tr>...</tr>)
        usersTableBody.insertAdjacentHTML('beforeend', renderUserRow(userForRow));
    });


    // Update pagination info
    paginationInfo.textContent = filteredUsers.length;
    pageInfo.textContent = 'Page ' + currentPage + ' of ' + Math.ceil(filteredUsers.length / itemsPerPage);

    // Update pagination buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= Math.ceil(filteredUsers.length / itemsPerPage);
}

// Filter and search
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const accountType = filterSelect.value.toLowerCase();

    filteredUsers = allUsers.filter(user => {
        const matchesSearch = !searchTerm ||
            (user.first_name || '').toLowerCase().includes(searchTerm) ||
            (user.last_name || '').toLowerCase().includes(searchTerm) ||
            (user.email || '').toLowerCase().includes(searchTerm) ||
            (user.username || '').toLowerCase().includes(searchTerm);

        const matchesType = !accountType ||
            (user.account_type || 'buyer').toLowerCase() === accountType;

        return matchesSearch && matchesType;
    });

    currentPage = 1;
    renderTable();
}

// Fetch users from Firebase
async function fetchUsers() {
    try {
        if (loadingState) loadingState.classList.remove('hidden');
        if (errorState) errorState.classList.add('hidden');
        if (usersTableContainer) usersTableContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.add('hidden');

        // Check if user is authenticated
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.warn('⚠️ No Firebase user authenticated. Attempting to load users anyway...');
        }

        const usersCollection = collection(db, 'users');
        const snapshot = await getDocs(usersCollection);

        allUsers = [];
        snapshot.forEach(docSnap => {
            allUsers.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        // Sort by date created (newest first)
        allUsers.sort((a, b) => {
            const dateA = a.date_created?.toDate?.() || new Date(0);
            const dateB = b.date_created?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        console.log('✅ Loaded', allUsers.length, 'users from Firebase');
        if (loadingState) loadingState.classList.add('hidden');
        applyFilters();
    } catch (err) {
        console.error('❌ Error fetching users:', err);
        if (loadingState) loadingState.classList.add('hidden');
        if (errorState) errorState.classList.remove('hidden');
        if (errorMessage) errorMessage.textContent = err.message || 'Failed to load users from Firebase';
    }
}

// Event listeners
if (searchInput) searchInput.addEventListener('input', applyFilters);
if (filterSelect) filterSelect.addEventListener('change', applyFilters);
if (refreshBtn) refreshBtn.addEventListener('click', fetchUsers);
if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            document.querySelector('main').scrollTop = 0;
        }
    });
}
if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
        const maxPage = Math.ceil(filteredUsers.length / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage++;
            renderTable();
            document.querySelector('main').scrollTop = 0;
        }
    });
}

// Wait for Firebase auth and load users
function initializeUsersTable() {
    // Check if on users menu
    if (document.querySelector('[data-active-menu="users"]') || window.location.search.includes('menu=users')) {
        // Wait for Firebase auth state to be ready
        onAuthStateChanged(auth, (user) => {
            console.log('🔐 Firebase Auth state changed:', user ? user.email : 'No user');
            // Fetch users regardless of auth state, let Firestore rules handle permissions
            fetchUsers();
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUsersTable);
} else {
    initializeUsersTable();
}

// Edit User
document.addEventListener("click", (e) => {
    if (e.target.closest(".editUserBtn")) {
        const userId = e.target.closest(".editUserBtn").dataset.id;
        openEditUserModal(userId);
    }
});

// Delete User
document.addEventListener("click", (e) => {
    if (e.target.closest(".deleteUserBtn")) {
        const userId = e.target.closest(".deleteUserBtn").dataset.id;
        deleteUserAccount(userId);
    }
});

// Deactivate User
document.addEventListener("click", (e) => {
    if (e.target.closest(".deactivateUserBtn")) {
        const userId = e.target.closest(".deactivateUserBtn").dataset.id;
        deactivateUser(userId);
    }
});

// Reactivate User
document.addEventListener("click", (e) => {
    if (e.target.closest(".reactivateUserBtn")) {
        const userId = e.target.closest(".reactivateUserBtn").dataset.id;
        reactivateUser(userId);
    }
});

// ---- Implementations for Edit / Delete / Deactivate / Reactivate ----

async function openEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        notify('User not found');
        return;
    }

    // Simple prompt-based editor (replace with a proper modal in the future)
    const currentFullName = ((user.first_name || '') + (user.last_name ? (' ' + user.last_name) : '')).trim();
    const newFullName = prompt('Edit full name for ' + (user.email || userId), currentFullName);
    if (newFullName === null) return; // cancelled

    const parts = newFullName.trim().split(/\s+/);
    const first = parts.shift() || '';
    const last = parts.join(' ') || '';

    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { first_name: first, last_name: last });
        notify('User updated');
        // Update local cache and re-render
        const idx = allUsers.findIndex(u => u.id === userId);
        if (idx !== -1) {
            allUsers[idx].first_name = first;
            allUsers[idx].last_name = last;
        }
        applyFilters();
    } catch (err) {
        console.error('Error updating user:', err);
        notify('Failed to update user: ' + (err.message || err));
    }
}

async function deleteUserAccount(userId) {
    const confirmed = confirm('Delete this user from Firestore? The Firebase Auth account will remain but user will not be able to log in.');
    if (!confirmed) return;

    try {
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
        notify('User deleted from Firestore. They will no longer be able to log in.');
        // Remove from local cache and re-render
        allUsers = allUsers.filter(u => u.id !== userId);
        applyFilters();
    } catch (err) {
        console.error('Error deleting user:', err);
        notify('Failed to delete user: ' + (err.message || err));
    }
}

async function deactivateUser(userId) {
    const confirmed = confirm('Disable this user? They will not be able to log in.');
    if (!confirmed) return;

    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            isEnabled: false,
            status: 'inactive',
            disabled_at: new Date()
        });
        notify('User disabled successfully');
        const idx = allUsers.findIndex(u => u.id === userId);
        if (idx !== -1) {
            allUsers[idx].isEnabled = false;
            allUsers[idx].status = 'inactive';
        }
        applyFilters();
    } catch (err) {
        console.error('Error disabling user:', err);
        notify('Failed to disable user: ' + (err.message || err));
    }
}

async function reactivateUser(userId) {
    const confirmed = confirm('Enable this user? They will be able to log in again.');
    if (!confirmed) return;

    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            isEnabled: true,
            status: 'active',
            enabled_at: new Date()
        });
        notify('User enabled successfully');
        const idx = allUsers.findIndex(u => u.id === userId);
        if (idx !== -1) {
            allUsers[idx].isEnabled = true;
            allUsers[idx].status = 'active';
        }
        applyFilters();
    } catch (err) {
        console.error('Error enabling user:', err);
        notify('Failed to enable user: ' + (err.message || err));
    }
}

function renderUserRow(user) {
    // user is expected to have: id, name, email, accountType, createdAt, status, isEnabled
    const accountBadge = getAccountTypeBadge(user.accountType);
    const isEnabled = user.isEnabled !== false;
    const statusBadge = isEnabled
        ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-300">Active</span>'
        : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-300">Disabled</span>';

    return `
    <tr class="border-b border-gray-700 hover:bg-gray-800 transition">
        <td class="py-4 px-4 font-medium text-white">${user.name}</td>
        <td class="py-4 px-4 text-gray-300">${user.email}</td>
        <td class="py-4 px-4">${accountBadge}</td>
        <td class="py-4 px-4">${statusBadge}</td>
        <td class="py-4 px-4 text-gray-300">${user.createdAt}</td>

        <td class="py-4 px-4 text-center">
            <div class="flex items-center justify-center gap-2">

                <!-- EDIT -->
                <button class="editUserBtn px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs font-medium transition"
                        data-id="${user.id}" title="Edit User">
                    <i class="bi bi-pencil-square"></i>
                </button>

                <!-- DELETE -->
                <button class="deleteUserBtn px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-red-300 text-xs font-medium transition"
                        data-id="${user.id}" title="Delete User">
                    <i class="bi bi-trash"></i>
                </button>

                <!-- DISABLE (show if enabled) -->
                ${isEnabled ? `
                    <button class="deactivateUserBtn px-3 py-1.5 rounded-lg bg-yellow-900 hover:bg-yellow-800 text-yellow-300 text-xs font-medium transition"
                            data-id="${user.id}" title="Disable User">
                        <i class="bi bi-slash-circle"></i>
                    </button>
                ` : ""}

                <!-- ENABLE (show if disabled) -->
                ${!isEnabled ? `
                    <button class="reactivateUserBtn px-3 py-1.5 rounded-lg bg-green-900 hover:bg-green-800 text-green-300 text-xs font-medium transition"
                            data-id="${user.id}" title="Enable User">
                        <i class="bi bi-check-circle"></i>
                    </button>
                ` : ""}

            </div>
        </td>
    </tr>`;
}


