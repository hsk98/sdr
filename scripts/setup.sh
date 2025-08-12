#!/bin/bash

# SDR Assignment System Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up SDR Assignment System..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ Environment file created. Please review and update .env as needed."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs backups ssl

# Pull latest images
echo "🐳 Pulling Docker images..."
docker-compose pull

# Build the application
echo "🔨 Building application..."
docker-compose build

# Start the services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
for i in {1..10}; do
    if docker-compose ps | grep -q "Up (healthy)"; then
        echo "✅ Services are healthy!"
        break
    fi
    echo "⏳ Waiting for services to be healthy... ($i/10)"
    sleep 10
    if [ $i -eq 10 ]; then
        echo "❌ Services failed to start properly. Check logs with: docker-compose logs"
        exit 1
    fi
done

# Display access information
echo ""
echo "🎉 Setup complete! Your SDR Assignment System is ready."
echo ""
echo "📍 Access URLs:"
echo "   Frontend:     http://localhost:3000"
echo "   Backend API:  http://localhost:3001"
echo "   Nginx Proxy:  http://localhost:8080"
echo ""
echo "🔑 Default Credentials:"
echo "   Admin:     username: admin,     password: admin123"
echo "   SDR User:  username: john.doe,  password: admin123"
echo ""
echo "📊 Management Commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart"
echo "   Status:       docker-compose ps"
echo ""
echo "📖 See DEPLOYMENT.md for more information."