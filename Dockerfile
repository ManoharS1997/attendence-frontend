# Vite v7 requires Node 20+
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN rm -rf node_modules package-lock.json && npm install --force

# Copy source code
COPY . .

# 🔧 CRITICAL FIX: Handle BOTH .PNG and .png imports (Docker-only)
RUN set -e && \
    ASSET_DIR="src/assets" && \
    if [ -f "$ASSET_DIR/Company Logo.PNG" ]; then \
        echo "Fixing logo casing for Linux..." && \
        cp "$ASSET_DIR/Company Logo.PNG" "$ASSET_DIR/Company Logo.png"; \
    elif [ -f "$ASSET_DIR/Company Logo.png" ]; then \
        cp "$ASSET_DIR/Company Logo.png" "$ASSET_DIR/Company Logo.PNG"; \
    fi

# ✅ MUST run build
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "dev"]
