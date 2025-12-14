# Maylee Flowers Web App

A simple, modern web application for browsing and ordering flowers using the Florist One API.

## Features

- 🌸 Browse available flower products
- 🛒 Shopping cart functionality
- 💳 Checkout and order placement
- 📱 Responsive design
- 🎨 Modern, beautiful UI

## Setup Instructions

### 1. Get API Credentials

Before using this app, you need to sign up for a Florist One API account (used for product data and order processing):

1. Visit [Florist One API Signup](https://www.floristone.com/api/api-signup.cfm)
2. Register for an API key and password
3. Note down your credentials

### 2. Configure API Credentials

**For Docker/Production:** Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit `.env` and add your credentials:

```
FLORIST_API_KEY=your_api_key_here
FLORIST_API_PASSWORD=your_api_password_here
PORT=3000
```

**For Local Development (without Docker):** The frontend will automatically connect to `http://localhost:3000` when running locally.

**Important:** Never commit your `.env` file to version control. It's already included in `.gitignore`.

### 3. Run the Application

#### Option A: Simple HTTP Server (Python)

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open your browser to `http://localhost:8000`

#### Option B: Node.js HTTP Server

```bash
# Install http-server globally
npm install -g http-server

# Run the server
http-server -p 8000
```

Then open your browser to `http://localhost:8000`

#### Option C: VS Code Live Server

If you're using VS Code, install the "Live Server" extension and right-click on `index.html` to select "Open with Live Server".

#### Option D: Docker (Recommended for Production)

The application now includes a backend API server to handle CORS issues. The setup includes both frontend (nginx) and backend (Node.js) services.

**Prerequisites:**
1. Make sure you have a `.env` file with your API credentials (see step 2 above)

**Run with Docker Compose:**

```bash
# Build and start both frontend and backend services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Then open your browser to `http://localhost:8080`

The frontend (nginx) will automatically proxy `/api` requests to the backend server, which handles all communication with the Florist One API.

**Architecture:**
- **Frontend**: Served by nginx on port 8080
- **Backend**: Node.js/Express API server on port 3000 (internal)
- **API Proxy**: Backend proxies requests to Florist One API to avoid CORS issues

#### Option E: Local Development (Backend + Frontend)

For local development without Docker:

```bash
# Install backend dependencies
npm install

# Start backend server (in one terminal)
npm start

# Serve frontend (in another terminal)
# Option 1: Python
python3 -m http.server 8000

# Option 2: Node.js http-server
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser. The frontend will connect to the backend at `http://localhost:3000`.

## API Documentation

For detailed API documentation, visit:
- [Florist One API Documentation](https://florist.one/api/documentation/)
- [Authentication Guide](https://florist.one/api/documentation/Authentication)

## Project Structure

```
florist-app/
├── index.html              # Main HTML structure
├── styles.css              # Styling and layout
├── app.js                  # Frontend JavaScript logic
├── config.js               # Frontend API configuration
├── server.js               # Backend API server (Node.js/Express)
├── package.json            # Node.js dependencies
├── nginx.conf              # Nginx configuration for frontend
├── Dockerfile.backend      # Backend Docker configuration
├── Dockerfile.frontend     # Frontend Docker configuration
├── docker-compose.yml      # Docker Compose configuration
├── .env.example            # Environment variables template
├── .dockerignore           # Docker ignore file
├── .gitignore              # Git ignore file
└── README.md               # This file
```

## Features Overview

### Product Display
- Fetches products from the Florist One API
- Displays products in a responsive grid
- Shows product name, price, description, and image
- Fallback to sample products if API is unavailable

### Shopping Cart
- Add products to cart
- View cart contents
- Remove items from cart
- Calculate total price

### Checkout
- Collect recipient information
- Collect delivery address
- Collect payment information
- Place order via Florist One API

## Testing

The app includes sample products that will display if the API is unavailable or credentials are incorrect. This allows you to test the UI and cart functionality without valid API credentials.

For testing payment, Florist One provides test credit card numbers. Check their documentation for test card information.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This is a sample application. Make sure to comply with Florist One's API terms of service.

## Support

For API-related issues, contact Florist One support.
For application issues, check the browser console for error messages.

