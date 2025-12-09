// ========== ENHANCED LISTINGS FEATURES ==========
// Additional features that complement listings-manager.js

let quickViewModal;

document.addEventListener('DOMContentLoaded', function () {
    // Initialize quick view modal if it exists
    const quickViewEl = document.getElementById('quickViewModal');
    if (quickViewEl) {
 quickViewModal = new bootstrap.Modal(quickViewEl);
    }
});

// ========== QUICK VIEW ==========

async function quickView(id) {
    try {
        const response = await fetch(`/Home/GetListing?id=${id}`);
   if (!response.ok) throw new Error('Failed to load listing');
        
      const listing = await response.json();
        
        const quickViewContent = document.getElementById('quickViewContent');
        if (quickViewContent) {
            quickViewContent.innerHTML = `
       <div class="row g-4">
       <div class="col-md-6">
             <img src="${listing.imageUrl}" 
   class="img-fluid rounded" 
     alt="${listing.title}" 
        onerror="this.src='https://via.placeholder.com/500x500/e0e7ff/6366f1?text=No+Image'"
            style="width: 100%; object-fit: cover;">
</div>
                <div class="col-md-6">
          <h3 class="mb-3">${listing.title}</h3>
             <div class="mb-3">
           <span class="badge ${getBadgeClass(listing.condition)}">${listing.condition}</span>
        <span class="badge bg-secondary ms-2">${listing.category}</span>
  </div>
    <h4 class="mb-3" style="color: #f43f5e; font-weight: 700;">$${listing.price}</h4>
      <p class="text-muted mb-4">${listing.description}</p>
  <div class="d-flex gap-2">
  <button class="btn btn-dark" onclick="closeQuickViewAndEdit(${id})">
      <i class="bi bi-pencil me-2"></i>Edit
     </button>
 <button class="btn btn-outline-danger" onclick="closeQuickViewAndDelete(${id}, '${escapeHtml(listing.title)}')">
     <i class="bi bi-trash me-2"></i>Delete
  </button>
 </div>
 </div>
    </div>
    `;
        }
        
        if (quickViewModal) {
  quickViewModal.show();
        }
    } catch (error) {
        console.error('Quick view error:', error);
   if (window.showToast) {
            window.showToast('Error loading listing details', 'error');
        }
    }
}

function closeQuickViewAndEdit(id) {
    if (quickViewModal) quickViewModal.hide();
  setTimeout(() => {
 if (window.editListing) window.editListing(id);
    }, 300);
}

function closeQuickViewAndDelete(id, title) {
    if (quickViewModal) quickViewModal.hide();
    setTimeout(() => {
     if (window.deleteListing) window.deleteListing(id, title);
 }, 300);
}

// ========== DUPLICATE LISTING ==========

async function duplicateListing(id) {
    try {
        const response = await fetch(`/Home/GetListing?id=${id}`);
    if (!response.ok) throw new Error('Failed to load listing');
        
        const listing = await response.json();
        
        // Populate modal with duplicated data
        const modalTitle = document.getElementById('modalTitle');
        const saveButtonText = document.getElementById('saveButtonText');
        
        if (modalTitle) modalTitle.textContent = 'Duplicate Listing';
        if (saveButtonText) saveButtonText.textContent = 'Create Copy';
  
  // Set form fields
 const listingIdField = document.getElementById('listingId');
      if (listingIdField) listingIdField.value = '0';
        
     const titleField = document.getElementById('title');
        if (titleField) titleField.value = listing.title + ' (Copy)';
        
      const descField = document.getElementById('description');
        if (descField) descField.value = listing.description;
 
        const priceField = document.getElementById('price');
        if (priceField) priceField.value = listing.price;
  
  const categoryField = document.getElementById('category');
        if (categoryField) categoryField.value = listing.category;
        
        const imageUrlField = document.getElementById('imageUrl');
        if (imageUrlField) {
         imageUrlField.value = listing.imageUrl;
        }

        // Set condition radio button
        const conditionInput = document.querySelector(`input[name="condition"][value="${listing.condition}"]`);
     if (conditionInput) {
            conditionInput.checked = true;
        }
        
        // Update image preview
        if (window.previewImage) {
   window.previewImage();
        }

        // Show modal
    if (window.listingModal) {
            window.listingModal.show();
     }
        
        if (window.showToast) {
            window.showToast('Listing duplicated! Edit and save to create a copy.', 'success');
  }
    } catch (error) {
        console.error('Duplicate listing error:', error);
        if (window.showToast) {
    window.showToast('Error duplicating listing: ' + error.message, 'error');
        }
    }
}

// ========== UTILITY FUNCTIONS ==========

function getBadgeClass(condition) {
    const conditionLower = condition.toLowerCase().replace(' ', '-');
    return `condition-badge badge-${conditionLower}`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
    '>': '&gt;',
      '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Make functions globally available
window.quickView = quickView;
window.duplicateListing = duplicateListing;
window.closeQuickViewAndEdit = closeQuickViewAndEdit;
window.closeQuickViewAndDelete = closeQuickViewAndDelete;
