# Vite requires Node 20+
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN rm -rf node_modules package-lock.json && npm install --force

# Copy application source
COPY . .

# 🔧 Docker-only FIX for Linux case sensitivity
# Converts Company Logo.PNG → Company Logo.png
RUN if [ -f "src/assets/Company Logo.PNG" ]; then \
      mv "src/assets/Company Logo.PNG" "src/assets/Company Logo.png"; \
    fi

# Do NOT run build (dev mode)
# RUN npm run build ❌

EXPOSE 5173

CMD ["npm", "run", "dev"]
