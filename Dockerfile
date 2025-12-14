# Backend Dockerfile - serves both API and static files
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy server code and static files
COPY server.js ./
COPY index.html styles.css app.js config.js ./

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server.js"]

