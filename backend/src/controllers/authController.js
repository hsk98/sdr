const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auditLogger = require('../utils/logger');

const generateToken = (userId) => {
  return jwt.sign(
    { 
      userId, 
      iat: Math.floor(Date.now() / 1000),
      jti: require('crypto').randomBytes(16).toString('hex')
    }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
      issuer: 'sdr-assignment-system',
      audience: 'sdr-users'
    }
  );
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const loginAttempt = {
      username,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    console.log('Login attempt:', { username, password: '[hidden]', ip: req.ip });

    if (!username || !password) {
      await auditLogger.logSystemEvent('LOGIN_FAILED', {
        ...loginAttempt,
        reason: 'Missing credentials'
      });
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      await auditLogger.logSystemEvent('LOGIN_FAILED', {
        ...loginAttempt,
        reason: 'User not found'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await User.validatePassword(password, user.password_hash);
    if (!isValidPassword) {
      await auditLogger.logSystemEvent('LOGIN_FAILED', {
        ...loginAttempt,
        user_id: user.id,
        reason: 'Invalid password'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if MFA is enabled
    if (user.mfa_enabled) {
      // Store user ID in session for MFA verification
      req.session.pendingMFAUserId = user.id;
      
      await auditLogger.logSystemEvent('MFA_REQUIRED', {
        user_id: user.id,
        username: user.username,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      return res.json({
        requiresMFA: true,
        message: 'Please provide your MFA token to complete login'
      });
    }

    const token = generateToken(user.id);
    
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      mfaEnabled: user.mfa_enabled
    };

    await auditLogger.logSystemEvent('LOGIN_SUCCESS', {
      user_id: user.id,
      username: user.username,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    await auditLogger.logError('LOGIN_ERROR', error, {
      username: req.body?.username,
      ip_address: req.ip
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password, role, firstName, lastName } = req.body;

    if (!username || !email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['sdr', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const newUser = await User.create({
      username,
      email,
      password,
      role,
      firstName,
      lastName
    });

    const token = generateToken(newUser.id);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, firstName, lastName } = req.body;

    if (!username || !email || !role || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['sdr', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if username is taken by another user
    const existingUser = await User.findByUsername(username);
    if (existingUser && existingUser.id !== parseInt(id)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const updatedUser = await User.updateUser(id, { username, email, role, firstName, lastName });
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const deletedUser = await User.deleteUser(id);
    
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  register,
  getProfile,
  getAllUsers,
  updateUser,
  deleteUser
};