// ========== LISTINGS MANAGER - ENHANCED CRUD OPERATIONS ==========

let listingModal;
let toastNotification;

document.addEventListener('DOMContentLoaded', function () {
    // Initialize Bootstrap components
    const modalEl = document.getElementById('listingModal');
    const toastEl = document.getElementById('toastNotification');
    
    if (modalEl) {
        listingModal = new bootstrap.Modal(modalEl);
    }
    
    if (toastEl) {
 toastNotification = new bootstrap.Toast(toastEl);
    }
    
    // Initialize form event listeners
    initializeFormListeners();
    
    // Initialize image upload
    initializeImageUpload();
    
    // Note: loadListingsFromFirebase() is called from the Mylisting.cshtml view
    // after sessionStorage is properly populated
});

// ========== IMAGE UPLOAD FUNCTIONALITY ==========

function initializeImageUpload() {
    const imagePreviewArea = document.getElementById('imagePreviewArea');
    const imageFileInput = document.getElementById('imageFileInput');
    const imageUrlInput = document.getElementById('imageUrlInput');
    
    if (!imagePreviewArea || !imageFileInput) return;
    
    // Click to upload
    imagePreviewArea.addEventListener('click', function() {
  imageFileInput.click();
    });
    
    // File selection
    imageFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
    if (file) {
        handleImageFile(file);
        }
    });
    
    // Drag and drop events
    imagePreviewArea.addEventListener('dragover', function(e) {
   e.preventDefault();
        e.stopPropagation();
 this.classList.add('drag-over');
    });
    
    imagePreviewArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
    });
    
    imagePreviewArea.addEventListener('drop', function(e) {
        e.preventDefault();
    e.stopPropagation();
        this.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
       const file = files[0];
      if (file.type.startsWith('image/')) {
         imageFileInput.files = files;
    handleImageFile(file);
            } else {
           showToast('Please upload an image file', 'warning');
            }
        }
    });
    
    // URL input alternative
    if (imageUrlInput) {
        imageUrlInput.addEventListener('input', debounce(function() {
            const url = this.value.trim();
  if (url) {
      updateImagePreview(url);
    }
        }, 500));
    }
}

function handleImageFile(file) {
    // Validate file type
if (!file.type.startsWith('image/')) {
  showToast('Please select an image file', 'warning');
      return;
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
 showToast('Image size must be less than 10MB', 'warning');
        return;
    }
    
    // Read and preview the image
 const reader = new FileReader();
    
    reader.onload = function(e) {
        const imageUrl = e.target.result;
        updateImagePreview(imageUrl);
        
        // Store the base64 image in the hidden field
      document.getElementById('imageUrl').value = imageUrl;
    };
    
    reader.onerror = function() {
        showToast('Failed to read image file', 'error');
    };
    
reader.readAsDataURL(file);
}

function updateImagePreview(imageUrl) {
    const imagePreview = document.getElementById('imagePreview');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const removeBtn = document.getElementById('removeImageBtn');
    const imagePreviewArea = document.getElementById('imagePreviewArea');
    
    if (!imagePreview || !uploadPlaceholder || !removeBtn) return;
    
    // Update preview image
    imagePreview.src = imageUrl;
    imagePreview.classList.add('show');
    imagePreview.style.display = 'block';

    // Hide placeholder
    uploadPlaceholder.style.display = 'none';
    
    // Show remove button
    removeBtn.classList.add('show');
    removeBtn.style.display = 'flex';
    
    // Add has-image class
    imagePreviewArea.classList.add('has-image');
    
    // Handle image load error
    imagePreview.onerror = function() {
        showToast('Failed to load image', 'warning');
    resetImagePreview();
    };
    
    // Store URL in hidden field if not already base64
    if (!imageUrl.startsWith('data:')) {
        document.getElementById('imageUrl').value = imageUrl;
  }
}

function removeImage() {
    resetImagePreview();
    
    // Clear file input
    const imageFileInput = document.getElementById('imageFileInput');
    if (imageFileInput) {
        imageFileInput.value = '';
    }
    
    // Clear URL input
    const imageUrlInput = document.getElementById('imageUrlInput');
    if (imageUrlInput) {
        imageUrlInput.value = '';
    }
    
    // Clear hidden field
    document.getElementById('imageUrl').value = '';
}

function resetImagePreview() {
  const imagePreview = document.getElementById('imagePreview');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const removeBtn = document.getElementById('removeImageBtn');
    const imagePreviewArea = document.getElementById('imagePreviewArea');
    
    if (!imagePreview || !uploadPlaceholder || !removeBtn) return;
    
    // Hide preview image
    imagePreview.src = '';
    imagePreview.classList.remove('show');
    imagePreview.style.display = 'none';
    
    // Show placeholder
    uploadPlaceholder.style.display = 'block';
    
    // Hide remove button
    removeBtn.classList.remove('show');
    removeBtn.style.display = 'none';
    
    // Remove has-image class
    imagePreviewArea.classList.remove('has-image');
}

// ========== MODAL MANAGEMENT ==========

// Open modal for creating new listing
function openListingModal() {
    const form = document.getElementById('listingForm');
    const modalTitle = document.getElementById('modalTitle');
  const saveButtonText = document.getElementById('saveButtonText');
    
    if (modalTitle) modalTitle.textContent = 'Add New Listing';
    if (saveButtonText) saveButtonText.textContent = 'Save Listing';
 
    if (form) form.reset();
    
    // Reset hidden ID field
 const listingIdField = document.getElementById('listingId');
    if (listingIdField) listingIdField.value = '0';

    // Reset image preview
    resetImagePreview();
    
    // Clear form validation states
 clearValidationStates();
    
    if (listingModal) listingModal.show();
}

// Edit existing listing
async function editListing(id) {
    try {
showLoadingState();
      
 // For Firebase listings, fetch from Firestore
        if (typeof window.firebaseFetchProductById === 'function') {
            const result = await window.firebaseFetchProductById(id);
            
            if (!result.success) {
                throw new Error('Failed to fetch listing from Firebase');
            }
            
            const listing = result.product;
            
            // Update modal title
            const modalTitle = document.getElementById('modalTitle');
            const saveButtonText = document.getElementById('saveButtonText');
            
            if (modalTitle) modalTitle.textContent = 'Edit Listing';
            if (saveButtonText) saveButtonText.textContent = 'Update Listing';
            
            // Populate form fields
            populateForm(listing);
            
            // Show preview image
            if (listing.imageUrl) {
                updateImagePreview(listing.imageUrl);
            }
            
            hideLoadingState();
            
            if (listingModal) listingModal.show();
        } else {
            // Fall back to server-side fetch
            const response = await fetch(`/Home/GetListing?id=${id}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch listing details');
            }
            
            const listing = await response.json();
            
            // Update modal title
            const modalTitle = document.getElementById('modalTitle');
            const saveButtonText = document.getElementById('saveButtonText');
            
            if (modalTitle) modalTitle.textContent = 'Edit Listing';
            if (saveButtonText) saveButtonText.textContent = 'Update Listing';
            
            // Populate form fields
            populateForm(listing);
            
            // Show preview image
            if (listing.imageUrl) {
                updateImagePreview(listing.imageUrl);
            }
            
            hideLoadingState();
            
            if (listingModal) listingModal.show();
        }
        
    } catch (error) {
     hideLoadingState();
        showToast('Error loading listing: ' + error.message, 'error');
   console.error('Edit listing error:', error);
    }
}

// Populate form with listing data
function populateForm(listing) {
    // Set all form fields (handle both server and Firebase formats)
    setFieldValue('listingId', listing.id || listing.Id || listing.product_id || '');
 setFieldValue('title', listing.title || listing.Title || '');
    setFieldValue('description', listing.description || listing.Description || '');
    setFieldValue('price', listing.price || listing.Price || 0);
    setFieldValue('category', listing.category || listing.Category || '');
    
    // Set condition radio button
    const condition = listing.condition || listing.Condition || '';
    const conditionInput = document.querySelector(`input[name="condition"][value="${condition}"]`);
    if (conditionInput) {
   conditionInput.checked = true;
    }
}

// Helper to set field value safely
function setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
  if (field && value !== null && value !== undefined) {
        field.value = value;
    }
}

// ========== SAVE LISTING (CREATE/UPDATE) ==========

async function saveListing() {
    const form = document.getElementById('listingForm');
    
    // Validate form
    if (!validateForm(form)) {
        showToast('Please fill in all required fields correctly', 'warning');
        return;
    }
    
    // Get form data
    const listingData = getFormData();
    
    // Validate listing data
    if (!listingData) {
      showToast('Please check your form data', 'error');
        return;
    }
 
try {
  // Show loading state
        showSaveLoadingState();
  
    // Determine if creating or updating
   const isUpdate = listingData.id > 0;
  const url = isUpdate ? '/Home/UpdateListing' : '/Home/CreateListing';
        const actionText = isUpdate ? 'updated' : 'created';
        
   // Send request
    const response = await fetch(url, {
   method: 'POST',
        headers: {
          'Content-Type': 'application/json',
 },
            body: JSON.stringify(listingData)
   });
      
   if (!response.ok) {
        throw new Error(`Failed to ${actionText} listing`);
        }
 
        const result = await response.json();
        
hideSaveLoadingState();
      
        if (result.success) {
            showToast(`Listing ${actionText} successfully!`, 'success');
      
            // Mirror data into Firestore (if client Firebase helpers are available)
            // Do this BEFORE closing/reloading
            try {
                if (typeof window.firebaseCreateListing === 'function') {
                    // For create action, server returns `listing` object; for update, use listingData
                    const serverListing = result.listing || listingData;
                    const fbPayload = {
                        id: serverListing.id ?? serverListing.Id ?? listingData.id,
                        title: serverListing.title ?? serverListing.Title ?? listingData.title,
                        description: serverListing.description ?? serverListing.Description ?? listingData.description,
                        price: serverListing.price ?? serverListing.Price ?? listingData.price,
                        category: serverListing.category ?? serverListing.Category ?? listingData.category,
                        condition: serverListing.condition ?? serverListing.Condition ?? listingData.condition,
                        imageUrl: serverListing.imageUrl ?? serverListing.ImageUrl ?? listingData.imageUrl
                    };

                    console.log('🔥 Syncing to Firestore:', fbPayload);
                    
                    if (isUpdate && typeof window.firebaseUpdateListing === 'function') {
                        const updateResult = await window.firebaseUpdateListing(fbPayload);
                        console.log('🔥 Firestore update result:', updateResult);
                        if (!updateResult.success) {
                            console.error('⚠️ Firestore update failed, but server update succeeded');
                        }
                    } else if (!isUpdate && typeof window.firebaseCreateListing === 'function') {
                        const createResult = await window.firebaseCreateListing(fbPayload);
                        console.log('🔥 Firestore create result:', createResult);
                        if (!createResult.success) {
                            console.error('⚠️ Firestore create failed, but server create succeeded');
                        }
                    }
                }
            } catch (e) {
                console.error('❌ Firestore mirroring error:', e);
                // Continue anyway - the listing was saved on the server
            }
      
            // Close modal
            if (listingModal) listingModal.hide();
      
            // Reload page after a short delay to show the toast and allow Firestore to complete
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showToast(result.message || `Failed to ${actionText} listing`, 'error');
        }
        
  } catch (error) {
        hideSaveLoadingState();
        showToast('Error saving listing: ' + error.message, 'error');
        console.error('Save listing error:', error);
    }
}

// Get form data as object
function getFormData() {
    try {
     const listingId = parseInt(document.getElementById('listingId')?.value || '0');
      const title = document.getElementById('title')?.value?.trim();
     const description = document.getElementById('description')?.value?.trim();
        const price = parseFloat(document.getElementById('price')?.value || '0');
        const category = document.getElementById('category')?.value;
    const imageUrl = document.getElementById('imageUrl')?.value?.trim();
    
        // Get selected condition
        const conditionInput = document.querySelector('input[name="condition"]:checked');
        const condition = conditionInput?.value;
      
// Validate required fields
    if (!title || !description || !category || !condition) {
            return null;
        }
 
      return {
   id: listingId,
       title: title,
description: description,
      price: price,
    category: category,
     condition: condition,
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop'
  };
    } catch (error) {
        console.error('Error getting form data:', error);
        return null;
    }
}

// Validate form
function validateForm(form) {
    if (!form) return false;
    
    // Use HTML5 validation
    if (!form.checkValidity()) {
        form.reportValidity();
  return false;
    }
    
    // Additional custom validation
    const price = parseFloat(document.getElementById('price')?.value || '0');
    if (price < 0) {
    showToast('Price must be a positive number', 'warning');
      return false;
    }
  
    // Check if condition is selected
    const conditionSelected = document.querySelector('input[name="condition"]:checked');
  if (!conditionSelected) {
showToast('Please select a condition', 'warning');
    return false;
    }

    return true;
}

// ========== DELETE LISTING ==========

function deleteListing(id, title) {
    // Create a better confirmation dialog
  const confirmMessage = `Are you sure you want to delete "${title}"?\n\nThis action cannot be undone.`;
    
if (confirm(confirmMessage)) {
   performDelete(id, title);
    }
}

// Perform the actual delete operation
async function performDelete(id, title) {
    try {
        // Delete from Firestore first
        if (typeof window.firebaseDeleteListing === 'function') {
            console.log('🔥 Deleting from Firestore for listing ID:', id);
            const deleteResult = await window.firebaseDeleteListing(id);
            console.log('🔥 Firestore delete result:', deleteResult);
            
            if (!deleteResult.success) {
                showToast('Failed to delete listing from database', 'error');
                return;
            }
        }
        
        showToast(`"${title}" deleted successfully!`, 'success');
        
        // Animate card removal
        const card = document.getElementById(`listing-${id}`);
        if (card) {
            // Add fade-out animation
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            card.style.transition = 'all 0.4s ease';
            
            // Remove card after animation
            setTimeout(() => {
                card.remove();
                
                // Check if there are no more listings
                const container = document.getElementById('listings-container');
                if (container && container.children.length === 0) {
                    // Reload to show empty state
                    setTimeout(() => window.location.reload(), 300);
                }
            }, 400);
        }
        
    } catch (error) {
        showToast('Error deleting listing: ' + error.message, 'error');
        console.error('Delete listing error:', error);
    }
}

// ========== FORM LISTENERS ==========

function initializeFormListeners() {
    // Character counters
    initCharacterCounter('title', 'titleCounter', 100);
    initCharacterCounter('description', 'descCounter', 500);
    
    // Form submission on Enter (except textarea)
    const form = document.getElementById('listingForm');
    if (form) {
        form.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
     e.preventDefault();
       saveListing();
        }
        });
    }
}

function initCharacterCounter(inputId, counterId, maxLength) {
 const input = document.getElementById(inputId);
 const counter = document.getElementById(counterId);
    
    if (input && counter) {
        input.addEventListener('input', function() {
      const length = this.value.length;
  counter.textContent = length;
     
            // Change color if near limit
   if (length > maxLength * 0.9) {
   counter.style.color = '#ef4444';
            } else {
           counter.style.color = '#6b7280';
   }
        });
    }
}

// ========== UTILITY FUNCTIONS ==========

function showToast(message, type = 'success') {
    const toastEl = document.getElementById('toastNotification');
  const toastBody = document.getElementById('toastMessage');
    
    if (!toastEl || !toastBody) return;
    
    toastBody.textContent = message;
    
    // Set toast color based on type
    toastEl.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning', 'text-bg-info');
    
    switch(type) {
        case 'success':
            toastEl.classList.add('text-bg-success');
       break;
    case 'error':
 toastEl.classList.add('text-bg-danger');
    break;
   case 'warning':
       toastEl.classList.add('text-bg-warning');
            break;
        default:
toastEl.classList.add('text-bg-info');
    }
    
    if (toastNotification) {
     toastNotification.show();
    }
}

function showLoadingState() {
    console.log('Loading...');
}

function hideLoadingState() {
    console.log('Loading complete');
}

function showSaveLoadingState() {
    const saveBtn = document.getElementById('saveButtonText');
    if (saveBtn) {
   saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    }
}

function hideSaveLoadingState() {
    const saveBtn = document.getElementById('saveButtonText');
    if (saveBtn) {
  saveBtn.textContent = 'Save Listing';
    }
}

function clearValidationStates() {
    const form = document.getElementById('listingForm');
    if (form) {
 const inputs = form.querySelectorAll('.is-invalid, .is-valid');
   inputs.forEach(input => {
   input.classList.remove('is-invalid', 'is-valid');
        });
    }
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
        clearTimeout(timeout);
      func(...args);
     };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
};
}

// ========== FIREBASE LISTINGS LOADING ==========

async function loadListingsFromFirebase() {
    try {
        // Get current user ID from session storage
        let userId = sessionStorage.getItem('UserId');
        const username = sessionStorage.getItem('Username');
        const fullName = sessionStorage.getItem('FullName');
        const userType = sessionStorage.getItem('UserType');
        
        console.log('🔄 loadListingsFromFirebase called');
        console.log('   userId:', userId);
        console.log('   username:', username);
        console.log('   fullName:', fullName);
        console.log('   userType:', userType);
        
        // Try multiple fallback options for userId
        if (!userId || userId === '') {
            if (fullName && fullName !== '') {
                userId = fullName;
                console.log('⚠️  No UserId, using fullName as fallback:', userId);
            } else if (username && username !== '') {
                userId = username;
                console.log('⚠️  No UserId, using username as fallback:', userId);
            } else {
                console.log('⚠️  No user ID, username, or fullName in session');
                // Still try to load, Firebase will return empty
                userId = 'unknown-user';
            }
        }
        
        // Wait for Firebase to be ready
        if (typeof window.firebaseFetchSellerProducts !== 'function') {
            console.log('⏳ Firebase not ready, will retry in 500ms');
            setTimeout(loadListingsFromFirebase, 500);
            return;
        }
        
        console.log('✅ Firebase ready, fetching seller products for user:', userId);
        
        // Fetch seller's products from Firestore
        const result = await window.firebaseFetchSellerProducts(userId);
        
        console.log('📦 Firebase result:', result);
        
        if (!result.success) {
            console.error('❌ Failed to load listings from Firebase:', result.message);
            return;
        }
        
        // Get the container
        const container = document.getElementById('listings-container');
        if (!container) {
            console.error('❌ listings-container not found in DOM');
            return;
        }
        
        const products = result.products || [];
        
        console.log('📊 Loaded', products.length, 'products from Firebase');
        console.log('Product data sample:', products.length > 0 ? products[0] : 'No products');
        
        if (products.length === 0) {
            // Show empty state with option to create first listing
            container.innerHTML = `
                <div class="empty-state-minimal">
                    <i class="bi bi-inbox"></i>
                    <h3>No listings yet</h3>
                    <p>Create your first listing to get started!</p>
                    <button class="btn-add-new" onclick="openListingModal()">
                        <i class="bi bi-plus-circle me-2"></i>
                        Add Your First Listing
                    </button>
                </div>
            `;
            
            // Also try to load from server for migration purposes
            console.log('🔄 No Firebase products, attempting to load from server for display...');
            try {
                const serverListings = await fetch('/Home/GetUserListings').then(r => r.json()).catch(() => ({ listings: [] }));
                if (serverListings.listings && serverListings.listings.length > 0) {
                    console.log('📚 Found', serverListings.listings.length, 'server listings');
                    // Could display these if needed, but for now keep empty state
                }
            } catch (e) {
                console.log('ℹ️  Server listing load skipped');
            }
            return;
        }
        
        // Build the HTML for all products
        const html = products.map(product => `
            <div class="listing-card-minimal" id="listing-${product.id}" data-category="${product.category || ''}" data-condition="${product.condition || ''}" data-price="${product.price || 0}" data-title="${product.title || ''}">
                <!-- Product Image -->
                <div class="product-image-wrapper">
                    <img src="${product.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop'}" alt="${product.title || 'Product'}" class="product-image" onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop'">
                    <!-- Condition Badge -->
                    <span class="condition-badge badge-${(product.condition || 'new').replace(' ', '-').toLowerCase()}">
                        ${product.condition || 'New'}
                    </span>
                </div>
                
                <!-- Product Info -->
                <div class="product-info">
                    <h3 class="product-title">${product.title || 'Untitled'}</h3>
                    <p class="product-description">${product.description || ''}</p>
                    
                    <!-- Price & Category -->
                    <div class="product-meta">
                        <span class="product-price">₱${product.price || 0}</span>
                        <span class="product-category">${product.category || 'Uncategorized'}</span>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="product-actions">
                        ${userType === 'seller' ? `
                            <button class="btn-action btn-edit-minimal" onclick="editListing('${product.id}')" title="Edit">
                                <i class="bi bi-pencil"></i>
                                Edit
                            </button>
                            <button class="btn-action btn-delete-minimal" onclick="deleteListing('${product.id}', '${escapeHtml(product.title || 'Listing')}')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : `
                            <button class="btn-action btn-buy-minimal animate__animated animate__pulse" onclick="buyProduct('${product.id}')" title="Buy" style="background:#10b981;color:#fff;font-weight:600;">
                                <i class="bi bi-bag-check"></i>
                                Buy
                            </button>
                            <button class="btn-action btn-message-minimal animate__animated animate__pulse" onclick="messageSeller('${product.id}')" title="Message Seller" style="background:#2563eb;color:#fff;font-weight:600;">
                                <i class="bi bi-chat-dots"></i>
                                Message Seller
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
        console.log('✅ Successfully rendered', products.length, 'listings');
        
    } catch (error) {
        console.error('❌ Error loading listings from Firebase:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally accessible
window.openListingModal = openListingModal;
window.editListing = editListing;
window.saveListing = saveListing;
window.deleteListing = deleteListing;
window.removeImage = removeImage;
