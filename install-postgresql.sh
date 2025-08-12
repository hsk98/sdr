#!/bin/bash

echo "=== PostgreSQL Installation Helper ==="
echo ""

# Check if Homebrew is installed
if command -v brew &> /dev/null; then
    echo "✅ Homebrew is installed"
    echo ""
    echo "Installing PostgreSQL via Homebrew..."
    brew install postgresql@14
    
    echo ""
    echo "Starting PostgreSQL service..."
    brew services start postgresql@14
    
    echo ""
    echo "Adding PostgreSQL to PATH..."
    echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
    echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
    
    echo ""
    echo "Creating database..."
    # Try different possible paths
    if [ -f "/opt/homebrew/bin/createdb" ]; then
        /opt/homebrew/bin/createdb sdr_assignment_system
        echo "Database created with /opt/homebrew/bin/createdb"
    elif [ -f "/usr/local/bin/createdb" ]; then
        /usr/local/bin/createdb sdr_assignment_system
        echo "Database created with /usr/local/bin/createdb"
    else
        echo "⚠️  Please restart your terminal and run: createdb sdr_assignment_system"
    fi
    
    echo ""
    echo "✅ PostgreSQL installation complete!"
    echo ""
    echo "Please restart your terminal and then run:"
    echo "  ./setup.sh"
    
else
    echo "❌ Homebrew not found."
    echo ""
    echo "Please install PostgreSQL using one of these methods:"
    echo ""
    echo "1. Install Homebrew first, then PostgreSQL:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "   brew install postgresql@14"
    echo ""
    echo "2. Download official installer:"
    echo "   https://www.postgresql.org/download/macos/"
    echo ""
    echo "3. Use Postgres.app:"
    echo "   https://postgresapp.com/"
fi