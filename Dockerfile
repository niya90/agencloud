# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend

# Copy package config and install dependencies
COPY frontend/package.json ./
RUN npm install

# Copy source code and build
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Serve using Python FastAPI
# ==========================================
FROM python:3.10-slim AS backend-server
WORKDIR /workspace

# Install system dependencies needed for python packages if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application files
COPY backend/app ./app

# Copy built frontend assets from Stage 1 to serve statically
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Expose port and configure environment defaults
EXPOSE 8000
ENV HOST=0.0.0.0
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Command to run the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
