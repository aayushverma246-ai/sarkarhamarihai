# Use Node 20 Alpine as the base image for a small footprint
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install all dependencies (frontend, root, and backend)
RUN npm install
RUN cd backend && npm install

# Copy all project files
COPY . .

# Build the Vite frontend
RUN npm run build

# Expose the port that the monolithic server will run on
EXPOSE 3000

# Start the monolithic Express server
CMD ["npm", "start"]
