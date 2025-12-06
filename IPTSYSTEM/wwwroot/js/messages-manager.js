// ========== MESSAGES MANAGER - FIRESTORE CHAT ==========

let currentConversationId = null;
let currentConversation = null;
let allConversations = [];
let toastNotification;
let messagePollingInterval;
let notificationPermissionGranted = false;

// Profile cache to minimize Firebase reads
const profileCache = new Map();
const PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache (increased from 5)
let messageListenerUnsubscribe = null;
// Track if conversations have been loaded to prevent duplicate calls
let conversationsLoadedOnce = false;

document.addEventListener('DOMContentLoaded', function () {
    toastNotification = new bootstrap.Toast(document.getElementById('toastNotification'));
    
    // Load conversations for current user (only once)
    if (!conversationsLoadedOnce) {
        loadUserConversations();
        conversationsLoadedOnce = true;
    }
    
    // Setup message notifications (uses real-time listeners - efficient)
    setupMessageNotifications();
    
    // Request notification permission
    requestNotificationPermission();
});

// Request browser notification permission
async function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            notificationPermissionGranted = true;
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            notificationPermissionGranted = permission === 'granted';
        }
    }
}

// Setup real-time message notifications
function setupMessageNotifications() {
    if (!currentUserId) return;
    
    // Wait for Firebase to be ready
    const setupListener = () => {
        if (typeof window.firebaseListenForNewMessages === 'function') {
            window.firebaseListenForNewMessages(currentUserId, (notification) => {
                // Don't notify if we're already viewing this conversation
                if (notification.conversationId === currentConversationId) {
                    return;
                }
                
                // Show toast notification
                showToast(`New message from ${notification.senderName}: ${notification.message.substring(0, 50)}...`, 'info');
                
                // Show browser notification
                showBrowserNotification(notification);
                
                // Update unread badge without fetching (increment locally)
                const badge = document.querySelector('.messages-badge');
                if (badge) {
                    const current = parseInt(badge.textContent) || 0;
                    badge.textContent = current + 1;
                    badge.style.display = 'inline-block';
                }
                
                // Update conversation in local cache instead of reloading
                const convIndex = allConversations.findIndex(c => c.id === notification.conversationId);
                if (convIndex !== -1) {
                    allConversations[convIndex].lastMessage = notification.message;
                    allConversations[convIndex].lastMessageSenderId = 'other'; // Not current user
                    // Just highlight the conversation item
                    const convItem = document.querySelector(`[data-conversation-id="${notification.conversationId}"]`);
                    if (convItem && !convItem.classList.contains('unread')) {
                        convItem.classList.add('unread');
                        // Add unread dot
                        const meta = convItem.querySelector('.conversation-meta');
                        if (meta && !meta.querySelector('.unread-dot')) {
                            meta.innerHTML += '<span class="unread-dot" style="display: inline-block; width: 10px; height: 10px; background: #ef4444; border-radius: 50%; margin-top: 4px;"></span>';
                        }
                    }
                }
            });
        } else {
            // Retry after a short delay
            setTimeout(setupListener, 1000);
        }
    };
    
    setupListener();
}

// Show browser notification
function showBrowserNotification(notification) {
    if (!notificationPermissionGranted) return;
    
    try {
        const browserNotif = new Notification('New Message - Recommerce', {
            body: `${notification.senderName}: ${notification.message.substring(0, 100)}`,
            icon: '/logo/logo.png',
            tag: notification.conversationId
        });
        
        browserNotif.onclick = () => {
            window.focus();
            loadConversation(notification.conversationId);
            browserNotif.close();
        };
        
        // Auto-close after 5 seconds
        setTimeout(() => browserNotif.close(), 5000);
    } catch (err) {
        console.warn('Browser notification error:', err);
    }
}

// Update unread badge in navbar (use cached conversations, no extra reads)
function updateUnreadBadgeFromCache() {
    // Count unread from cached conversations - NO Firebase read!
    let unreadCount = 0;
    for (const conv of allConversations) {
        if (conv.lastMessageSenderId && conv.lastMessageSenderId !== currentUserId) {
            unreadCount++;
        }
    }
    
    const badge = document.querySelector('.messages-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Load all conversations for the current user
async function loadUserConversations() {
    if (!currentUserId) {
        document.getElementById('conversationList').innerHTML = `
            <div class="empty-conversations" style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <i class="bi bi-chat-dots" style="font-size: 2rem; color: #d1d5db;"></i>
                <p class="mt-2">Please login to view messages</p>
            </div>
        `;
        return;
    }
    
    try {
        // Use client-side Firebase
        if (typeof window.firebaseGetUserConversations === 'function') {
            const result = await window.firebaseGetUserConversations(currentUserId);
            
            if (result.success) {
                allConversations = result.conversations || [];
                displayConversationList(allConversations);
                
                // If there's an initial conversation ID from URL, load it
                if (initialConversationId) {
                    loadConversation(initialConversationId);
                }
            } else {
                showToast('Error loading conversations: ' + result.message, 'error');
            }
        } else {
            // Fallback to server API
            const response = await fetch(`/Messaging/GetUserConversations?userId=${encodeURIComponent(currentUserId)}`);
            const result = await response.json();
            
            if (result.success) {
                allConversations = result.conversations || [];
                displayConversationList(allConversations);
                
                if (initialConversationId) {
                    loadConversation(initialConversationId);
                }
            } else {
                showToast('Error loading conversations', 'error');
            }
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
        showToast('Error loading conversations', 'error');
    }
}

// Display conversation list in sidebar
async function displayConversationList(conversations) {
    const container = document.getElementById('conversationList');
    
    if (!conversations || conversations.length === 0) {
        container.innerHTML = `
            <div class="empty-conversations" style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <i class="bi bi-chat-dots" style="font-size: 3rem; color: #d1d5db;"></i>
                <p class="mt-3">No conversations yet</p>
                <p style="font-size: 0.85rem;">Start a conversation by messaging a seller from the Browse page</p>
            </div>
        `;
        updateUnreadBadge(0);
        return;
    }
    
    container.innerHTML = '';
    
    // Count unread conversations
    let unreadCount = 0;
    
    for (const conv of conversations) {
        // Determine the other person's info (if current user is buyer, show seller, and vice versa)
        const isBuyer = conv.buyerId === currentUserId;
        const otherName = isBuyer ? conv.sellerName : conv.buyerName;
        const otherId = isBuyer ? conv.sellerId : conv.buyerId;
        const otherInitial = otherName ? otherName.charAt(0).toUpperCase() : 'U';
        
        // Check if conversation has unread messages using lastReadBy timestamp
        const readField = `lastReadBy_${currentUserId}`;
        const lastReadTime = conv[readField]?.seconds || 0;
        const lastMessageTime = conv.lastMessageTime?.seconds || 0;
        const isUnread = conv.lastMessageSenderId && conv.lastMessageSenderId !== currentUserId && lastMessageTime > lastReadTime;
        if (isUnread) unreadCount++;
        
        const item = document.createElement('div');
        item.className = `conversation-item ${isUnread ? 'unread' : ''}`;
        item.setAttribute('data-conversation-id', conv.id);
        item.setAttribute('data-other-user-id', otherId || '');
        item.onclick = () => loadConversation(conv.id);
        
        item.innerHTML = `
            <div class="conversation-avatar">
                <div class="avatar-circle conv-avatar-${conv.id}" style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; background-size: cover; background-position: center;">
                    ${otherInitial}
                </div>
                <span class="status-indicator ${isUnread ? 'online' : 'offline'}"></span>
            </div>
            <div class="conversation-info">
                <h4 class="conversation-name" style="${isUnread ? 'font-weight: 700;' : ''}">${otherName || 'Unknown'}</h4>
                <p class="conversation-preview">${conv.listingTitle ? `📦 ${conv.listingTitle}` : ''}</p>
                <p class="conversation-preview" style="font-size: 0.8rem; color: ${isUnread ? '#374151' : '#9ca3af'}; ${isUnread ? 'font-weight: 600;' : ''}">${conv.lastMessage || 'No messages yet'}</p>
            </div>
            <div class="conversation-meta">
                <span class="conversation-time">${formatTimeAgo(conv.lastMessageTime)}</span>
                ${isUnread ? '<span class="unread-dot" style="display: inline-block; width: 10px; height: 10px; background: #ef4444; border-radius: 50%; margin-top: 4px;"></span>' : ''}
            </div>
        `;
        
        container.appendChild(item);
        
        // Load profile photo and name for other user (with caching)
        if (otherId && typeof window.firebaseGetUserProfile === 'function') {
            loadConversationUserProfileCached(conv.id, otherId);
        }
    }
    
    // Update navbar badge
    updateUnreadBadge(unreadCount);
}

// Get cached profile or fetch from Firebase
async function getCachedProfile(userId) {
    // Check cache first
    const cached = profileCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < PROFILE_CACHE_TTL)) {
        return cached.profile;
    }
    
    // Fetch from Firebase
    if (typeof window.firebaseGetUserProfile === 'function') {
        const result = await window.firebaseGetUserProfile(userId);
        if (result.success && result.profile) {
            // Store in cache
            profileCache.set(userId, {
                profile: result.profile,
                timestamp: Date.now()
            });
            return result.profile;
        }
    }
    return null;
}

// Load profile photo and name for conversation (cached)
async function loadConversationUserProfileCached(convId, userId) {
    try {
        const profile = await getCachedProfile(userId);
        if (profile) {
            // Update avatar with photo
            if (profile.photo_url) {
                const avatar = document.querySelector(`.conv-avatar-${convId}`);
                if (avatar) {
                    avatar.style.backgroundImage = `url("${profile.photo_url}")`;
                    avatar.innerHTML = ''; // Remove initial letter
                }
            }
            // Update name with actual profile name
            const profileName = profile.full_name || profile.fullName || profile.username;
            if (profileName) {
                const convItem = document.querySelector(`[data-conversation-id="${convId}"]`);
                if (convItem) {
                    const nameEl = convItem.querySelector('.conversation-name');
                    if (nameEl && (nameEl.textContent === 'Unknown' || nameEl.textContent !== profileName)) {
                        nameEl.textContent = profileName;
                        // Update initial letter if no photo
                        const avatar = document.querySelector(`.conv-avatar-${convId}`);
                        if (avatar && !profile.photo_url) {
                            avatar.innerHTML = profileName.charAt(0).toUpperCase();
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.warn('Could not load profile for user:', userId, err);
    }
}

// Update unread badge in navbar
function updateUnreadBadge(count) {
    const badge = document.querySelector('.messages-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Load profile photo and name for chat header (cached)
async function loadChatHeaderProfile(userId) {
    try {
        const profile = await getCachedProfile(userId);
        if (profile) {
            // Update avatar with photo
            if (profile.photo_url) {
                const avatar = document.querySelector('.chat-header-avatar');
                if (avatar) {
                    avatar.style.backgroundImage = `url("${profile.photo_url}")`;
                    avatar.innerHTML = ''; // Remove initial letter
                }
            }
            // Update name with actual profile name
            const profileName = profile.full_name || profile.fullName || profile.username;
            if (profileName) {
                const nameEl = document.getElementById('chatUserName');
                if (nameEl) {
                    nameEl.textContent = profileName;
                }
                // Update initial if no photo
                if (!profile.photo_url) {
                    const avatar = document.querySelector('.chat-header-avatar');
                    if (avatar) {
                        avatar.innerHTML = profileName.charAt(0).toUpperCase();
                    }
                }
            }
        }
    } catch (err) {
        console.warn('Could not load chat header profile:', err);
    }
}

// Load conversation messages
async function loadConversation(conversationId) {
    try {
        currentConversationId = conversationId;
        
        // Mark conversation as read when opened
        if (typeof window.firebaseMarkConversationRead === 'function') {
            window.firebaseMarkConversationRead(conversationId, currentUserId);
        }
        
        // Find conversation details
        currentConversation = allConversations.find(c => c.id === conversationId);
        
        // If not in cache, fetch it
        if (!currentConversation) {
            if (typeof window.firebaseGetConversation === 'function') {
                const convResult = await window.firebaseGetConversation(conversationId);
                if (convResult.success) {
                    currentConversation = convResult.conversation;
                } else {
                    console.warn('Could not load conversation:', convResult.message);
                }
            }
        }
        
        // Update UI
        document.getElementById('chatEmptyState').style.display = 'none';
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('chatMessages').style.display = 'flex';
        document.getElementById('chatInputContainer').style.display = 'flex';
        
        // Highlight active conversation and remove unread state
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            // Remove unread styling when conversation is opened
            if (activeItem.classList.contains('unread')) {
                activeItem.classList.remove('unread');
                // Remove the red dot
                const unreadDot = activeItem.querySelector('.unread-dot');
                if (unreadDot) unreadDot.remove();
                // Reset name and preview styles
                const nameEl = activeItem.querySelector('.conversation-name');
                const previewEl = activeItem.querySelector('.conversation-preview:last-child');
                if (nameEl) nameEl.style.fontWeight = '700';
                if (previewEl) {
                    previewEl.style.fontWeight = 'normal';
                    previewEl.style.color = '#9ca3af';
                }
                // Update unread count in navbar
                const currentCount = document.querySelectorAll('.conversation-item.unread').length;
                updateUnreadBadge(currentCount);
            }
        }
        
        // Update chat header
        if (currentConversation && (currentConversation.buyerId || currentConversation.sellerId)) {
            const isBuyer = currentConversation.buyerId === currentUserId;
            const otherName = isBuyer ? currentConversation.sellerName : currentConversation.buyerName;
            const otherId = isBuyer ? currentConversation.sellerId : currentConversation.buyerId;
            const otherInitial = otherName ? otherName.charAt(0).toUpperCase() : 'U';
            const otherRole = isBuyer ? 'Seller' : 'Buyer';
            
            document.getElementById('chatUserName').textContent = otherName || 'Unknown';
            document.getElementById('chatUserStatus').textContent = otherRole;
            document.getElementById('chatUserStatus').style.color = '#10b981';
            
            // Set avatar with initial first
            const avatarContainer = document.querySelector('.chat-user-avatar');
            if (avatarContainer) {
                avatarContainer.innerHTML = `
                    <div class="avatar-circle chat-header-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1rem; overflow: hidden; background-size: cover; background-position: center;">
                        ${otherInitial}
                    </div>
                    <span class="status-indicator online" id="chatStatus"></span>
                `;
                
                // Load profile photo and real name for chat header
                if (otherId && typeof window.firebaseGetUserProfile === 'function') {
                    loadChatHeaderProfile(otherId);
                }
            }
        } else {
            // Fallback for conversations without proper data
            document.getElementById('chatUserName').textContent = 'Chat';
            document.getElementById('chatUserStatus').textContent = 'Conversation';
            document.getElementById('chatUserStatus').style.color = '#9ca3af';
        }
        
        // Load messages using client-side Firebase
        let messages = [];
        if (typeof window.firebaseGetMessages === 'function') {
            const result = await window.firebaseGetMessages(conversationId);
            if (result.success) {
                messages = result.messages || [];
            }
        }
        
        displayMessages(messages);
        scrollToBottom();
        
        // Start polling for new messages
        startMessagePolling();
        
    } catch (error) {
        console.error('Error loading conversation:', error);
        showToast('Error loading conversation: ' + error.message, 'error');
    }
}

// Display messages in chat panel
function displayMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #9ca3af;">
                <i class="bi bi-chat-dots" style="font-size: 2rem;"></i>
                <p class="mt-2">No messages yet. Start the conversation!</p>
            </div>
        `;
        return;
    }
    
    messages.forEach(message => {
        const isSent = message.senderId === currentUserId;
        
        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${isSent ? 'sent' : 'received'}`;
        messageGroup.setAttribute('data-message-id', message.id);
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        messageBubble.style.position = 'relative';
        
        const messageText = document.createElement('p');
        messageText.className = 'message-text';
        messageText.innerHTML = (message.text || '').replace(/\n/g, '<br>');
        
        const messageTime = document.createElement('span');
        messageTime.className = 'message-time';
        messageTime.textContent = formatTime(message.timestamp);
        
        // Add delete button only for sent messages
        if (isSent) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete-message';
            deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
            deleteBtn.title = 'Delete message';
            deleteBtn.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 12px; cursor: pointer; opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteMessage(message.id);
            };
            messageBubble.appendChild(deleteBtn);
            
            // Show delete button on hover
            messageBubble.addEventListener('mouseenter', () => deleteBtn.style.opacity = '1');
            messageBubble.addEventListener('mouseleave', () => deleteBtn.style.opacity = '0');
        }
        
        messageBubble.appendChild(messageText);
        messageBubble.appendChild(messageTime);
        messageGroup.appendChild(messageBubble);
        chatMessages.appendChild(messageGroup);
    });
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentConversationId) return;
    
    if (!currentUserId) {
        showToast('Please login to send messages', 'error');
        return;
    }
    
    try {
        // Add message to UI immediately
        addMessageToUI(message, true);
        messageInput.value = '';
        scrollToBottom();
        
        // Send using client-side Firebase
        if (typeof window.firebaseSendMessage === 'function') {
            const result = await window.firebaseSendMessage(
                currentConversationId,
                currentUserId,
                currentUserName,
                message
            );
            
            if (!result.success) {
                showToast('Error: ' + result.message, 'error');
            }
        } else {
            // Fallback to server API
            const response = await fetch('/Messaging/SendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: currentConversationId,
                    senderId: currentUserId,
                    senderName: currentUserName,
                    text: message
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                showToast('Error: ' + result.message, 'error');
            }
        }
        
        messageInput.focus();
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error sending message: ' + error.message, 'error');
    }
}

// Add message to UI
function addMessageToUI(content, isSent) {
    const chatMessages = document.getElementById('chatMessages');
    
    // Remove empty state if present
    const emptyState = chatMessages.querySelector('div[style*="text-align: center"]');
    if (emptyState) {
        emptyState.remove();
    }
    
    const messageGroup = document.createElement('div');
    messageGroup.className = `message-group ${isSent ? 'sent' : 'received'}`;
    
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    
    const messageText = document.createElement('p');
    messageText.className = 'message-text';
    messageText.innerHTML = content.replace(/\n/g, '<br>');
    
    const messageTime = document.createElement('span');
    messageTime.className = 'message-time';
    messageTime.textContent = 'Just now';
    
    messageBubble.appendChild(messageText);
    messageBubble.appendChild(messageTime);
    messageGroup.appendChild(messageBubble);
    chatMessages.appendChild(messageGroup);
}

// Start real-time message listener (replaces polling - much fewer reads!)
function startMessagePolling() {
    // Clear existing listener
    if (messageListenerUnsubscribe) {
        messageListenerUnsubscribe();
        messageListenerUnsubscribe = null;
    }
    
    // Clear any old polling interval
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
    }
    
    if (!currentConversationId) return;
    
    // Use real-time listener instead of polling
    if (typeof window.firebaseListenToMessages === 'function') {
        messageListenerUnsubscribe = window.firebaseListenToMessages(currentConversationId, (messages) => {
            displayMessages(messages);
            scrollToBottom();
        });
    } else {
        // Fallback: poll every 10 seconds instead of 3 (reduces reads by 70%)
        messagePollingInterval = setInterval(async () => {
            if (currentConversationId && typeof window.firebaseGetMessages === 'function') {
                try {
                    const result = await window.firebaseGetMessages(currentConversationId);
                    if (result.success) {
                        const currentCount = document.querySelectorAll('.message-group').length;
                        if ((result.messages || []).length > currentCount) {
                            displayMessages(result.messages || []);
                            scrollToBottom();
                        }
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }
        }, 10000); // 10 seconds instead of 3
    }
}

// Open AI chat (placeholder)
function openAIChat() {
    showToast('AI Assistant feature coming soon!', 'info');
}

// Handle Enter key press
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Filter conversations
function filterConversations() {
    const searchInput = document.getElementById('searchConversations').value.toLowerCase();
    const conversations = document.querySelectorAll('.conversation-item');
    
    conversations.forEach(conversation => {
        const name = conversation.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
        const preview = conversation.querySelector('.conversation-preview')?.textContent.toLowerCase() || '';
        
        if (name.includes(searchInput) || preview.includes(searchInput)) {
            conversation.style.display = 'flex';
        } else {
            conversation.style.display = 'none';
        }
    });
}

// Toggle chat options dropdown
function toggleChatOptions() {
    const dropdown = document.getElementById('chatOptionsDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// Chat options actions
function blockUser() {
    if (confirm('Are you sure you want to block this user?')) {
        showToast('User blocked successfully', 'success');
        toggleChatOptions();
    }
}

function reportUser() {
    if (confirm('Report this user for inappropriate behavior?')) {
        showToast('User reported. Our team will review this.', 'success');
        toggleChatOptions();
    }
}

// Delete a single message
async function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    try {
        if (typeof window.firebaseDeleteMessage === 'function') {
            const result = await window.firebaseDeleteMessage(currentConversationId, messageId);
            if (result.success) {
                // Remove message from UI
                const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageEl) {
                    messageEl.remove();
                }
                showToast('Message deleted', 'success');
            } else {
                showToast('Failed to delete message: ' + result.message, 'error');
            }
        } else {
            showToast('Delete function not available', 'error');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Error deleting message', 'error');
    }
}

// Delete entire conversation
async function deleteChat() {
    if (!confirm('Delete this entire conversation? This action cannot be undone.')) return;
    
    toggleChatOptions();
    
    try {
        if (typeof window.firebaseDeleteConversation === 'function') {
            showToast('Deleting conversation...', 'info');
            const result = await window.firebaseDeleteConversation(currentConversationId);
            if (result.success) {
                showToast('Conversation deleted', 'success');
                
                // Remove from UI
                const convItem = document.querySelector(`[data-conversation-id="${currentConversationId}"]`);
                if (convItem) {
                    convItem.remove();
                }
                
                // Remove from local array
                allConversations = allConversations.filter(c => c.id !== currentConversationId);
                
                // Reset chat panel
                document.getElementById('chatEmptyState').style.display = 'flex';
                document.getElementById('chatHeader').style.display = 'none';
                document.getElementById('chatMessages').style.display = 'none';
                document.getElementById('chatInputContainer').style.display = 'none';
                currentConversationId = null;
                currentConversation = null;
                
                // Show empty state if no more conversations
                if (allConversations.length === 0) {
                    displayConversationList([]);
                }
            } else {
                showToast('Failed to delete: ' + result.message, 'error');
            }
        } else {
            showToast('Delete function not available', 'error');
        }
    } catch (error) {
        console.error('Error deleting conversation:', error);
        showToast('Error deleting conversation', 'error');
    }
}

// Utility functions
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    // Handle Firestore timestamp object
    let date;
    if (timestamp && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else if (timestamp && timestamp.toDate) {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) return 'Just now';
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    
    // Handle Firestore timestamp object
    let date;
    if (timestamp && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else if (timestamp && timestamp.toDate) {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(message, type = 'success') {
    const toastEl = document.getElementById('toastNotification');
    const toastBody = document.getElementById('toastMessage');
    
    if (!toastEl || !toastBody) return;
    
    toastBody.textContent = message;
    
    toastEl.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning', 'text-bg-info');
    if (type === 'success') {
        toastEl.classList.add('text-bg-success');
    } else if (type === 'error') {
        toastEl.classList.add('text-bg-danger');
    } else if (type === 'info') {
        toastEl.classList.add('text-bg-info');
    } else {
        toastEl.classList.add('text-bg-warning');
    }
    
    if (toastNotification) {
        toastNotification.show();
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('chatOptionsDropdown');
    const optionsBtn = document.querySelector('.btn-chat-options');
    
    if (dropdown && optionsBtn && !dropdown.contains(event.target) && !optionsBtn.contains(event.target)) {
        dropdown.style.display = 'none';
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    
    // Stop message listener
    if (typeof window.firebaseStopMessageListener === 'function' && currentUserId) {
        window.firebaseStopMessageListener(currentUserId);
    }
});
