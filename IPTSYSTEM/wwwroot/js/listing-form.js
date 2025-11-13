// Listing Form Handler - Manages add/edit listing modal and Firebase integration

let currentEditingListingId = null;

function openListingModal(listingId = null) {
    currentEditingListingId = listingId;
    const modal = document.getElementById('listingModal');
    
    if (!modal) {
        console.error('Listing modal not found');
        return;
    }
    
    if (listingId) {
        // Edit mode - load listing data
        loadListingForEdit(listingId);
        document.querySelector('.modal-title').textContent = 'Edit Listing';
        document.querySelector('.btn-save-listing').textContent = 'Update Listing';
    } else {
        // Add mode - clear form
        document.getElementById('listingForm').reset();
        document.querySelector('.modal-title').textContent = 'Add New Listing';
        document.querySelector('.btn-save-listing').textContent = 'Add Listing';
    }
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function closeListingModal() {
    const modal = document.getElementById('listingModal');
    if (modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    }
    currentEditingListingId = null;
}

async function loadListingForEdit(listingId) {
    try {
        // Load from the display data or fetch from Firebase
        const form = document.getElementById('listingForm');
        const card = document.querySelector(`[data-listing-id="${listingId}"]`);
        
        if (card) {
            form.querySelector('[name="title"]').value = card.dataset.title || '';
            form.querySelector('[name="description"]').value = card.dataset.description || '';
            form.querySelector('[name="price"]').value = card.dataset.price || '';
            form.querySelector('[name="category"]').value = card.dataset.category || '';
            form.querySelector('[name="condition"]').value = card.dataset.condition || '';
            form.querySelector('[name="imageUrl"]').value = card.dataset.imageUrl || '';
        }
    } catch (err) {
        console.error('Error loading listing for edit', err);
        showNotification('Error loading listing', 'error');
    }
}

async function saveListing() {
    const form = document.getElementById('listingForm');
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Get form data
    const listing = {
        title: form.querySelector('[name="title"]').value.trim(),
        description: form.querySelector('[name="description"]').value.trim(),
        price: parseFloat(form.querySelector('[name="price"]').value) || 0,
        category: form.querySelector('[name="category"]').value,
        condition: form.querySelector('[name="condition"]').value,
        imageUrl: form.querySelector('[name="imageUrl"]').value.trim()
    };
    
    // Validate required fields
    if (!listing.title || !listing.description || !listing.category) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Show loading state
    const saveBtn = document.querySelector('.btn-save-listing');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    
    try {
        // Check if Firebase functions are available
        if (typeof window.firebaseCreateListing === 'undefined') {
            console.error('Firebase functions not loaded');
            showNotification('Firebase is not ready. Please refresh the page.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            return;
        }
        
        // Get userId from session (user should be logged in)
        const userId = sessionStorage.getItem('UserId');
        console.log('Current user ID from session:', userId);
        
        if (!userId) {
            showNotification('You must be logged in to add listings', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            return;
        }
        
        let result;
        
        if (currentEditingListingId) {
            // Update existing listing
            listing.id = currentEditingListingId;
            console.log('Updating listing:', listing);
            result = await window.firebaseUpdateListing(listing);
            console.log('Update result:', result);
            if (result.success) {
                showNotification('Listing updated successfully!', 'success');
                updateListingOnPage(listing);
            } else {
                showNotification(result.message || 'Error updating listing', 'error');
            }
        } else {
            // Create new listing
            console.log('Creating new listing:', listing);
            result = await window.firebaseCreateListing(listing);
            console.log('Create result:', result);
            if (result.success) {
                showNotification('Listing added successfully!', 'success');
                listing.product_id = result.id;
                addListingToPage(listing);
            } else {
                showNotification(result.message || 'Error adding listing', 'error');
            }
        }
        
        if (result.success) {
            // Wait a moment for UI to update before closing modal
            setTimeout(() => {
                closeListingModal();
                // Clear the form after successful save
                form.reset();
            }, 300);
        }
    } catch (err) {
        console.error('Error saving listing:', err);
        showNotification('An unexpected error occurred: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

async function deleteListing(listingId) {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    
    try {
        const result = await window.firebaseDeleteListing(listingId);
        if (result.success) {
            showNotification('Listing deleted successfully!', 'success');
            removeListingFromPage(listingId);
        } else {
            showNotification(result.message || 'Error deleting listing', 'error');
        }
    } catch (err) {
        console.error('Error deleting listing', err);
        showNotification('An unexpected error occurred', 'error');
    }
}

function addListingToPage(listing) {
    const container = document.getElementById('listings-container');
    if (!container) return;
    
    const card = createListingCard(listing);
    container.insertAdjacentHTML('afterbegin', card);
}

function updateListingOnPage(listing) {
    const card = document.querySelector(`[data-listing-id="${listing.product_id}"]`);
    if (card) {
        card.outerHTML = createListingCard(listing);
    }
}

function removeListingFromPage(listingId) {
    const card = document.querySelector(`[data-listing-id="${listingId}"]`);
    if (card) {
        card.remove();
    }
}

function createListingCard(listing) {
    const seller = {
        name: sessionStorage.getItem('FullName') || sessionStorage.getItem('Username') || 'Unknown Seller',
        username: sessionStorage.getItem('Username') || ''
    };
    
    return `
        <div class="listing-card-minimal" 
             id="listing-${listing.product_id}"
             data-listing-id="${listing.product_id}"
             data-title="${escapeHtml(listing.title)}"
             data-description="${escapeHtml(listing.description)}"
             data-price="${listing.price}"
             data-category="${escapeHtml(listing.category)}"
             data-condition="${escapeHtml(listing.condition)}"
             data-imageUrl="${escapeHtml(listing.imageUrl)}">
            
            <!-- Product Image -->
            <div class="product-image-wrapper">
                <img src="${escapeHtml(listing.imageUrl)}" 
                     alt="${escapeHtml(listing.title)}" 
                     class="product-image"
                     onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop'">
                
                <!-- Condition Badge -->
                <span class="condition-badge badge-${listing.condition.replace(/\s+/g, '-').toLowerCase()}">
                    ${escapeHtml(listing.condition)}
                </span>
            </div>
            
            <!-- Product Info -->
            <div class="product-info">
                <h3 class="product-title">${escapeHtml(listing.title)}</h3>
                <p class="product-description">${escapeHtml(listing.description)}</p>
                
                <!-- Price & Category -->
                <div class="price-category">
                    <span class="product-price">₱${listing.price.toFixed(2)}</span>
                    <span class="product-category">${escapeHtml(listing.category)}</span>
                </div>
                
                <!-- Seller Info -->
                <div class="seller-info mt-2">
                    <small class="text-muted">Posted by <strong>${escapeHtml(seller.name)}</strong></small>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="product-actions">
                <button class="btn-edit" onclick="openListingModal('${listing.product_id}')">
                    <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn-delete" onclick="deleteListing('${listing.product_id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Find or create notification container
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.position = 'fixed';
        container.style.top = '100px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.maxWidth = '500px';
        document.body.appendChild(container);
    }
    
    container.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
