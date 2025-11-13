# Seller Products Fetch Functions Documentation

## Overview
A complete seller products management system has been implemented, including client-side Firebase functions and a seller profile page with product management capabilities.

---

## Firebase Client Functions (wwwroot/js/firebase-client.js)

### 1. **firebaseFetchSellerProducts(sellerUserId)**
Fetches all products posted by a specific seller.

**Parameters:**
- `sellerUserId` (string): The Firebase user ID of the seller

**Returns:**
```javascript
{
  success: boolean,
  products: Array<Product>,
  count: number,
  message?: string // error message if failed
}
```

**Usage:**
```javascript
const result = await window.firebaseFetchSellerProducts('user123');
if (result.success) {
  console.log(`Found ${result.count} products:`, result.products);
}
```

---

### 2. **firebaseFetchAllProducts()**
Fetches all active products from the entire marketplace.

**Parameters:** None

**Returns:**
```javascript
{
  success: boolean,
  products: Array<Product>,
  count: number,
  message?: string // error message if failed
}
```

**Usage:**
```javascript
const result = await window.firebaseFetchAllProducts();
if (result.success) {
  const allProducts = result.products;
}
```

---

### 3. **firebaseFetchProductById(productId)**
Fetches a single product by its Firestore document ID.

**Parameters:**
- `productId` (string): The Firestore document ID

**Returns:**
```javascript
{
  success: boolean,
  product?: {
    id: string,
    title: string,
    description: string,
    price: number,
    category: string,
    condition: string,
    imageUrl: string,
    user_id: string,
    is_active: boolean,
    [key: string]: any
  },
  message?: string // error message if failed
}
```

**Usage:**
```javascript
const result = await window.firebaseFetchProductById('doc_id_123');
if (result.success) {
  console.log('Product:', result.product);
}
```

---

### 4. **firebaseFetchProductsByCategory(category)**
Fetches all active products in a specific category.

**Parameters:**
- `category` (string): Product category (e.g., "Electronics", "Fashion")

**Returns:**
```javascript
{
  success: boolean,
  products: Array<Product>,
  count: number,
  message?: string // error message if failed
}
```

**Usage:**
```javascript
const result = await window.firebaseFetchProductsByCategory('Electronics');
if (result.success) {
  const electronics = result.products;
}
```

---

## SellerProductsManager Class (wwwroot/js/seller-products.js)

A comprehensive class for managing seller products on the client side.

### **Constructor**
```javascript
const manager = window.sellerProductsManager;
// Global instance already initialized
```

---

### **Methods**

#### **fetchSellerProducts(sellerUserId)**
Fetches and stores all products for a seller.

**Parameters:**
- `sellerUserId` (string): Seller's Firebase user ID

**Returns:** `Promise<Array<Product>>`

**Usage:**
```javascript
const products = await manager.fetchSellerProducts('seller_id');
```

---

#### **fetchAllProducts()**
Fetches all marketplace products.

**Returns:** `Promise<Array<Product>>`

**Usage:**
```javascript
const allProducts = await manager.fetchAllProducts();
```

---

#### **fetchProductsByCategory(category)**
Fetches products by category.

**Parameters:**
- `category` (string): Product category

**Returns:** `Promise<Array<Product>>`

**Usage:**
```javascript
const electronics = await manager.fetchProductsByCategory('Electronics');
```

---

#### **fetchProductById(productId)**
Fetches a single product by ID.

**Parameters:**
- `productId` (string): Product Firestore document ID

**Returns:** `Promise<Product|null>`

**Usage:**
```javascript
const product = await manager.fetchProductById('doc_123');
```

---

#### **getSellerProducts()**
Returns currently loaded seller products (no network call).

**Returns:** `Array<Product>`

**Usage:**
```javascript
const cached = manager.getSellerProducts();
```

---

#### **filterProducts(searchTerm)**
Filters loaded products by search term (title or description).

**Parameters:**
- `searchTerm` (string): Search query

**Returns:** `Array<Product>`

**Usage:**
```javascript
const filtered = manager.filterProducts('iPhone');
```

---

#### **sortByPrice(products, order)**
Sorts products by price.

**Parameters:**
- `products` (Array): Products to sort (default: loaded products)
- `order` (string): 'asc' or 'desc'

**Returns:** `Array<Product>`

**Usage:**
```javascript
const sorted = manager.sortByPrice(undefined, 'asc');
```

---

#### **sortByDate(products, order)**
Sorts products by creation date.

**Parameters:**
- `products` (Array): Products to sort
- `order` (string): 'newest' or 'oldest'

**Returns:** `Array<Product>`

**Usage:**
```javascript
const newest = manager.sortByDate(undefined, 'newest');
```

---

#### **getConditionStats()**
Returns count of products by condition.

**Returns:** 
```javascript
{
  New: number,
  'Like New': number,
  Good: number,
  Fair: number
}
```

**Usage:**
```javascript
const stats = manager.getConditionStats();
console.log(`${stats.New} items in New condition`);
```

---

#### **getCategoryStats()**
Returns count of products by category.

**Returns:** `{ [category: string]: number }`

**Usage:**
```javascript
const categories = manager.getCategoryStats();
```

---

#### **clearProducts()**
Clears all loaded products from memory.

**Usage:**
```javascript
manager.clearProducts();
```

---

## Views & Routes

### **Browse Page** (`/Home/Browse`)
- Displays all marketplace products in a Carousell-style grid
- Features search and category filtering
- Shows seller information on each listing
- Clickable seller links to view profiles

### **Seller Profile Page** (`/Home/SellerProfile`)
- Displays seller information and avatar
- Shows all products posted by the seller
- Features sorting (newest, price: low-to-high, price: high-to-low)
- Shows product statistics

**URL Parameters:**
- `id`: Seller's Firebase user ID (required)
- `name`: Seller's full name (optional)
- `username`: Seller's username (optional)

**Example:**
```
/Home/SellerProfile?id=user123&name=John%20Doe&username=johndoe
```

---

## Model Updates

### **Listing Model** (`Models/Listing.cs`)
Added seller tracking properties:
```csharp
public string SellerUsername { get; set; }
public string SellerFullName { get; set; }
public string SellerUserId { get; set; }
```

---

## Controller Updates

### **HomeController** (`Controllers/HomeController.cs`)

#### **CreateListing()**
Updated to capture seller info from session:
```csharp
listing.SellerUsername = HttpContext.Session.GetString("Username") ?? "Anonymous";
listing.SellerFullName = HttpContext.Session.GetString("FullName") ?? "Unknown";
listing.SellerUserId = HttpContext.Session.GetString("UserId") ?? "";
```

#### **Browse()**
```csharp
public IActionResult Browse()
{
    return View(_listings.Where(l => l.IsActive).ToList());
}
```

#### **SellerProfile()**
```csharp
public IActionResult SellerProfile()
{
    return View();
}
```

---

## Firestore Collection Structure

Products are stored in the `tbl_listing` collection with the following fields:

```
{
  product_id: string,
  title: string,
  description: string,
  price: number,
  category: string,
  condition: string,
  imageUrl: string,
  user_id: string,           // Seller's ID
  username: string,           // Seller's username
  full_name: string,          // Seller's full name
  is_active: boolean,
  date_created: timestamp
}
```

---

## Complete Usage Example

### Displaying a Seller's Products

```javascript
// 1. Fetch seller products
const sellerId = 'user123';
const products = await window.sellerProductsManager.fetchSellerProducts(sellerId);

// 2. Get statistics
const stats = manager.getConditionStats();
const categories = manager.getCategoryStats();

// 3. Filter and sort
const filtered = manager.filterProducts('iPhone');
const sorted = manager.sortByPrice(filtered, 'asc');

// 4. Display in UI
sorted.forEach(product => {
  console.log(`${product.title} - $${product.price}`);
});
```

### Browsing All Products

```javascript
// Get all marketplace products
const all = await window.sellerProductsManager.fetchAllProducts();

// Filter by category
const electronics = all.filter(p => p.category === 'Electronics');

// Sort by newest
const newest = manager.sortByDate(electronics, 'newest');
```

### Searching Products

```javascript
// Fetch all products
await manager.fetchAllProducts();

// Search for items
const results = manager.filterProducts('laptop');
console.log(`Found ${results.length} matching items`);
```

---

## Error Handling

All functions return a `success` boolean. Always check this before accessing results:

```javascript
const result = await window.firebaseFetchSellerProducts(sellerId);
if (!result.success) {
  console.error('Error:', result.message);
  // Handle error
} else {
  // Use result.products
}
```

---

## Performance Notes

- **Caching**: SellerProductsManager caches loaded products in memory
- **Filtering**: Local filtering is fast and doesn't require network calls
- **Firebase Queries**: Queries are optimized with proper `where()` clauses
- **Inactive Products**: Automatically filtered out (where `is_active !== false`)

---

## Integration with Browse & SellerProfile Pages

Both pages leverage these functions:

1. **Browse Page**
   - Uses `firebaseFetchAllProducts()` to populate the grid
   - Links to `/Home/SellerProfile?id={userId}` on seller click

2. **Seller Profile Page**
   - Uses `firebaseFetchSellerProducts()` to load seller's products
   - Supports sorting and filtering
   - Displays seller statistics

---

## Future Enhancements

Potential additions:
- Product reviews and ratings
- Seller verification badges
- Search history and recommendations
- Product comparison feature
- Saved/wishlist functionality
- Advanced filtering (price range, condition, date posted)

