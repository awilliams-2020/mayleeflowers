// API Configuration is loaded from config.js
// Make sure to update config.js with your API credentials

// Application State
let cart = [];
let cartId = null;
let allProducts = []; // Store all products for filtering
let currentCategory = 'all'; // Current selected category
let currentPage = 1; // Current page number
let itemsPerPage = 12; // Items per page (default from API)
let totalProducts = 0; // Total products available

// Stepper state
let currentStep = 1;
const totalSteps = 4;

// Cart persistence using localStorage
const CART_ID_KEY = 'florist_cart_id';

function getCartIdFromStorage() {
    return localStorage.getItem(CART_ID_KEY);
}

function saveCartIdToStorage(id) {
    if (id) {
        localStorage.setItem(CART_ID_KEY, id);
    } else {
        localStorage.removeItem(CART_ID_KEY);
    }
}

// URL Parameter Management
function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        category: params.get('category') || 'all',
        page: parseInt(params.get('page')) || 1
    };
}

function updateURLParams(category = null, page = null) {
    const params = new URLSearchParams(window.location.search);
    
    if (category !== null) {
        if (category === 'all') {
            params.delete('category');
        } else {
            params.set('category', category);
        }
    }
    
    if (page !== null) {
        if (page === 1) {
            params.delete('page');
        } else {
            params.set('page', page.toString());
        }
    }
    
    // Update URL without page reload
    const newURL = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
    
    window.history.pushState({ category, page }, '', newURL);
}

function restoreStateFromURL() {
    const urlParams = getURLParams();
    currentCategory = urlParams.category;
    currentPage = urlParams.page;
    
    // Update active category button
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === currentCategory) {
            btn.classList.add('active');
        }
    });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
    restoreStateFromURL();
    loadProducts(currentCategory);
});

async function initializeApp() {
    // Restore state from URL first
    restoreStateFromURL();
    
    setupEventListeners();
    setupCategoryFilters();
    
    // Load cart from API if cartId exists
    const savedCartId = getCartIdFromStorage();
    if (savedCartId) {
        cartId = savedCartId;
        await loadCartFromAPI();
    } else {
        // Create a new cart
        await createCart();
        // If cart creation failed, try again or continue without cart
        if (!cartId) {
            console.warn('Initial cart creation failed, will retry on first add to cart');
        }
    }
    
    // Update cart display to set initial checkout button state
    updateCartDisplay();
    
    loadProducts();
}

function setupEventListeners() {
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.getElementById('closeCart').addEventListener('click', closeCart);
    document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
    document.getElementById('closeCheckout').addEventListener('click', closeCheckout);
    document.getElementById('closeProductDetail').addEventListener('click', closeProductDetail);
    document.getElementById('checkoutForm').addEventListener('submit', handleCheckout);
    document.getElementById('overlay').addEventListener('click', () => {
        closeCart();
        closeCheckout();
        closeProductDetail();
    });
}

// Setup category filter buttons
function setupCategoryFilters() {
    // Expand first section (All Products) by default on mobile
    const firstSection = document.querySelector('.filter-section');
    if (firstSection) {
        firstSection.classList.add('active');
        const firstContent = firstSection.querySelector('.filter-section-content');
        if (firstContent) {
            firstContent.classList.remove('collapsed');
        }
    }
    
    // Setup collapsible filter sections for mobile
    const filterHeaders = document.querySelectorAll('.filter-section-header');
    filterHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.filter-section');
            const content = section.querySelector('.filter-section-content');
            
            // Toggle active class on section
            section.classList.toggle('active');
            
            // Toggle collapsed class on content
            content.classList.toggle('collapsed');
        });
    });
    
    // Setup category button clicks
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent section toggle when clicking button
            
            // Remove active class from all buttons
            categoryButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Get category from data attribute
            const category = btn.getAttribute('data-category');
            currentCategory = category;
            currentPage = 1; // Reset to first page when changing category
            
            // Update URL parameters
            updateURLParams(category, 1);
            
            // Load products with new category filter (server-side filtering)
            loadProducts(category);
        });
    });
    
    // Setup pagination controls
    setupPagination();
}

// Setup pagination event listeners
function setupPagination() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateURLParams(null, currentPage);
            loadProducts(currentCategory);
            // Scroll to top of products
            document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(totalProducts / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateURLParams(null, currentPage);
            loadProducts(currentCategory);
            // Scroll to top of products
            document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
        }
    });
}

// Update pagination UI
function updatePagination() {
    const paginationEl = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const paginationText = document.getElementById('paginationText');
    const pageNumbersEl = document.getElementById('pageNumbers');
    
    if (totalProducts === 0) {
        paginationEl.classList.add('hidden');
        return;
    }
    
    paginationEl.classList.remove('hidden');
    
    const totalPages = Math.ceil(totalProducts / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalProducts);
    
    // Update pagination text
    paginationText.textContent = `Showing ${startItem}-${endItem} of ${totalProducts} products`;
    
    // Update button states
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage >= totalPages;
    
    // Update page numbers
    pageNumbersEl.innerHTML = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'page-number-btn';
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            updateURLParams(null, currentPage);
            loadProducts(currentCategory);
            document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
        });
        pageNumbersEl.appendChild(pageBtn);
    }
}

// API Helper Functions
// Now calls the backend API server instead of the external API directly
async function apiCall(endpoint, method = 'GET', body = null) {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}

// Product Functions
async function loadProducts(category = null, count = null, start = null) {
    try {
        showLoading();
        
        // Use state values if not provided
        const selectedCategory = category !== null ? category : currentCategory;
        const pageCount = count !== null ? count : itemsPerPage;
        const pageStart = start !== null ? start : ((currentPage - 1) * itemsPerPage + 1);
        
        // Update category if provided
        if (category !== null) {
            currentCategory = category;
        }
        
        // Build query string
        const params = new URLSearchParams();
        if (selectedCategory && selectedCategory !== 'all') {
            params.append('category', selectedCategory);
        }
        params.append('count', pageCount.toString());
        params.append('start', pageStart.toString());
        
        const queryString = params.toString();
        const endpoint = queryString ? `/products?${queryString}` : '/products';
        
        // Get products from backend API
        const products = await apiCall(endpoint);
        
        hideLoading();
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        hideLoading();
        showError();
        
        // Fallback: Display sample products if API fails
        displaySampleProducts();
    }
}

function displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    const noProductsEl = document.getElementById('noProducts');
    productsGrid.innerHTML = '';

    // Handle different response formats and ensure we have an array
    let productList = [];
    
    if (Array.isArray(products)) {
        productList = products;
    } else if (products && Array.isArray(products.PRODUCTS)) {
        // Florist One API uses uppercase PRODUCTS
        productList = products.PRODUCTS;
    } else if (products && Array.isArray(products.products)) {
        productList = products.products;
    } else if (products && Array.isArray(products.product)) {
        productList = products.product;
    } else if (products && products.error) {
        // API returned an error
        console.error('API Error:', products.error, products.message);
        productsGrid.innerHTML = '<p>Error loading products. Please check your API credentials.</p>';
        document.getElementById('products').classList.remove('hidden');
        return;
    }

    const paginationEl = document.getElementById('pagination');
    
    if (productList.length === 0) {
        productsGrid.style.display = 'none';
        noProductsEl.classList.remove('hidden');
        paginationEl.classList.add('hidden');
        document.getElementById('products').classList.remove('hidden');
        return;
    }

    // Store products (for reference, but filtering is now server-side)
    allProducts = productList;
    
    // Update total if available from API response
    if (products.TOTAL) {
        totalProducts = products.TOTAL;
    } else if (totalProducts === 0) {
        // Fallback: use current list length if no total provided
        totalProducts = productList.length;
    }
    
    // Display products directly (already filtered by API)
    productsGrid.style.display = 'grid';
    noProductsEl.classList.add('hidden');
    
    productList.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
    
    // Update pagination
    updatePagination();
    
    document.getElementById('products').classList.remove('hidden');
}

// Note: Client-side filtering removed - filtering now done server-side via API calls

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';

    // Handle both uppercase (API) and lowercase field names
    const productId = product.CODE || product.code || product.productcode || product.id || '';
    const productName = product.NAME || product.name || product.productname || 'Beautiful Bouquet';
    const productPrice = product.PRICE || product.price || product.baseprice || '49.99';
    const productDescription = product.DESCRIPTION || product.description || product.longdescription || 'A beautiful arrangement perfect for any occasion.';
    const productImage = product.SMALL || product.LARGE || product.EXTRALARGE || product.image || product.imageurl || '';

    card.innerHTML = `
        <div class="product-image">
            ${productImage ? `<img src="${productImage}" alt="${productName}">` : '🌸'}
        </div>
        <div class="product-info">
            <h3 class="product-name">${productName}</h3>
            <div class="product-price">$${parseFloat(productPrice).toFixed(2)}</div>
            <p class="product-description">${productDescription.substring(0, 100)}${productDescription.length > 100 ? '...' : ''}</p>
            <button class="add-to-cart-btn" data-product-id="${productId}" data-product-name="${productName}" data-product-price="${productPrice}">
                Add to Cart
            </button>
        </div>
    `;

    // Add click handler to card (excluding the button)
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking the add to cart button
        if (!e.target.closest('.add-to-cart-btn')) {
            openProductDetail(productId);
        }
    });

    card.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click
        addToCart({
            id: productId,
            name: productName,
            price: productPrice,
            image: productImage
        });
    });

    return card;
}

// Product Detail Functions
async function openProductDetail(productCode) {
    if (!productCode) return;
    
    const detailModal = document.getElementById('productDetail');
    const detailContent = document.getElementById('productDetailContent');
    const overlay = document.getElementById('overlay');
    
    detailModal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    detailContent.innerHTML = '<div class="product-detail-loading">Loading product details...</div>';
    
    try {
        const product = await apiCall(`/products/${productCode}`);
        
        // Handle response format
        let productData = null;
        if (product.PRODUCTS && product.PRODUCTS.length > 0) {
            productData = product.PRODUCTS[0];
        } else if (product.products && product.products.length > 0) {
            productData = product.products[0];
        } else if (product.product) {
            productData = product.product;
        } else if (Array.isArray(product) && product.length > 0) {
            productData = product[0];
        }
        
        if (!productData) {
            throw new Error('Product not found');
        }
        
        displayProductDetail(productData);
    } catch (error) {
        console.error('Error loading product detail:', error);
        detailContent.innerHTML = `
            <div class="product-detail-error">
                <p>Error loading product details.</p>
                <p style="font-size: 0.9em; color: #666;">${error.message}</p>
            </div>
        `;
    }
}

function displayProductDetail(product) {
    const detailContent = document.getElementById('productDetailContent');
    const detailName = document.getElementById('detailProductName');
    
    const productCode = product.CODE || product.code || '';
    const productName = product.NAME || product.name || 'Beautiful Bouquet';
    const productPrice = product.PRICE || product.price || '49.99';
    const productDescription = product.DESCRIPTION || product.description || 'A beautiful arrangement perfect for any occasion.';
    const productImage = product.EXTRALARGE || product.LARGE || product.SMALL || product.image || '';
    const productDimension = product.DIMENSION || product.dimension || '';
    const productCategories = product.CATEGORIES || product.categories || [];
    
    detailName.textContent = productName;
    
    let categoriesHtml = '';
    if (productCategories.length > 0) {
        categoriesHtml = `
            <div class="product-detail-categories">
                <strong>Categories:</strong>
                ${productCategories.map(cat => {
                    const display = cat.DISPLAY || cat.display || cat.CATEGORY || cat.category || '';
                    return `<span class="category-tag">${display}</span>`;
                }).join('')}
            </div>
        `;
    }
    
    detailContent.innerHTML = `
        <div class="product-detail-main">
            <div class="product-detail-image">
                ${productImage ? `<img src="${productImage}" alt="${productName}">` : '<div class="no-image">🌸</div>'}
            </div>
            <div class="product-detail-info">
                <h2 class="product-detail-title">${productName}</h2>
                <div class="product-detail-price">$${parseFloat(productPrice).toFixed(2)}</div>
                ${productDimension ? `<div class="product-detail-dimension"><strong>Dimensions:</strong> ${productDimension}</div>` : ''}
                ${categoriesHtml}
                <div class="product-detail-description">
                    <strong>Description:</strong>
                    <p>${productDescription}</p>
                </div>
                <button class="add-to-cart-btn detail-add-to-cart" data-product-id="${productCode}" data-product-name="${productName}" data-product-price="${productPrice}">
                    Add to Cart
                </button>
            </div>
        </div>
    `;
    
    // Add event listener for add to cart button
    const addToCartBtn = detailContent.querySelector('.detail-add-to-cart');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            addToCart({
                id: productCode,
                name: productName,
                price: productPrice,
                image: productImage
            });
            showNotification(`${productName} added to cart!`);
        });
    }
}

function closeProductDetail() {
    document.getElementById('productDetail').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
}

function displaySampleProducts() {
    const sampleProducts = [
        {
            id: '1',
            name: 'Red Rose Bouquet',
            price: '59.99',
            description: 'A classic arrangement of 12 red roses, perfect for expressing your love.'
        },
        {
            id: '2',
            name: 'Mixed Spring Flowers',
            price: '49.99',
            description: 'A vibrant mix of seasonal flowers that will brighten any room.'
        },
        {
            id: '3',
            name: 'Lily Arrangement',
            price: '69.99',
            description: 'Elegant white lilies arranged beautifully in a glass vase.'
        },
        {
            id: '4',
            name: 'Sunflower Bouquet',
            price: '39.99',
            description: 'Cheerful sunflowers that bring sunshine to any occasion.'
        }
    ];

    displayProducts(sampleProducts);
}

// Cart API Functions
async function createCart() {
    try {
        const response = await apiCall('/cart/create', 'POST');
        
        // Handle different possible response formats
        // Florist One API returns SESSIONID for cart creation
        const newCartId = response.SESSIONID || response.sessionid || response.sessionId ||
                         response.CARTID || response.cartid || response.CART_ID || 
                         response.CART?.CARTID || response.cart?.cartid ||
                         response.cartId || response.cart_id;
        
        if (newCartId) {
            cartId = newCartId;
            saveCartIdToStorage(cartId);
            return true;
        } else {
            console.error('Cart creation response missing cartId/sessionId:', response);
            return false;
        }
    } catch (error) {
        console.error('Error creating cart:', error);
        return false;
    }
}

async function loadCartFromAPI() {
    if (!cartId) {
        // Ensure cart count is updated even if no cartId
        updateCartDisplay();
        return;
    }
    
    try {
        const response = await apiCall(`/cart?cartId=${cartId}`);
        
        // Parse cart items from API response
        // The response format may vary, so we handle different structures
        let items = [];
        
        // Check for products array (Florist One API format)
        if (response.products && Array.isArray(response.products)) {
            items = response.products.map(item => ({
                id: item.CODE || item.code || item.PRODUCTCODE || item.productcode,
                name: item.NAME || item.name || item.PRODUCTNAME || item.productname || 'Product',
                price: parseFloat(item.PRICE || item.price || item.BASEPRICE || item.baseprice || 0),
                quantity: parseInt(item.QUANTITY || item.quantity || 1),
                image: item.SMALL || item.LARGE || item.EXTRALARGE || item.image || item.imageurl || ''
            }));
        }
        // Check for uppercase ITEMS array
        else if (response.ITEMS && Array.isArray(response.ITEMS)) {
            items = response.ITEMS.map(item => ({
                id: item.CODE || item.code || item.PRODUCTCODE || item.productcode,
                name: item.NAME || item.name || item.PRODUCTNAME || item.productname || 'Product',
                price: parseFloat(item.PRICE || item.price || item.BASEPRICE || item.baseprice || 0),
                quantity: parseInt(item.QUANTITY || item.quantity || 1),
                image: item.SMALL || item.LARGE || item.EXTRALARGE || item.image || item.imageurl || ''
            }));
        } 
        // Check for lowercase items array
        else if (response.items && Array.isArray(response.items)) {
            items = response.items.map(item => ({
                id: item.code || item.productCode,
                name: item.name || item.productName || 'Product',
                price: parseFloat(item.price || item.basePrice || 0),
                quantity: parseInt(item.quantity || 1),
                image: item.image || item.imageUrl || item.small || item.large || ''
            }));
        }
        // Check if response itself is an array
        else if (Array.isArray(response)) {
            items = response.map(item => ({
                id: item.CODE || item.code || item.PRODUCTCODE || item.productcode,
                name: item.NAME || item.name || item.PRODUCTNAME || item.productname || 'Product',
                price: parseFloat(item.PRICE || item.price || item.BASEPRICE || item.baseprice || 0),
                quantity: parseInt(item.QUANTITY || item.quantity || 1),
                image: item.SMALL || item.LARGE || item.EXTRALARGE || item.image || item.imageurl || ''
            }));
        }
        else {
            console.warn('Unexpected cart response structure:', response);
        }
        
        // Fetch product details for items missing images
        const itemsWithImages = await Promise.all(items.map(async (item) => {
            // If item already has an image, return as-is
            if (item.image) {
                return item;
            }
            
            // Fetch product details to get image
            try {
                const productResponse = await apiCall(`/products/${item.id}`);
                let productData = null;
                
                if (productResponse.PRODUCTS && productResponse.PRODUCTS.length > 0) {
                    productData = productResponse.PRODUCTS[0];
                } else if (productResponse.products && productResponse.products.length > 0) {
                    productData = productResponse.products[0];
                } else if (productResponse.PRODUCT) {
                    productData = productResponse.PRODUCT;
                } else if (productResponse.product) {
                    productData = productResponse.product;
                }
                
                if (productData) {
                    // Update image from product data
                    item.image = productData.SMALL || productData.LARGE || productData.EXTRALARGE || 
                                 productData.small || productData.large || productData.extralarge || 
                                 productData.image || productData.imageurl || '';
                }
            } catch (error) {
                console.warn(`Failed to fetch product details for ${item.id}:`, error);
                // Continue with item without image
            }
            
            return item;
        }));
        
        cart = itemsWithImages;
        
        updateCartDisplay();
    } catch (error) {
        console.error('Error loading cart:', error);
        // If cart doesn't exist (404 or 500), remove the session ID
        if (error.message && (error.message.includes('404') || error.message.includes('500') || error.message.includes('Failed'))) {
            cartId = null;
            cart = [];
            saveCartIdToStorage(null);
        }
        // Always update display, even on error
        updateCartDisplay();
    }
}

async function addToCart(product) {
    if (!cartId) {
        const created = await createCart();
        if (!created || !cartId) {
            console.error('Failed to create cart');
            showNotification('Error: Could not add item to cart. Please try again.');
            return;
        }
    }
    
    try {
        // Add item to cart via API
        // Note: product.id should be the product CODE from the API
        // Ensure we're using the correct product code format
        const productCode = product.id;
        
        if (!productCode) {
            showNotification('Error: Product code is missing');
            return;
        }
        
        const response = await apiCall('/cart', 'PUT', {
            cartId: cartId,
            code: productCode
            // Price is not sent - API gets it from product catalog
        });
        
        // Add to local cart array for immediate UI update
        const existingItemIndex = cart.findIndex(item => item.id === product.id);
        if (existingItemIndex >= 0) {
            cart[existingItemIndex].quantity = (cart[existingItemIndex].quantity || 1) + 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                quantity: 1,
                image: product.image || ''
            });
        }
        
        updateCartDisplay();
        showNotification(`${product.name} added to cart!`);
    } catch (error) {
        console.error('Error adding item to cart:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error: Could not add item to cart';
        if (error.message && error.message.includes('500')) {
            errorMessage = `Unable to add "${product.name}" to cart. The product may not be available for purchase or there was a server error.`;
        } else if (error.message && error.message.includes('404')) {
            errorMessage = 'Product or cart not found. Please refresh and try again.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message.substring(0, 100)}`;
        }
        
        showNotification(errorMessage);
    }
}

async function removeFromCart(index) {
    if (!cartId || index < 0 || index >= cart.length) return;
    
    const item = cart[index];
    
    try {
        // Remove item from cart via API
        await apiCall('/cart', 'PUT', {
            cartId: cartId,
            code: item.id,
            action: 'remove'
        });
        
        // Remove from local cart array
        cart.splice(index, 1);
        updateCartDisplay();
    } catch (error) {
        console.error('Error removing item from cart:', error);
        // Still update UI even if API call fails
        cart.splice(index, 1);
        updateCartDisplay();
    }
}

async function clearCart() {
    if (!cartId) return;
    
    try {
        await apiCall('/cart', 'PUT', {
            cartId: cartId,
            action: 'clear'
        });
        
        cart = [];
        updateCartDisplay();
    } catch (error) {
        console.error('Error clearing cart:', error);
    }
}

async function destroyCart() {
    if (!cartId) return;
    
    try {
        await apiCall(`/cart?cartId=${cartId}`, 'DELETE');
        cartId = null;
        cart = [];
        saveCartIdToStorage(null);
        updateCartDisplay();
    } catch (error) {
        console.error('Error destroying cart:', error);
    }
}

function updateCartDisplay() {
    const cartCount = document.getElementById('cartCount');
    // Calculate total items including quantities
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    // Update cart count in header
    if (cartCount) {
        cartCount.textContent = totalItems;
    } else {
        console.warn('cartCount element not found');
    }

    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (cart.length === 0) {
        if (cartItems) {
            cartItems.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        }
        if (cartTotal) {
            cartTotal.textContent = '0.00';
        }
        // Disable checkout button when cart is empty
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.classList.add('disabled');
        }
        return;
    }
    
    // Enable checkout button when cart has items
    if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove('disabled');
    }

    cartItems.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const quantity = item.quantity || 1;
        const itemTotal = item.price * quantity;
        total += itemTotal;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        const itemImage = item.image || '';
        const imageHtml = itemImage 
            ? `<div class="cart-item-image"><img src="${itemImage}" alt="${item.name}"></div>`
            : '<div class="cart-item-image"><div class="cart-item-image-placeholder">🌸</div></div>';
        
        cartItem.innerHTML = `
            ${imageHtml}
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}${quantity > 1 ? ` <span class="cart-item-quantity">(x${quantity})</span>` : ''}</div>
                <div class="cart-item-price">$${itemTotal.toFixed(2)}</div>
            </div>
            <button class="remove-item-btn" data-index="${index}">Remove</button>
        `;

        cartItem.querySelector('.remove-item-btn').addEventListener('click', () => {
            removeFromCart(index);
        });

        cartItems.appendChild(cartItem);
    });

    cartTotal.textContent = total.toFixed(2);
}

function openCart() {
    document.getElementById('cart').classList.remove('hidden');
    document.getElementById('overlay').classList.remove('hidden');
    updateCartDisplay();
}

function closeCart() {
    document.getElementById('cart').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
}

// Checkout Functions
let checkoutEventListenersAdded = false;

function openCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    closeCart();
    document.getElementById('checkout').classList.remove('hidden');
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('checkoutForm').style.display = 'block';
    document.getElementById('orderConfirmation').classList.add('hidden');
    
    // Reset to step 1
    currentStep = 1;
    updateStepper();
    renderCartReview();

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('deliveryDate').setAttribute('min', today);
    
    // Add event listeners only once
    if (!checkoutEventListenersAdded) {
        setupCheckoutEventListeners();
        setupStepperNavigation();
        checkoutEventListenersAdded = true;
    }
    
    // Reset status messages
    document.getElementById('deliveryDateStatus').style.display = 'none';
    document.getElementById('dateAvailability').style.display = 'none';
    document.getElementById('orderTotal').style.display = 'none';
}

// Debounce helper function
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

// Stepper Functions
function updateStepper() {
    // Update progress bar
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
    const progressBar = document.getElementById('stepperProgressBar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    
    // Update step indicators
    document.querySelectorAll('.stepper-step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        if (stepNum < currentStep) {
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });
    
    // Show/hide steps
    document.querySelectorAll('.checkout-step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active');
        if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const submitBtn = document.getElementById('submitOrderBtn');
    
    if (prevBtn) {
        prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
    }
    
    if (currentStep === totalSteps) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'block';
    } else {
        if (nextBtn) nextBtn.style.display = 'block';
        if (submitBtn) submitBtn.style.display = 'none';
    }
    
    // Calculate order total on step 4
    if (currentStep === 4) {
        calculateOrderTotal();
    }
}

function setupStepperNavigation() {
    const nextBtn = document.getElementById('nextStepBtn');
    const prevBtn = document.getElementById('prevStepBtn');
    const closeConfirmationBtn = document.getElementById('closeConfirmation');
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (validateCurrentStep()) {
                currentStep++;
                updateStepper();
            }
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentStep--;
            updateStepper();
        });
    }
    
    if (closeConfirmationBtn) {
        closeConfirmationBtn.addEventListener('click', () => {
            closeCheckout();
        });
    }
}

function validateCurrentStep() {
    const step = document.querySelector(`.checkout-step[data-step="${currentStep}"]`);
    if (!step) return true;
    
    // Clear previous error messages
    step.querySelectorAll('.field-error').forEach(error => error.remove());
    
    const requiredFields = step.querySelectorAll('input[required], textarea[required]');
    let isValid = true;
    const invalidFields = [];
    
    requiredFields.forEach(field => {
        const fieldGroup = field.closest('.form-group');
        const fieldLabel = fieldGroup ? fieldGroup.querySelector('label') : null;
        const labelText = fieldLabel ? fieldLabel.textContent : field.placeholder || 'This field';
        
        // Remove previous error styling
        field.classList.remove('field-invalid');
        field.style.borderColor = '';
        
        if (!field.value.trim()) {
            isValid = false;
            invalidFields.push(labelText);
            
            // Add error styling
            field.classList.add('field-invalid');
            field.style.borderColor = '#f44336';
            
            // Create and show error message
            const errorMsg = document.createElement('div');
            errorMsg.className = 'field-error';
            errorMsg.textContent = `${labelText} is required`;
            errorMsg.style.color = '#f44336';
            errorMsg.style.fontSize = '0.875rem';
            errorMsg.style.marginTop = '0.25rem';
            
            // Insert error message after the field
            if (fieldGroup) {
                fieldGroup.appendChild(errorMsg);
            } else {
                field.parentNode.insertBefore(errorMsg, field.nextSibling);
            }
        }
    });
    
    // Special validation for step 3 (delivery)
    if (currentStep === 3) {
        const zipcode = document.getElementById('deliveryZip');
        const date = document.getElementById('deliveryDate');
        
        if (zipcode) {
            const zipcodeGroup = zipcode.closest('.form-group');
            const zipcodeLabel = zipcodeGroup ? zipcodeGroup.querySelector('label') : null;
            const zipcodeLabelText = zipcodeLabel ? zipcodeLabel.textContent : 'ZIP Code';
            
            if (!zipcode.value.trim() || zipcode.value.trim().length < 5) {
                isValid = false;
                zipcode.classList.add('field-invalid');
                zipcode.style.borderColor = '#f44336';
                
                // Remove existing error if any
                const existingError = zipcodeGroup.querySelector('.field-error');
                if (existingError) existingError.remove();
                
                const errorMsg = document.createElement('div');
                errorMsg.className = 'field-error';
                errorMsg.textContent = 'Please enter a valid ZIP code (5 digits)';
                errorMsg.style.color = '#f44336';
                errorMsg.style.fontSize = '0.875rem';
                errorMsg.style.marginTop = '0.25rem';
                
                if (zipcodeGroup) {
                    zipcodeGroup.appendChild(errorMsg);
                }
            }
        }
        
        if (date) {
            const dateGroup = date.closest('.form-group');
            const dateLabel = dateGroup ? dateGroup.querySelector('label') : null;
            const dateLabelText = dateLabel ? dateLabel.textContent : 'Delivery Date';
            
            if (!date.value) {
                isValid = false;
                date.classList.add('field-invalid');
                date.style.borderColor = '#f44336';
                
                // Remove existing error if any
                const existingError = dateGroup.querySelector('.field-error');
                if (existingError) existingError.remove();
                
                const errorMsg = document.createElement('div');
                errorMsg.className = 'field-error';
                errorMsg.textContent = 'Please select a delivery date';
                errorMsg.style.color = '#f44336';
                errorMsg.style.fontSize = '0.875rem';
                errorMsg.style.marginTop = '0.25rem';
                
                if (dateGroup) {
                    dateGroup.appendChild(errorMsg);
                }
            }
        }
    }
    
    // Scroll to first invalid field if validation fails
    if (!isValid) {
        const firstInvalidField = step.querySelector('.field-invalid');
        if (firstInvalidField) {
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalidField.focus();
        }
    }
    
    return isValid;
}

function renderCartReview() {
    const reviewContainer = document.getElementById('checkoutCartReview');
    if (!reviewContainer) return;
    
    if (cart.length === 0) {
        reviewContainer.innerHTML = '<p>Your cart is empty</p>';
        return;
    }
    
    let total = 0;
    const itemsHtml = cart.map((item, index) => {
        const quantity = item.quantity || 1;
        const itemTotal = item.price * quantity;
        total += itemTotal;
        
        const itemImage = item.image || '';
        const imageHtml = itemImage 
            ? `<img src="${itemImage}" alt="${item.name}" class="checkout-cart-item-image">`
            : '<div class="checkout-cart-item-image" style="display: flex; align-items: center; justify-content: center; background: #f0f0f0; color: #999;">🌸</div>';
        
        return `
            <div class="checkout-cart-item">
                ${imageHtml}
                <div class="checkout-cart-item-info">
                    <div class="checkout-cart-item-name">${item.name}</div>
                    <div class="checkout-cart-item-details">Quantity: ${quantity}</div>
                    <div class="checkout-cart-item-price">$${itemTotal.toFixed(2)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    reviewContainer.innerHTML = `
        ${itemsHtml}
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 1.2em; font-weight: 600;">
            <span>Total:</span>
            <span style="color: var(--primary-color);">$${total.toFixed(2)}</span>
        </div>
    `;
}

function setupCheckoutEventListeners() {
    const deliveryZipInput = document.getElementById('deliveryZip');
    const deliveryDateInput = document.getElementById('deliveryDate');
    
    if (deliveryZipInput) {
        // Load available delivery dates when zipcode is entered
        deliveryZipInput.addEventListener('blur', checkDeliveryDates);
        
        // Calculate order total when zipcode changes
        deliveryZipInput.addEventListener('blur', calculateOrderTotal);
        
        // Also calculate on input for real-time updates
        deliveryZipInput.addEventListener('input', debounce(calculateOrderTotal, 500));
    }
    
    if (deliveryDateInput) {
        // Check date availability when date changes
        deliveryDateInput.addEventListener('change', checkDateAvailability);
        
        // Calculate order total when date changes
        deliveryDateInput.addEventListener('change', calculateOrderTotal);
    }
}

function closeCheckout() {
    document.getElementById('checkout').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    currentStep = 1;
    updateStepper();
}

// Store available dates globally
let availableDeliveryDates = [];

// Check available delivery dates for a zipcode
async function checkDeliveryDates() {
    const zipcode = document.getElementById('deliveryZip').value.trim();
    const datesContainer = document.getElementById('availableDatesContainer');
    const datesList = document.getElementById('availableDatesList');
    
    if (!zipcode || zipcode.length < 5) {
        document.getElementById('deliveryDateStatus').style.display = 'none';
        datesContainer.style.display = 'none';
        availableDeliveryDates = [];
        return;
    }
    
    const statusEl = document.getElementById('deliveryDateStatus');
    statusEl.textContent = 'Checking available dates...';
    statusEl.style.display = 'block';
    statusEl.style.color = '#666';
    datesContainer.style.display = 'none';
    
    try {
        const response = await apiCall(`/delivery/checkdates?zipcode=${zipcode}`);
        if (response.DATES && response.DATES.length > 0) {
            availableDeliveryDates = response.DATES;
            statusEl.textContent = `✓ ${response.DATES.length} available delivery dates found.`;
            statusEl.style.color = 'green';
            
            // Update date input max to the last available date
            const dateInput = document.getElementById('deliveryDate');
            const firstDate = parseDate(response.DATES[0]);
            const lastDate = parseDate(response.DATES[response.DATES.length - 1]);
            const minDate = formatDateForInput(firstDate);
            const maxDate = formatDateForInput(lastDate);
            dateInput.setAttribute('min', minDate);
            dateInput.setAttribute('max', maxDate);
            
            // Display available dates
            displayAvailableDates(response.DATES);
            datesContainer.style.display = 'block';
        } else {
            availableDeliveryDates = [];
            statusEl.textContent = 'No delivery dates available for this zipcode.';
            statusEl.style.color = 'orange';
            datesContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking delivery dates:', error);
        statusEl.textContent = 'Unable to check delivery dates. Please try again.';
        statusEl.style.color = 'red';
        datesContainer.style.display = 'none';
        availableDeliveryDates = [];
    }
}

// Parse date from MM/DD/YYYY format
function parseDate(dateString) {
    const [month, day, year] = dateString.split('/');
    return new Date(year, month - 1, day);
}

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format date for display
function formatDateForDisplay(dateString) {
    const date = parseDate(dateString);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Store toggle state
let datesListExpanded = false;

// Display available dates in a user-friendly format
function displayAvailableDates(dates) {
    const datesList = document.getElementById('availableDatesList');
    const toggleBtn = document.getElementById('toggleDatesList');
    
    // Clear previous dates
    datesList.innerHTML = '';
    
    // Create date buttons
    dates.forEach(dateStr => {
        const dateBtn = document.createElement('button');
        dateBtn.type = 'button';
        dateBtn.className = 'available-date-btn';
        dateBtn.textContent = formatDateForDisplay(dateStr);
        dateBtn.dataset.date = formatDateForInput(parseDate(dateStr));
        
        dateBtn.addEventListener('click', () => {
            document.getElementById('deliveryDate').value = dateBtn.dataset.date;
            checkDateAvailability();
            calculateOrderTotal();
            
            // Highlight selected date
            document.querySelectorAll('.available-date-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            dateBtn.classList.add('selected');
        });
        
        datesList.appendChild(dateBtn);
    });
    
    // Reset toggle state and UI
    datesListExpanded = false;
    datesList.style.display = 'none';
    toggleBtn.textContent = 'Show Dates';
    
    // Remove old toggle listener and add new one
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
    
    newToggleBtn.addEventListener('click', () => {
        datesListExpanded = !datesListExpanded;
        if (datesListExpanded) {
            datesList.style.display = 'grid';
            newToggleBtn.textContent = 'Hide Dates';
        } else {
            datesList.style.display = 'none';
            newToggleBtn.textContent = 'Show Dates';
        }
    });
    
    // Update selected date highlight when date input changes
    const dateInput = document.getElementById('deliveryDate');
    const updateSelectedHighlight = () => {
        const selectedDate = dateInput.value;
        document.querySelectorAll('.available-date-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.date === selectedDate) {
                btn.classList.add('selected');
            }
        });
    };
    
    // Remove old listeners and add new one
    dateInput.removeEventListener('change', updateSelectedHighlight);
    dateInput.addEventListener('change', updateSelectedHighlight);
}

// Check if specific date is available
async function checkDateAvailability() {
    const zipcode = document.getElementById('deliveryZip').value;
    const date = document.getElementById('deliveryDate').value;
    
    if (!zipcode || !date) {
        document.getElementById('dateAvailability').style.display = 'none';
        return;
    }
    
    // Check if date is in available dates list first (faster)
    const dateInput = document.getElementById('deliveryDate');
    const selectedDateStr = dateInput.value;
    const isInAvailableList = availableDeliveryDates.some(availDate => {
        return formatDateForInput(parseDate(availDate)) === selectedDateStr;
    });
    
    const statusEl = document.getElementById('dateAvailability');
    
    if (isInAvailableList) {
        statusEl.textContent = '✓ This date is available for delivery';
        statusEl.style.color = 'green';
        statusEl.style.display = 'block';
        
        // Update selected date highlight
        document.querySelectorAll('.available-date-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.date === selectedDateStr) {
                btn.classList.add('selected');
            }
        });
        return;
    }
    
    // If not in list, check with API
    try {
        const response = await apiCall(`/delivery/checkdate?zipcode=${zipcode}&date=${date}`);
        if (response.DATE_AVAILABLE) {
            statusEl.textContent = '✓ This date is available for delivery';
            statusEl.style.color = 'green';
            statusEl.style.display = 'block';
        } else {
            statusEl.textContent = '✗ This date is not available for delivery. Please select an available date.';
            statusEl.style.color = 'red';
            statusEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking date availability:', error);
        statusEl.textContent = 'Unable to verify date availability.';
        statusEl.style.color = 'orange';
        statusEl.style.display = 'block';
    }
}

// Calculate order total
async function calculateOrderTotal() {
    const zipcode = document.getElementById('deliveryZip').value.trim();
    const date = document.getElementById('deliveryDate').value;
    
    if (!zipcode || zipcode.length < 5 || !date || cart.length === 0) {
        document.getElementById('orderTotal').style.display = 'none';
        return;
    }
    
    const totalEl = document.getElementById('orderTotal');
    totalEl.style.display = 'block';
    totalEl.innerHTML = '<p>Calculating total...</p>';
    
    try {
        // Format products for API
        const products = cart.map(item => ({
            CODE: item.id,
            PRICE: item.price,
            RECIPIENT: {
                ZIPCODE: zipcode
            }
        }));
        
        const productsJson = JSON.stringify(products);
        const response = await apiCall(`/order/total?products=${encodeURIComponent(productsJson)}`);
        
        if (response.ORDERTOTAL) {
            const subtotal = response.SUBTOTAL || cart.reduce((sum, item) => sum + item.price, 0);
            const tax = response.TAXTOTAL || response.FLORISTONETAX || 0;
            const delivery = response.DELIVERYCHARGETOTAL || response.FLORISTONEDELIVERYCHARGE || 0;
            const total = response.ORDERTOTAL;
            
            totalEl.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Subtotal:</span>
                        <span>$${parseFloat(subtotal).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Tax:</span>
                        <span>$${parseFloat(tax).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Delivery:</span>
                        <span>$${parseFloat(delivery).toFixed(2)}</span>
                    </div>
                    <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">
                    <div style="display: flex; justify-content: space-between; font-size: 1.2em; font-weight: bold;">
                        <span>Total:</span>
                        <span>$${parseFloat(total).toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error calculating order total:', error);
        totalEl.innerHTML = '<p style="color: red;">Unable to calculate total. Please check zipcode and try again.</p>';
    }
}

async function handleCheckout(e) {
    e.preventDefault();

    const formData = {
        customerName: document.getElementById('customerName').value,
        customerEmail: document.getElementById('customerEmail').value,
        customerPhone: document.getElementById('customerPhone').value,
        customerAddress: document.getElementById('customerAddress').value,
        customerCity: document.getElementById('customerCity').value,
        customerState: document.getElementById('customerState').value,
        customerZip: document.getElementById('customerZip').value,
        recipientName: document.getElementById('recipientName').value,
        recipientPhone: document.getElementById('recipientPhone').value,
        deliveryAddress: document.getElementById('deliveryAddress').value,
        deliveryCity: document.getElementById('deliveryCity').value,
        deliveryState: document.getElementById('deliveryState').value,
        deliveryZip: document.getElementById('deliveryZip').value,
        deliveryDate: document.getElementById('deliveryDate').value,
        cardMessage: document.getElementById('cardMessage').value,
        specialInstructions: document.getElementById('specialInstructions').value,
        cardNumber: document.getElementById('cardNumber').value,
        cardExpiry: document.getElementById('cardExpiry').value,
        cardCVV: document.getElementById('cardCVV').value
    };

    try {
        // Get customer IP (simplified - in production, get from server)
        const customerIP = '127.0.0.1'; // This should come from backend
        
        // Get order total first
        const products = cart.map(item => ({
            CODE: item.id,
            PRICE: item.price,
            RECIPIENT: {
                ZIPCODE: formData.deliveryZip
            }
        }));
        
        const productsJson = JSON.stringify(products);
        const totalResponse = await apiCall(`/order/total?products=${encodeURIComponent(productsJson)}`);
        const orderTotal = totalResponse.ORDERTOTAL;
        
        // Validate card information before proceeding
        if (!formData.cardNumber || !formData.cardExpiry || !formData.cardCVV) {
            throw new Error('Please fill in all payment information');
        }
        
        // Validate expiry format (MM/YY)
        const expiryMatch = formData.cardExpiry.match(/^(\d{2})\/(\d{2})$/);
        if (!expiryMatch) {
            throw new Error('Please enter card expiry in MM/YY format');
        }
        
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing Payment...';
        
        try {
            // Get AuthorizeNet key first
            const authNetKeyResponse = await apiCall('/authorizenet/key');
            const authNetKey = authNetKeyResponse.AUTHORIZENET_KEY;
            const authNetUrl = authNetKeyResponse.AUTHORIZENET_URL || 'https://jstest.authorize.net/v1/Accept.js';
            
            // Generate AuthorizeNet token using Accept.js
            const authNetToken = await generateAuthorizeNetToken(
                authNetKey,
                formData.cardNumber,
                formData.cardExpiry,
                formData.cardCVV
            );
            
            if (!authNetToken) {
                throw new Error('Failed to generate payment token. Please check your card information.');
            }
            
            // Prepare order data according to API format
            const orderData = {
                customer: JSON.stringify({
                    NAME: formData.customerName,
                    EMAIL: formData.customerEmail,
                    PHONE: formData.customerPhone.replace(/\D/g, '').substring(0, 10),
                    ADDRESS1: formData.customerAddress,
                    ADDRESS2: '',
                    CITY: formData.customerCity,
                    STATE: formData.customerState.toUpperCase(),
                    COUNTRY: 'US',
                    ZIPCODE: formData.customerZip,
                    IP: customerIP
                }),
                products: JSON.stringify(cart.map(item => ({
                    CODE: item.id,
                    PRICE: item.price,
                    DELIVERYDATE: formData.deliveryDate,
                    CARDMESSAGE: formData.cardMessage.substring(0, 200),
                    SPECIALINSTRUCTIONS: formData.specialInstructions.substring(0, 100),
                    RECIPIENT: {
                        NAME: formData.recipientName,
                        INSTITUTION: '',
                        ADDRESS1: formData.deliveryAddress,
                        ADDRESS2: '',
                        CITY: formData.deliveryCity,
                        STATE: formData.deliveryState.toUpperCase(),
                        COUNTRY: 'US',
                        PHONE: formData.recipientPhone.replace(/\D/g, '').substring(0, 10),
                        ZIPCODE: formData.deliveryZip
                    }
                }))),
                ccinfo: JSON.stringify({
                    AUTHORIZENET_TOKEN: authNetToken
                }),
                ordertotal: parseFloat(orderTotal)
            };
            
            submitBtn.textContent = 'Placing Order...';
            
            // Place order via API
            const orderResponse = await apiCall('/order/place', 'POST', orderData);
            
            const orderNumber = orderResponse.ORDERNO || orderResponse.orderid || orderResponse.orderId || 'N/A';
            
            // Show confirmation screen
            showOrderConfirmation(orderNumber, formData);
            
            // Clear cart and reset
            await destroyCart();
            updateCartDisplay();
            document.getElementById('checkoutForm').reset();
            document.getElementById('orderTotal').style.display = 'none';
            document.getElementById('deliveryDateStatus').style.display = 'none';
            document.getElementById('dateAvailability').style.display = 'none';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        
    } catch (error) {
        console.error('Order placement error:', error);
        const errorMessage = error.message || 'There was an error placing your order. Please check your payment information and try again.';
        alert(errorMessage);
    }
}

// Generate AuthorizeNet token using Accept.js
function generateAuthorizeNetToken(publicKey, cardNumber, cardExpiry, cardCVV) {
    return new Promise((resolve, reject) => {
        // Check if Accept.js is loaded
        if (typeof Accept === 'undefined') {
            reject(new Error('Authorize.Net Accept.js is not loaded. Please refresh the page and try again.'));
            return;
        }
        
        // Parse expiry date (MM/YY format)
        const [month, year] = cardExpiry.split('/');
        const fullYear = '20' + year;
        
        // Clean card number (remove spaces)
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        
        // Create secure payment data according to Accept.js format
        const secureData = {
            authData: {
                clientKey: publicKey
            },
            cardData: {
                cardNumber: cleanCardNumber,
                month: month,
                year: fullYear,
                cardCode: cardCVV
            }
        };
        
        // Generate token using Accept.js
        Accept.dispatchData(secureData, (response) => {
            if (response.messages.resultCode === 'Error') {
                const errorMessages = response.messages.message.map(msg => msg.text).join(', ');
                reject(new Error(`Payment processing error: ${errorMessages}`));
            } else if (response.opaqueData && response.opaqueData.dataValue) {
                // Token is in response.opaqueData.dataValue
                resolve(response.opaqueData.dataValue);
            } else {
                reject(new Error('Failed to generate payment token. Invalid response from payment processor.'));
            }
        });
    });
}

// UI Helper Functions
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('products').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError() {
    document.getElementById('error').classList.remove('hidden');
}

function showOrderConfirmation(orderNumber, formData) {
    // Hide form, show confirmation
    document.getElementById('checkoutForm').style.display = 'none';
    document.getElementById('orderConfirmation').classList.remove('hidden');
    
    // Populate confirmation details
    const confirmationMessage = document.getElementById('confirmationMessage');
    const orderDetails = document.getElementById('orderDetails');
    
    confirmationMessage.textContent = `Your order #${orderNumber} has been placed successfully! You will receive a confirmation email shortly.`;
    
    orderDetails.innerHTML = `
        <h3>Order Details</h3>
        <div class="order-details-item">
            <span class="order-details-label">Order Number:</span>
            <span class="order-details-value">${orderNumber}</span>
        </div>
        <div class="order-details-item">
            <span class="order-details-label">Delivery Date:</span>
            <span class="order-details-value">${formData.deliveryDate}</span>
        </div>
        <div class="order-details-item">
            <span class="order-details-label">Recipient:</span>
            <span class="order-details-value">${formData.recipientName}</span>
        </div>
        <div class="order-details-item">
            <span class="order-details-label">Delivery Address:</span>
            <span class="order-details-value">${formData.deliveryAddress}, ${formData.deliveryCity}, ${formData.deliveryState} ${formData.deliveryZip}</span>
        </div>
    `;
}

function showNotification(message) {
    // Simple notification - you could enhance this with a toast library
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

