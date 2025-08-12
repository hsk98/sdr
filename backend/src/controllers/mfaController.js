const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const auditLogger = require('../utils/logger');

class MFAController {
  // Generate MFA secret and QR code for setup
  static async setupMFA(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Only allow admin users to enable MFA initially
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'MFA is currently only available for admin accounts' });
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `SDR Assignment System (${user.username})`,
        issuer: 'SDR Assignment System',
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      // Store the secret temporarily (not yet enabled)
      req.session.tempMFASecret = secret.base32;

      await auditLogger.logSystemEvent('MFA_SETUP_INITIATED', {
        user_id: userId,
        username: user.username,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        message: 'Scan the QR code with your authenticator app, then verify with a token to enable MFA'
      });
    } catch (error) {
      console.error('MFA setup error:', error);
      await auditLogger.logError('MFA_SETUP_ERROR', error, {
        user_id: req.user?.id,
        ip_address: req.ip
      });
      res.status(500).json({ error: 'Failed to setup MFA' });
    }
  }

  // Verify and enable MFA
  static async enableMFA(req, res) {
    try {
      const { token } = req.body;
      const userId = req.user.id;
      const tempSecret = req.session.tempMFASecret;

      if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      if (!tempSecret) {
        return res.status(400).json({ error: 'No MFA setup in progress. Please start setup first.' });
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: tempSecret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow some time drift
      });

      if (!verified) {
        await auditLogger.logSystemEvent('MFA_VERIFICATION_FAILED', {
          user_id: userId,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
        return res.status(400).json({ error: 'Invalid verification token' });
      }

      // Enable MFA for the user
      await User.enableMFA(userId, tempSecret);
      
      // Clear temporary secret
      delete req.session.tempMFASecret;

      await auditLogger.logSystemEvent('MFA_ENABLED', {
        user_id: userId,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'MFA has been successfully enabled for your account'
      });
    } catch (error) {
      console.error('MFA enable error:', error);
      await auditLogger.logError('MFA_ENABLE_ERROR', error, {
        user_id: req.user?.id,
        ip_address: req.ip
      });
      res.status(500).json({ error: 'Failed to enable MFA' });
    }
  }

  // Verify MFA token during login
  static async verifyMFA(req, res) {
    try {
      const { token } = req.body;
      const userId = req.session.pendingMFAUserId;

      if (!token) {
        return res.status(400).json({ error: 'MFA token is required' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'No pending MFA verification' });
      }

      const secret = await User.getMFASecret(userId);
      if (!secret) {
        return res.status(400).json({ error: 'MFA not enabled for this user' });
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow some time drift
      });

      if (!verified) {
        await auditLogger.logSystemEvent('MFA_LOGIN_FAILED', {
          user_id: userId,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
        return res.status(400).json({ error: 'Invalid MFA token' });
      }

      // MFA verified, complete login
      const user = await User.findById(userId);
      const jwt = require('jsonwebtoken');
      const token_jwt = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

      // Clear pending MFA session
      delete req.session.pendingMFAUserId;

      await auditLogger.logSystemEvent('MFA_LOGIN_SUCCESS', {
        user_id: userId,
        username: user.username,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        mfaEnabled: user.mfa_enabled
      };

      res.json({
        message: 'Login successful',
        token: token_jwt,
        user: userResponse
      });
    } catch (error) {
      console.error('MFA verification error:', error);
      await auditLogger.logError('MFA_VERIFICATION_ERROR', error, {
        user_id: req.session?.pendingMFAUserId,
        ip_address: req.ip
      });
      res.status(500).json({ error: 'Failed to verify MFA' });
    }
  }

  // Disable MFA
  static async disableMFA(req, res) {
    try {
      const { password, token } = req.body;
      const userId = req.user.id;

      if (!password || !token) {
        return res.status(400).json({ error: 'Password and MFA token are required' });
      }

      // Verify password first
      const user = await User.findByIdWithPassword(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValidPassword = await User.validatePassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid password' });
      }

      // Verify MFA token
      const secret = await User.getMFASecret(userId);
      if (!secret) {
        return res.status(400).json({ error: 'MFA not enabled' });
      }

      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        await auditLogger.logSystemEvent('MFA_DISABLE_FAILED', {
          user_id: userId,
          reason: 'Invalid MFA token',
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
        return res.status(400).json({ error: 'Invalid MFA token' });
      }

      // Disable MFA
      await User.disableMFA(userId);

      await auditLogger.logSystemEvent('MFA_DISABLED', {
        user_id: userId,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'MFA has been disabled for your account'
      });
    } catch (error) {
      console.error('MFA disable error:', error);
      await auditLogger.logError('MFA_DISABLE_ERROR', error, {
        user_id: req.user?.id,
        ip_address: req.ip
      });
      res.status(500).json({ error: 'Failed to disable MFA' });
    }
  }

  // Get MFA status
  static async getMFAStatus(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      res.json({
        mfaEnabled: !!user.mfa_enabled,
        canEnableMFA: user.role === 'admin' // Only admins can enable MFA initially
      });
    } catch (error) {
      console.error('Get MFA status error:', error);
      res.status(500).json({ error: 'Failed to get MFA status' });
    }
  }

  // Generate backup codes
  static async generateBackupCodes(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user.mfa_enabled) {
        return res.status(400).json({ error: 'MFA must be enabled to generate backup codes' });
      }

      // Generate 10 backup codes
      const backupCodes = [];
      for (let i = 0; i < 10; i++) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        backupCodes.push(code);
      }

      // Store backup codes (hashed)
      const crypto = require('crypto');
      const hashedCodes = backupCodes.map(code => crypto.createHash('sha256').update(code).digest('hex'));
      
      // TODO: Store hashed backup codes in database
      // await User.setBackupCodes(userId, hashedCodes);

      await auditLogger.logSystemEvent('MFA_BACKUP_CODES_GENERATED', {
        user_id: userId,
        codes_count: backupCodes.length,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        backupCodes,
        message: 'Store these backup codes in a safe place. They can be used to access your account if you lose your authenticator device.'
      });
    } catch (error) {
      console.error('Generate backup codes error:', error);
      await auditLogger.logError('MFA_BACKUP_CODES_ERROR', error, {
        user_id: req.user?.id,
        ip_address: req.ip
      });
      res.status(500).json({ error: 'Failed to generate backup codes' });
    }
  }
}

module.exports = MFAController;