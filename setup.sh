#!/bin/bash

# SDR Assignment System Setup Script

echo "=== SDR Assignment System Setup ==="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v16 or higher) first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

echo "✅ Node.js and PostgreSQL are installed"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

cd ..

echo "✅ Dependencies installed successfully"
echo ""

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > backend/.env << EOL
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sdr_assignment_system
DB_USER=postgres
DB_PASSWORD=postgres
EOL
    echo "✅ Template .env file created. Please update database credentials if needed."
else
    echo "✅ .env file exists"
fi

echo ""

# Prompt for database setup
echo "🗄️  Database Setup"
echo "Please ensure PostgreSQL is running and create the database:"
echo ""
echo "1. Connect to PostgreSQL as superuser:"
echo "   psql -U postgres"
echo ""
echo "2. Create the database:"
echo "   CREATE DATABASE sdr_assignment_system;"
echo ""
echo "3. Exit psql and run the schema:"
echo "   psql -U postgres -d sdr_assignment_system -f backend/src/models/schema.sql"
echo ""

read -p "Have you completed the database setup? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please complete the database setup and run this script again."
    exit 1
fi

echo ""
echo "🚀 Setup complete!"
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  npm run dev"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend"
echo "  npm start"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Access the application at: http://localhost:3000"