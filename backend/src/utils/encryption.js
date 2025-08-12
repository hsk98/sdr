const crypto = require('crypto');

class Encryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.secretKey = process.env.ENCRYPTION_KEY || this.generateKey();
    this.ivLength = 16;
    this.tagLength = 16;
  }

  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  encryptData(text) {
    if (!text) return null;
    
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.secretKey);
      cipher.setAAD(Buffer.from('additional-data', 'utf8'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  decryptData(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const { encrypted, iv, tag } = typeof encryptedData === 'string' 
        ? JSON.parse(encryptedData) 
        : encryptedData;
      
      const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
      decipher.setAAD(Buffer.from('additional-data', 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  encryptPII(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sensitiveFields = ['email', 'phone', 'first_name', 'last_name', 'address', 'ssn'];
    const encrypted = { ...data };
    
    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = JSON.stringify(this.encryptData(encrypted[field]));
      }
    }
    
    return encrypted;
  }

  decryptPII(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sensitiveFields = ['email', 'phone', 'first_name', 'last_name', 'address', 'ssn'];
    const decrypted = { ...data };
    
    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string' && decrypted[field].startsWith('{')) {
        try {
          decrypted[field] = this.decryptData(JSON.parse(decrypted[field]));
        } catch (error) {
          console.error(`Failed to decrypt ${field}:`, error);
        }
      }
    }
    
    return decrypted;
  }
}

const encryption = new Encryption();

module.exports = {
  encryptData: (data) => encryption.encryptData(data),
  decryptData: (data) => encryption.decryptData(data),
  hashData: (data) => encryption.hashData(data),
  encryptPII: (data) => encryption.encryptPII(data),
  decryptPII: (data) => encryption.decryptPII(data)
};