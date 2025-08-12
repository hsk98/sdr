#!/bin/bash

# SDR Assignment System Simple Setup Script

echo "=== SDR Assignment System Setup ==="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v16 or higher) first."
    exit 1
fi

echo "✅ Node.js is installed"
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
    echo "✅ Template .env file created."
else
    echo "✅ .env file exists"
fi

echo ""
echo "🗄️  Database Setup Options:"
echo ""
echo "Choose your database setup:"
echo "1. PostgreSQL (recommended for production)"
echo "2. SQLite (simple, no installation needed)"
echo ""

read -p "Enter your choice (1 or 2): " -n 1 -r
echo ""
echo ""

if [[ $REPLY == "1" ]]; then
    echo "PostgreSQL Setup Instructions:"
    echo ""
    echo "If PostgreSQL is not properly installed, try:"
    echo ""
    echo "Option 1 - Homebrew (recommended):"
    echo "  brew install postgresql@14"
    echo "  brew services start postgresql@14"
    echo ""
    echo "Option 2 - Official installer:"
    echo "  Download from: https://www.postgresql.org/download/macos/"
    echo ""
    echo "Option 3 - Postgres.app:"
    echo "  Download from: https://postgresapp.com/"
    echo ""
    echo "After installation, run:"
    echo "  createdb sdr_assignment_system"
    echo "  psql -d sdr_assignment_system -f backend/src/models/schema.sql"
    echo ""
elif [[ $REPLY == "2" ]]; then
    echo "Setting up SQLite..."
    
    # Install sqlite3 npm package
    cd backend
    npm install sqlite3
    
    # Create SQLite-specific configuration
    echo "Creating SQLite database configuration..."
    
    # Update .env for SQLite
    cat > .env << EOL
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DATABASE_TYPE=sqlite
EOL
    
    echo "✅ SQLite setup complete!"
    echo ""
    echo "The database will be created automatically when you start the server."
    
    cd ..
else
    echo "Invalid choice. Please run the script again."
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