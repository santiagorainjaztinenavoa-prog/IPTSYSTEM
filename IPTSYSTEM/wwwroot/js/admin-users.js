// Admin Dashboard Users Management
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// Firebase config
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
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700 hover:bg-gray-800 transition';
        
        const userInitial = (user.first_name?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase();
        const userName = user.first_name || 'Unknown';
        const userLastName = user.last_name || '';
        const userEmail = user.email || 'N/A';
        const userUsername = user.username || 'N/A';
        const accountTypeBadge = getAccountTypeBadge(user.account_type);
        const joinedDate = formatDate(user.date_created);
        
        row.innerHTML = '<td class="py-4 px-4"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">' +
            userInitial +
            '</div><div><p class="font-medium text-white">' + userName + ' ' + userLastName + '</p><p class="text-xs text-gray-500">@' + userUsername + '</p></div></div></td>' +
            '<td class="py-4 px-4 text-gray-300">' + userEmail + '</td>' +
            '<td class="py-4 px-4">' + accountTypeBadge + '</td>' +
            '<td class="py-4 px-4 text-gray-400 text-sm">' + joinedDate + '</td>' +
            '<td class="py-4 px-4 text-center"><button class="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded transition" title="View user details"><i class="bi bi-eye"></i></button><button class="editUserBtn px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs font-medium transition" data - id="${user.id}" ><i class="bi bi-pencil-square"></i></button > <button class="deleteUserBtn px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-red-300 text-xs font-medium transition" - id="${user.id}" ><i class="bi bi-trash"></i></button > ${user.status === "active" ? `< button class="deactivateUserBtn px-3 py-1.5 rounded-lg bg-yellow-900 hover:bg-yellow-800 text-yellow-300 text-xs font-medium transition" - id="${user.id}" ><i class="bi bi-slash-circle"></i></button >` : ""} ${user.status === "inactive" ? `< button class="reactivateUserBtn px-3 py-1.5 rounded-lg bg-green-900 hover:bg-green-800 text-green-300 text-xs font-medium transition"data - id="${user.id}" ><i class="bi bi-check-circle"></i></button >` : ""}</td>';

        usersTableBody.appendChild(row);
        
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
        snapshot.forEach(doc => {
            allUsers.push({
                id: doc.id,
                ...doc.data()
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

function renderUserRow(user) {
    return `
    <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
        <td class="py-4 px-4 font-medium text-white">${user.name}</td>
        <td class="py-4 px-4 text-gray-300">${user.email}</td>
        <td class="py-4 px-4 text-gray-300">${user.accountType}</td>
        <td class="py-4 px-4 text-gray-300">${user.createdAt}</td>

        <td class="py-4 px-4 text-center">
            <div class="flex items-center justify-center gap-2">

                <!-- EDIT -->
                <button class="editUserBtn px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs font-medium transition"
                        data-id="${user.id}">
                    <i class="bi bi-pencil-square"></i>
                </button>

                <!-- DELETE -->
                <button class="deleteUserBtn px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-red-300 text-xs font-medium transition"
                        data-id="${user.id}">
                    <i class="bi bi-trash"></i>
                </button>

                <!-- DEACTIVATE -->
                ${user.status === "active" ? `
                    <button class="deactivateUserBtn px-3 py-1.5 rounded-lg bg-yellow-900 hover:bg-yellow-800 text-yellow-300 text-xs font-medium transition"
                            data-id="${user.id}">
                        <i class="bi bi-slash-circle"></i>
                    </button>
                ` : ""}

                <!-- REACTIVATE -->
                ${user.status === "inactive" ? `
                    <button class="reactivateUserBtn px-3 py-1.5 rounded-lg bg-green-900 hover:bg-green-800 text-green-300 text-xs font-medium transition"
                            data-id="${user.id}">
                        <i class="bi bi-check-circle"></i>
                    </button>
                ` : ""}

            </div>
        </td>
    </tr>`;
}


