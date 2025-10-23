// ========== MESSAGES MANAGER - CHAT & AI BOT ==========

let currentConversationId = null;
let toastNotification;
let messagePollingInterval;

document.addEventListener('DOMContentLoaded', function () {
    toastNotification = new bootstrap.Toast(document.getElementById('toastNotification'));
    
    // Auto-select AI Assistant conversation
    const aiConversation = document.querySelector('.ai-conversation');
    if (aiConversation) {
        aiConversation.click();
    }
});

// Load conversation messages
async function loadConversation(conversationId) {
    try {
        currentConversationId = conversationId;
        
        // Update UI
 document.getElementById('chatEmptyState').style.display = 'none';
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('chatMessages').style.display = 'flex';
    document.getElementById('chatInputContainer').style.display = 'flex';
        
     // Highlight active conversation
   document.querySelectorAll('.conversation-item').forEach(item => {
  item.classList.remove('active');
});
        document.querySelector(`[data-conversation-id="${conversationId}"]`).classList.add('active');
  
        // Update chat header
      const conversation = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        const userName = conversation.querySelector('.conversation-name').textContent.trim();
        const userAvatar = conversation.querySelector('.conversation-avatar img').src;
        const isOnline = conversation.querySelector('.status-indicator').classList.contains('online');
        
        document.getElementById('chatUserName').textContent = userName;
        document.getElementById('chatAvatar').src = userAvatar;
      document.getElementById('chatStatus').className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
        document.getElementById('chatUserStatus').textContent = isOnline ? 'Active now' : 'Offline';
        document.getElementById('chatUserStatus').style.color = isOnline ? '#10b981' : '#9ca3af';
        
        // Load messages
        const response = await fetch(`/Home/GetMessages?conversationId=${conversationId}`);
        const messages = await response.json();
        
        displayMessages(messages);
        scrollToBottom();
        
    } catch (error) {
        showToast('Error loading conversation: ' + error.message, 'error');
    }
}

// Display messages in chat panel
function displayMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
messages.forEach(message => {
        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${message.senderId === 'me' ? 'sent' : 'received'}`;
   
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
     
        if (message.isFromBot) {
messageBubble.classList.add('bot-message');
   }
    
        const messageText = document.createElement('p');
        messageText.className = 'message-text';
        messageText.innerHTML = message.content.replace(/\n/g, '<br>');
        
        const messageTime = document.createElement('span');
    messageTime.className = 'message-time';
        messageTime.textContent = formatTime(message.timestamp);
        
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
  
    if (!message || currentConversationId === null) return;
    
    try {
        // Check if it's AI bot conversation
        if (currentConversationId === 0) {
     await sendBotMessage(message);
        } else {
            await sendUserMessage(message);
        }
      
     messageInput.value = '';
        messageInput.focus();
        
    } catch (error) {
        showToast('Error sending message: ' + error.message, 'error');
    }
}

// Send message to AI bot
async function sendBotMessage(message) {
    // Add user message to UI immediately
    addMessageToUI(message, true, false);
  scrollToBottom();
    
    // Show typing indicator
    showTypingIndicator();
  
    try {
    const response = await fetch('/Home/AskBot', {
  method: 'POST',
    headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, context: 'marketplace' })
        });
        
     const result = await response.json();

  // Remove typing indicator
        removeTypingIndicator();
        
   if (result.success) {
// Add bot response to UI
     setTimeout(() => {
       addMessageToUI(result.message.content, false, true);
         scrollToBottom();
            }, 300);
      } else {
        showToast('Bot error: ' + result.message, 'error');
      }
    } catch (error) {
        removeTypingIndicator();
      showToast('Error communicating with AI: ' + error.message, 'error');
    }
}

// Send message to user
async function sendUserMessage(message) {
    // Add message to UI immediately
    addMessageToUI(message, true, false);
    scrollToBottom();
    
    try {
        const response = await fetch('/Home/SendMessage', {
            method: 'POST',
headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: currentConversationId, message: message })
        });
      
        const result = await response.json();
        
        if (!result.success) {
      showToast('Error: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Error sending message: ' + error.message, 'error');
    }
}

// Add message to UI
function addMessageToUI(content, isSent, isBot) {
    const chatMessages = document.getElementById('chatMessages');
    
    const messageGroup = document.createElement('div');
    messageGroup.className = `message-group ${isSent ? 'sent' : 'received'}`;
    
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    
    if (isBot) {
        messageBubble.classList.add('bot-message');
    }
    
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

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message-group received';
    typingDiv.id = 'typingIndicator';
    
const typingBubble = document.createElement('div');
    typingBubble.className = 'message-bubble typing-bubble';
    
    typingBubble.innerHTML = `
        <div class="typing-dots">
  <span></span>
       <span></span>
        <span></span>
        </div>
    `;
    
    typingDiv.appendChild(typingBubble);
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Open AI chat directly
function openAIChat() {
    loadConversation(0);
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
   const name = conversation.querySelector('.conversation-name').textContent.toLowerCase();
  const preview = conversation.querySelector('.conversation-preview').textContent.toLowerCase();
        
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

function deleteChat() {
    if (confirm('Delete this conversation? This action cannot be undone.')) {
        showToast('Conversation deleted', 'success');
        toggleChatOptions();
     document.getElementById('chatEmptyState').style.display = 'flex';
        document.getElementById('chatHeader').style.display = 'none';
        document.getElementById('chatMessages').style.display = 'none';
        document.getElementById('chatInputContainer').style.display = 'none';
    }
}

// Utility functions
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(message, type = 'success') {
    const toastEl = document.getElementById('toastNotification');
    const toastBody = document.getElementById('toastMessage');
    
    toastBody.textContent = message;
    
    toastEl.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning');
    if (type === 'success') {
        toastEl.classList.add('text-bg-success');
    } else if (type === 'error') {
 toastEl.classList.add('text-bg-danger');
    } else {
        toastEl.classList.add('text-bg-warning');
    }
    
    toastNotification.show();
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('chatOptionsDropdown');
    const optionsBtn = document.querySelector('.btn-chat-options');
    
    if (dropdown && optionsBtn && !dropdown.contains(event.target) && !optionsBtn.contains(event.target)) {
      dropdown.style.display = 'none';
    }
});
