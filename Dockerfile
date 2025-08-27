# Stage 1: Build the React frontend
FROM node:20-slim as build-frontend
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source code and build the static site
COPY public ./public
COPY src ./src
RUN npm run build

# --- 

# Stage 2: Build the Python backend and combine with frontend
FROM python:3.9-slim
WORKDIR /app

# Set the cache directory for fastf1
# This path will be mounted to a persistent volume on Fly.io
ENV FASTF1_CACHE_DIR=/app/.fastf1-cache
RUN mkdir -p /app/.fastf1-cache

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend server code
COPY server ./server

# Copy the built frontend from the previous stage
COPY --from=build-frontend /app/build ./static

# Expose the port the app will run on (Fly.io default is 8080)
EXPOSE 8080

# Command to run the production server
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8080", "server.main:app"]
