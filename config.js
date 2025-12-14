// Backend API Configuration
// The frontend now calls the backend API server which proxies requests to Florist One
// This avoids CORS issues and keeps API credentials secure on the server side
// Both frontend and API are served from the same Express server

const API_CONFIG = {
    // Backend API Base URL - same origin as frontend
    baseUrl: '/api'
};

