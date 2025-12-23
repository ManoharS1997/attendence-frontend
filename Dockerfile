# ✅ Use Node 20 (required by Vite)
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN rm -rf node_modules package-lock.json && \
    npm install --force

# Copy all project files
COPY . .

# ✅ FIX: Rename asset file INSIDE container (Docker-only fix)
# This handles space/case issues without touching repo code
RUN if [ -f "src/assets/Company Logo.png" ]; then \
      mv "src/assets/Company Logo.png" "src/assets/company-logo.png"; \
    fi

# ✅ Create symlink so BOTH names work
RUN ln -s "company-logo.png" "src/assets/Company Logo.png" || true

# ❌ REMOVE build (since you run dev)
# RUN npm run build

EXPOSE 5173

# ✅ Run dev server
CMD ["npm", "run", "dev"]
