const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const FLORIST_API_BASE = 'https://www.floristone.com/api';

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware (optional - can be enabled for debugging)
// app.use((req, res, next) => {
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
//     next();
// });

// Helper function to create auth header
function getAuthHeader() {
    const apiKey = process.env.FLORIST_API_KEY;
    const apiPassword = process.env.FLORIST_API_PASSWORD;
    const credentials = `${apiKey}:${apiPassword}`;
    return 'Basic ' + Buffer.from(credentials).toString('base64');
}

// Proxy endpoint for getting a single product by code
app.get('/api/products/:code', async (req, res) => {
    const { code } = req.params;
    const apiUrl = `${FLORIST_API_BASE}/rest/flowershop/getproducts?code=${encodeURIComponent(code)}`;
    
    try {
        const authHeader = getAuthHeader();
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text',
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        const responseText = String(response.data);
        
        if (responseText.includes('<html') || responseText.includes('<!DOCTYPE') || responseText.trim() === '404') {
            throw new Error(`API returned error. Status: ${response.status}. Response: ${responseText.substring(0, 500)}`);
        }
        
        const jsonData = JSON.parse(responseText);
        
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${JSON.stringify(jsonData)}`);
        }
        
        res.json(jsonData);
    } catch (error) {
        console.error('Error fetching product:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch product',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// Proxy endpoint for getting products
app.get('/api/products', async (req, res) => {
    // Build API URL with query parameters
    const { category, count, start } = req.query;
    let apiUrl = `${FLORIST_API_BASE}/rest/flowershop/getproducts`;
    const queryParams = [];
    
    if (category && category !== 'all') {
        queryParams.push(`category=${encodeURIComponent(category)}`);
    }
    if (count) {
        queryParams.push(`count=${encodeURIComponent(count)}`);
    }
    if (start) {
        queryParams.push(`start=${encodeURIComponent(start)}`);
    }
    
    if (queryParams.length > 0) {
        apiUrl += '?' + queryParams.join('&');
    }
    
    try {
        const authHeader = getAuthHeader();
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text',
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        const responseText = String(response.data);
        
        // Check if response is HTML (error page)
        if (responseText.includes('<html') || responseText.includes('<!DOCTYPE') || responseText.trim() === '404') {
            throw new Error(`API returned error. Status: ${response.status}. Response: ${responseText.substring(0, 500)}`);
        }
        
        // Try to parse as JSON
        let jsonData;
        try {
            jsonData = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`API response is not valid JSON. Response: ${responseText.substring(0, 500)}`);
        }
        
        // If status is not 200, treat as error
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${JSON.stringify(jsonData)}`);
        }
        
        res.json(jsonData);
    } catch (error) {
        console.error('Error fetching products:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch products',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// Shopping Cart API endpoints
// Based on: https://florist.one/api/documentation/Shopping-Cart/Shopping-Cart

// POST - Create a new cart
app.post('/api/cart/create', async (req, res) => {
    try {
        const response = await axios.post(`${FLORIST_API_BASE}/rest/shoppingcart`, {}, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            responseType: 'text',
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        const responseText = String(response.data);
        if (responseText.includes('<html') || responseText.includes('<!DOCTYPE') || responseText.trim() === '404') {
            throw new Error(`API returned error. Status: ${response.status}. Response: ${responseText.substring(0, 500)}`);
        }
        
        let jsonData;
        try {
            jsonData = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`API response is not valid JSON. Response: ${responseText.substring(0, 500)}`);
        }
        
        if (response.status !== 200 && response.status !== 201) {
            throw new Error(`API returned status ${response.status}: ${JSON.stringify(jsonData)}`);
        }
        
        res.json(jsonData);
    } catch (error) {
        console.error('Error creating cart:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to create cart',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// PUT - Add item to cart, remove item, or clear cart
app.put('/api/cart', async (req, res) => {
    try {
        const { action, cartId, code, price, ...itemData } = req.body;
        
        if (!cartId) {
            return res.status(400).json({ error: 'cartId is required' });
        }
        
        if (!code) {
            return res.status(400).json({ error: 'code is required to add item to cart' });
        }
        
        // Build URL with query parameters
        // Format: PUT /rest/shoppingcart?sessionid={SESSIONID}&action=add&productcode={PRODUCTCODE}
        const queryParams = new URLSearchParams({
            sessionid: cartId,
            action: action || 'add',
            productcode: code
        });
        
        const apiUrl = `${FLORIST_API_BASE}/rest/shoppingcart?${queryParams.toString()}`;
        console.log('Sending to Florist API:', apiUrl);
        
        const response = await axios.put(apiUrl, {}, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            responseType: 'text',
            validateStatus: function (status) {
                // Don't throw on any status - let us handle it
                return true;
            }
        });
        
        console.log('API Response Status:', response.status);
        const responseText = String(response.data);
        console.log('API Response (first 500 chars):', responseText.substring(0, 500));
        
        if (response.status === 500) {
            // Try to extract error message from HTML response
            const errorMatch = responseText.match(/<h2[^>]*>([^<]+)<\/h2>/i) || 
                              responseText.match(/<h3[^>]*>([^<]+)<\/h3>/i);
            const errorMsg = errorMatch ? errorMatch[1] : 'Internal server error from Florist One API';
            throw new Error(`Florist One API Error (500): ${errorMsg}. Product code: ${code}, Session: ${cartId}`);
        }
        
        if (responseText.includes('<html') || responseText.includes('<!DOCTYPE') || responseText.trim() === '404') {
            throw new Error(`API returned error. Status: ${response.status}. Response: ${responseText.substring(0, 500)}`);
        }
        
        let jsonData;
        try {
            jsonData = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`API response is not valid JSON. Status: ${response.status}. Response: ${responseText.substring(0, 500)}`);
        }
        
        if (response.status !== 200 && response.status !== 201) {
            throw new Error(`API returned status ${response.status}: ${JSON.stringify(jsonData)}`);
        }
        
        res.json(jsonData);
    } catch (error) {
        console.error('Error updating cart:', error.message);
        console.error('Request body sent:', JSON.stringify(req.body, null, 2));
        const errorDetails = error.response?.data ? String(error.response.data).substring(0, 1000) : 'No additional details';
        console.error('API error response:', errorDetails);
        res.status(error.response?.status || 500).json({
            error: 'Failed to update cart',
            message: error.message,
            details: errorDetails
        });
    }
});

// GET - Retrieve cart and contents
app.get('/api/cart', async (req, res) => {
    try {
        const { cartId } = req.query;
        
        if (!cartId) {
            return res.status(400).json({ error: 'cartId parameter is required' });
        }
        
        const response = await axios.get(`${FLORIST_API_BASE}/rest/shoppingcart?sessionid=${cartId}`, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            responseType: 'text'
        });
        
        const responseText = String(response.data);
        if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
            throw new Error(`API returned HTML error. Status: ${response.status}`);
        }
        
        const jsonData = JSON.parse(responseText);
        res.json(jsonData);
    } catch (error) {
        console.error('Error retrieving cart:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to retrieve cart',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// DELETE - Destroy shopping cart
app.delete('/api/cart', async (req, res) => {
    try {
        const { cartId } = req.query;
        
        if (!cartId) {
            return res.status(400).json({ error: 'cartId parameter is required' });
        }
        
        const response = await axios.delete(`${FLORIST_API_BASE}/rest/shoppingcart?sessionid=${cartId}`, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            responseType: 'text'
        });
        
        const responseText = String(response.data);
        if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
            throw new Error(`API returned HTML error. Status: ${response.status}`);
        }
        
        const jsonData = JSON.parse(responseText);
        res.json(jsonData);
    } catch (error) {
        console.error('Error destroying cart:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to destroy cart',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// Proxy endpoint for checking delivery dates
app.get('/api/delivery/checkdates', async (req, res) => {
    try {
        const { zipcode } = req.query;
        if (!zipcode) {
            return res.status(400).json({ error: 'zipcode parameter is required' });
        }
        
        const apiUrl = `${FLORIST_API_BASE}/rest/flowershop/checkdeliverydate?zipcode=${zipcode}`;
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text'
        });
        
        const jsonData = JSON.parse(response.data);
        res.json(jsonData);
    } catch (error) {
        console.error('Error checking delivery dates:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to check delivery dates',
            message: error.message
        });
    }
});

// Proxy endpoint for checking specific delivery date availability
app.get('/api/delivery/checkdate', async (req, res) => {
    try {
        const { zipcode, date } = req.query;
        if (!zipcode || !date) {
            return res.status(400).json({ error: 'zipcode and date parameters are required' });
        }
        
        const apiUrl = `${FLORIST_API_BASE}/rest/flowershop/checkdeliverydate?zipcode=${zipcode}&date=${date}`;
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text'
        });
        
        const jsonData = JSON.parse(response.data);
        res.json(jsonData);
    } catch (error) {
        console.error('Error checking delivery date:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to check delivery date',
            message: error.message
        });
    }
});

// Proxy endpoint for getting order total
app.get('/api/order/total', async (req, res) => {
    try {
        const { products } = req.query;
        if (!products) {
            return res.status(400).json({ error: 'products parameter is required' });
        }
        
        const apiUrl = `${FLORIST_API_BASE}/rest/flowershop/gettotal?products=${encodeURIComponent(products)}`;
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text'
        });
        
        const jsonData = JSON.parse(response.data);
        res.json(jsonData);
    } catch (error) {
        console.error('Error getting order total:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to get order total',
            message: error.message
        });
    }
});

// Proxy endpoint for getting AuthorizeNet key
app.get('/api/authorizenet/key', async (req, res) => {
    try {
        const apiUrl = `${FLORIST_API_BASE}/rest/flowershop/getauthorizenetkey`;
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text'
        });
        
        const jsonData = JSON.parse(response.data);
        res.json(jsonData);
    } catch (error) {
        console.error('Error getting AuthorizeNet key:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to get AuthorizeNet key',
            message: error.message
        });
    }
});

// Proxy endpoint for placing an order
app.post('/api/order/place', async (req, res) => {
    try {
        const apiUrl = `${FLORIST_API_BASE}/rest/flowershop/placeorder`;
        const response = await axios.post(apiUrl, req.body, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text'
        });
        
        const jsonData = JSON.parse(response.data);
        res.json(jsonData);
    } catch (error) {
        console.error('Error placing order:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to place order',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// Proxy endpoint for getting order information
app.get('/api/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const apiUrl = `${FLORIST_API_BASE}/rest/flowershop/getorderinfo?orderno=${orderId}`;
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'text'
        });
        
        const jsonData = JSON.parse(response.data);
        res.json(jsonData);
    } catch (error) {
        console.error('Error getting order information:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to get order information',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Serve static files (frontend) - must come after API routes
app.use(express.static(path.join(__dirname)));

// Serve index.html for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend and API available at http://localhost:${PORT}`);
    console.log('Environment variables:');
    console.log('  FLORIST_API_KEY:', process.env.FLORIST_API_KEY ? 'Set (' + process.env.FLORIST_API_KEY.substring(0, 3) + '...)' : 'NOT SET');
    console.log('  FLORIST_API_PASSWORD:', process.env.FLORIST_API_PASSWORD ? 'Set (' + process.env.FLORIST_API_PASSWORD.substring(0, 3) + '...)' : 'NOT SET');
    console.log('  PORT:', process.env.PORT || '8080 (default)');
});

