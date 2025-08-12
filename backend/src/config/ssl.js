const fs = require('fs');
const path = require('path');

const getSSLOptions = () => {
  if (process.env.NODE_ENV !== 'production') {
    // Development: use self-signed certificates
    const sslPath = path.join(__dirname, '../../ssl');
    
    try {
      return {
        key: fs.readFileSync(path.join(sslPath, 'private-key.pem')),
        cert: fs.readFileSync(path.join(sslPath, 'certificate.pem'))
      };
    } catch (error) {
      console.warn('SSL certificates not found. Run ./ssl/generate-ssl.sh to create development certificates.');
      return null;
    }
  } else {
    // Production: use real certificates
    const certPath = process.env.SSL_CERT_PATH;
    const keyPath = process.env.SSL_KEY_PATH;
    const caPath = process.env.SSL_CA_PATH;
    
    if (!certPath || !keyPath) {
      console.error('Production SSL configuration incomplete. Set SSL_CERT_PATH and SSL_KEY_PATH environment variables.');
      return null;
    }
    
    try {
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      
      // Add CA bundle if provided
      if (caPath) {
        options.ca = fs.readFileSync(caPath);
      }
      
      return options;
    } catch (error) {
      console.error('Failed to load SSL certificates:', error.message);
      return null;
    }
  }
};

const getSSLConfig = () => {
  return {
    enabled: process.env.HTTPS_ENABLED === 'true' || process.env.NODE_ENV === 'production',
    port: process.env.HTTPS_PORT || 3443,
    redirectHttp: process.env.REDIRECT_HTTP === 'true' || process.env.NODE_ENV === 'production',
    options: getSSLOptions()
  };
};

module.exports = {
  getSSLConfig,
  getSSLOptions
};