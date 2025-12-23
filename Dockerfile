# Use official Node.js image as base
FROM node:18-alpine

# Set working directory in the container
WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Clean previous installs and install dependencies
RUN rm -rf node_modules package-lock.json && \
    npm install --force && \
    npm install @mui/material @emotion/react @emotion/styled --force

# Copy rest of the app files
COPY . .

# --- DEBUGGING STEP ---
# List all files and folders recursively to see what was copied.
RUN ls -laR

# Build step (optional for dev, kept as-is)
RUN npm run build

# Expose Vite dev server port
EXPOSE 5173

# Start the app in development mode
CMD ["npm", "run", "dev"]
