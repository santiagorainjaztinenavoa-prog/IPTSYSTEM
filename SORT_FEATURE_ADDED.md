# ? Sort Feature Added to Browse Page

## What Was Added

Added a **Sort dropdown** to the Browse page that allows users to sort listings by:

1. **Newest First** (default) - Shows most recently added items first
2. **Price: Low to High** - Cheapest items first
3. **Price: High to Low** - Most expensive items first

---

## How to Implement

### **Step 1: Add Sort Dropdown to HTML**

In `IPTSYSTEM/Views/Home/Browse.cshtml`, add this after the Category filter:

```html
<!-- Sort Filter -->
<div class="filter-container">
    <select id="sortFilter" class="filter-select" onchange="applyFilters()">
        <option value="newest" selected>Newest First</option>
        <option value="price-low">Price: Low to High</option>
        <option value="price-high">Price: High to Low</option>
    </select>
</div>
```

---

### **Step 2: Update JavaScript**

Add these functions to the `@section Scripts` in Browse.cshtml:

```javascript
// 1. Update applyFilters() to include sortBy
function applyFilters(updateUrl = true) {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const sortBy = document.getElementById('sortFilter').value; // ? ADD THIS

    let filtered = (allProducts || []).filter(p => {
        const title = (p.title ?? p.Title ?? '').toString().toLowerCase();
        const description = (p.description ?? p.Description ?? '').toString().toLowerCase();
        const cat = (p.category ?? p.Category ?? '').toString();

        const matchesQuery = !q || title.includes(q) || description.includes(q);
        const matchesCategory = !category || category === '' || cat.toLowerCase() === category.toLowerCase();

        return matchesQuery && matchesCategory;
    });

    // Apply sorting ? ADD THIS
    filtered = sortProducts(filtered, sortBy);

    displayProducts(filtered);

    if (updateUrl) {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (category) params.set('category', category);
        if (sortBy && sortBy !== 'newest') params.set('sort', sortBy); // ? ADD THIS
        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        history.replaceState(null, '', newUrl);
    }
}

// 2. Add sortProducts function
function sortProducts(products, sortBy) {
    const sorted = [...products];
    
    switch(sortBy) {
        case 'price-low':
            // Price: Low to High
            sorted.sort((a, b) => {
                const priceA = parseFloat(a.price ?? a.Price ?? 0);
                const priceB = parseFloat(b.price ?? b.Price ?? 0);
                return priceA - priceB;
            });
            break;
            
        case 'price-high':
            // Price: High to Low
            sorted.sort((a, b) => {
                const priceA = parseFloat(a.price ?? a.Price ?? 0);
                const priceB = parseFloat(b.price ?? b.Price ?? 0);
                return priceB - priceA;
            });
            break;
            
        case 'newest':
        default:
            // Newest First (default)
            sorted.sort((a, b) => {
                const dateA = getProductDate(a);
                const dateB = getProductDate(b);
                return dateB - dateA; // Newer first
            });
            break;
    }
    
    return sorted;
}

// 3. Add getProductDate helper function
function getProductDate(product) {
    const dateCreated = product.date_created ?? product.DateCreated ?? product.dateCreated;
    
    if (!dateCreated) return new Date(0); // Very old date if no date
    
    // Handle Firestore timestamp
    if (dateCreated.seconds) {
        return new Date(dateCreated.seconds * 1000);
    }
    
    // Handle regular date
    return new Date(dateCreated);
}
```

---

## How It Works

1. **User selects sort option** ? `onchange` triggers `applyFilters()`
2. **applyFilters()** gets the selected sort value
3. **Calls sortProducts()** which sorts the filtered array
4. **displayProducts()** shows the sorted results
5. **URL updates** with `?sort=price-low` (optional, for bookmarking)

---

## Example Usage

### **Newest First (Default)**
- Shows items ordered by `date_created` descending
- Most recent items appear first

### **Price: Low to High**
- ?100 item appears before ?1000 item
- Great for bargain hunters

### **Price: High to Low**
- ?10000 item appears before ?100 item
- Shows premium items first

---

## Testing

1. **Go to Browse page**
2. **Select "Price: Low to High"**
   - Verify cheapest items show first
3. **Select "Price: High to Low"**
   - Verify expensive items show first
4. **Select "Newest First"**
   - Verify recent items show first
5. **Combine with search/category**
   - Filter by "Electronics" + Sort by "Price: Low to High"
   - Should work together

---

## Benefits

? **Better user experience** - Find what you want faster  
? **No page reload** - Instant client-side sorting  
? **Works with filters** - Combines with search and category  
? **Bookmarkable** - URL includes sort parameter  
? **Mobile friendly** - Dropdown works on all devices  

---

## Files to Modify

?? **IPTSYSTEM/Views/Home/Browse.cshtml**
- Add sort dropdown HTML (line ~39, after category filter)
- Add sort JavaScript functions (in `@section Scripts`)

---

**Status**: Ready to implement  
**Difficulty**: Easy  
**Time**: 5 minutes
