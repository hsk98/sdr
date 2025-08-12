#!/bin/bash

# SDR Assignment System Production Deployment Script
# Deploys the application to production environment

set -e

echo "🚀 Starting production deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure it for production."
    exit 1
fi

# Check critical environment variables
if ! grep -q "JWT_SECRET=.*[a-zA-Z0-9]" .env || grep -q "JWT_SECRET=your-super-secret" .env; then
    echo "❌ Please set a secure JWT_SECRET in .env file"
    exit 1
fi

if ! grep -q "DB_PASSWORD=.*[a-zA-Z0-9]" .env || grep -q "DB_PASSWORD=change-this" .env; then
    echo "❌ Please set a secure DB_PASSWORD in .env file"
    exit 1
fi

if ! grep -q "NODE_ENV=production" .env; then
    echo "❌ Please set NODE_ENV=production in .env file"
    exit 1
fi

echo "✅ Environment configuration validated"

# Create necessary directories
echo "📁 Creating production directories..."
mkdir -p logs backups ssl

# Build production images
echo "🔨 Building production images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop existing services if running
echo "🛑 Stopping existing services..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Start production services
echo "🚀 Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 60

# Check service health
echo "🏥 Checking service health..."
HEALTH_CHECK_PASSED=false
for i in {1..20}; do
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up (healthy)"; then
        echo "✅ All services are healthy!"
        HEALTH_CHECK_PASSED=true
        break
    fi
    echo "⏳ Waiting for services to be healthy... ($i/20)"
    sleep 15
done

if [ "$HEALTH_CHECK_PASSED" = false ]; then
    echo "❌ Health check failed. Checking logs..."
    docker-compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

# Test API endpoint
echo "🧪 Testing API endpoints..."
sleep 10
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
    echo "🔍 Nginx logs:"
    docker-compose -f docker-compose.prod.yml logs nginx --tail=20
    echo "🔍 Backend logs:"
    docker-compose -f docker-compose.prod.yml logs backend --tail=20
    exit 1
fi

# Display deployment information
echo ""
echo "🎉 Production deployment complete!"
echo ""
echo "📍 Access URLs:"
echo "   Application:  http://localhost"
echo "   API Health:   http://localhost/api/health"
echo ""
echo "🔑 Default Credentials:"
echo "   Admin:     username: admin,     password: admin123"
echo "   SDR User:  username: john.doe,  password: admin123"
echo ""
echo "📊 Management Commands:"
echo "   View logs:    docker-compose -f docker-compose.prod.yml logs -f"
echo "   Stop:         docker-compose -f docker-compose.prod.yml down"
echo "   Restart:      docker-compose -f docker-compose.prod.yml restart"
echo "   Status:       docker-compose -f docker-compose.prod.yml ps"
echo "   Backup:       ./scripts/backup.sh"
echo ""
echo "⚠️  Remember to:"
echo "   1. Change default passwords immediately"
echo "   2. Set up SSL certificates for HTTPS"
echo "   3. Configure automated backups"
echo "   4. Set up monitoring and alerting"
echo ""
echo "📖 See DEPLOYMENT.md for detailed production setup."