// Seller Products Manager
// Handles fetching and displaying seller products

class SellerProductsManager {
  constructor() {
    this.currentSellerUserId = null;
    this.sellerProducts = [];
    this.isLoading = false;
  }

  /**
   * Fetch all products for a specific seller
   * @param {string} sellerUserId - The Firebase user ID of the seller
   * @returns {Promise<Array>} Array of products
   */
  async fetchSellerProducts(sellerUserId) {
    if (!sellerUserId) {
      console.error('Seller user ID is required');
      return [];
    }

    this.isLoading = true;
    this.currentSellerUserId = sellerUserId;

    try {
      if (typeof window.firebaseFetchSellerProducts !== 'function') {
        console.error('Firebase fetch function not available');
        return [];
      }

      const result = await window.firebaseFetchSellerProducts(sellerUserId);

      if (result.success) {
        this.sellerProducts = result.products || [];
        console.log(`Loaded ${this.sellerProducts.length} products for seller ${sellerUserId}`);
        return this.sellerProducts;
      } else {
        console.error('Failed to fetch seller products:', result.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching seller products:', error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Fetch all products from the marketplace
   * @returns {Promise<Array>} Array of all active products
   */
  async fetchAllProducts() {
    this.isLoading = true;

    try {
      if (typeof window.firebaseFetchAllProducts !== 'function') {
        console.error('Firebase fetch function not available');
        return [];
      }

      const result = await window.firebaseFetchAllProducts();

      if (result.success) {
        console.log(`Loaded ${result.count} total products from marketplace`);
        return result.products || [];
      } else {
        console.error('Failed to fetch all products:', result.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching all products:', error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Fetch products by category
   * @param {string} category - Product category
   * @returns {Promise<Array>} Array of products in that category
   */
  async fetchProductsByCategory(category) {
    this.isLoading = true;

    try {
      if (typeof window.firebaseFetchProductsByCategory !== 'function') {
        console.error('Firebase fetch function not available');
        return [];
      }

      const result = await window.firebaseFetchProductsByCategory(category);

      if (result.success) {
        console.log(`Loaded ${result.count} products in category: ${category}`);
        return result.products || [];
      } else {
        console.error('Failed to fetch products by category:', result.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching products by category:', error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Fetch a single product by ID
   * @param {string} productId - The Firestore document ID
   * @returns {Promise<Object|null>} Product object or null
   */
  async fetchProductById(productId) {
    try {
      if (typeof window.firebaseFetchProductById !== 'function') {
        console.error('Firebase fetch function not available');
        return null;
      }

      const result = await window.firebaseFetchProductById(productId);

      if (result.success) {
        console.log('Loaded product:', result.product);
        return result.product;
      } else {
        console.error('Failed to fetch product:', result.message);
        return null;
      }
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      return null;
    }
  }

  /**
   * Get currently loaded seller products
   * @returns {Array} Array of seller products
   */
  getSellerProducts() {
    return this.sellerProducts || [];
  }

  /**
   * Filter seller products by search term
   * @param {string} searchTerm - Search term
   * @returns {Array} Filtered products
   */
  filterProducts(searchTerm) {
    if (!searchTerm) {
      return this.sellerProducts;
    }

    const term = searchTerm.toLowerCase();
    return this.sellerProducts.filter(product => {
      const title = (product.title || '').toLowerCase();
      const description = (product.description || '').toLowerCase();
      return title.includes(term) || description.includes(term);
    });
  }

  /**
   * Sort products by price
   * @param {Array} products - Products to sort
   * @param {string} order - 'asc' for ascending, 'desc' for descending
   * @returns {Array} Sorted products
   */
  sortByPrice(products = this.sellerProducts, order = 'asc') {
    const sorted = [...products];
    return sorted.sort((a, b) => {
      const priceA = parseFloat(a.price) || 0;
      const priceB = parseFloat(b.price) || 0;
      return order === 'asc' ? priceA - priceB : priceB - priceA;
    });
  }

  /**
   * Sort products by date
   * @param {Array} products - Products to sort
   * @param {string} order - 'newest' or 'oldest'
   * @returns {Array} Sorted products
   */
  sortByDate(products = this.sellerProducts, order = 'newest') {
    const sorted = [...products];
    return sorted.sort((a, b) => {
      const dateA = new Date(a.date_created || a.createdDate || 0).getTime();
      const dateB = new Date(b.date_created || b.createdDate || 0).getTime();
      return order === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }

  /**
   * Get product count by condition
   * @returns {Object} Count of products by condition
   */
  getConditionStats() {
    const stats = {
      New: 0,
      'Like New': 0,
      Good: 0,
      Fair: 0
    };

    this.sellerProducts.forEach(product => {
      const condition = product.condition || 'Unknown';
      if (condition in stats) {
        stats[condition]++;
      }
    });

    return stats;
  }

  /**
   * Get product count by category
   * @returns {Object} Count of products by category
   */
  getCategoryStats() {
    const stats = {};

    this.sellerProducts.forEach(product => {
      const category = product.category || 'Uncategorized';
      stats[category] = (stats[category] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear loaded products
   */
  clearProducts() {
    this.sellerProducts = [];
    this.currentSellerUserId = null;
  }
}

// Create global instance
window.sellerProductsManager = new SellerProductsManager();

// In non-module scripts, expose class on window for reuse
window.SellerProductsManager = SellerProductsManager;
