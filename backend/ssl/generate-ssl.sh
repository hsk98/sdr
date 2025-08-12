#!/bin/bash

# Generate SSL certificate for development
# For production, use certificates from a trusted CA like Let's Encrypt

echo "Generating SSL certificates for development..."

# Create ssl directory if it doesn't exist
mkdir -p /Users/app/sdr-assignment-system/backend/ssl

# Generate private key
openssl genrsa -out /Users/app/sdr-assignment-system/backend/ssl/private-key.pem 2048

# Generate certificate signing request
openssl req -new -key /Users/app/sdr-assignment-system/backend/ssl/private-key.pem \
  -out /Users/app/sdr-assignment-system/backend/ssl/csr.pem \
  -subj "/C=US/ST=State/L=City/O=SDR Assignment System/CN=localhost"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -in /Users/app/sdr-assignment-system/backend/ssl/csr.pem \
  -signkey /Users/app/sdr-assignment-system/backend/ssl/private-key.pem \
  -out /Users/app/sdr-assignment-system/backend/ssl/certificate.pem \
  -days 365

# Set appropriate permissions
chmod 600 /Users/app/sdr-assignment-system/backend/ssl/private-key.pem
chmod 644 /Users/app/sdr-assignment-system/backend/ssl/certificate.pem

# Clean up CSR file
rm /Users/app/sdr-assignment-system/backend/ssl/csr.pem

echo "SSL certificates generated successfully!"
echo "Private key: ssl/private-key.pem"
echo "Certificate: ssl/certificate.pem"
echo ""
echo "For production, replace these with certificates from a trusted CA."
echo "Consider using Let's Encrypt for free SSL certificates."