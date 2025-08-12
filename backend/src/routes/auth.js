const express = require('express');
const { login, register, getProfile, getAllUsers, updateUser, deleteUser } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/profile', authenticateToken, getProfile);
router.get('/users', authenticateToken, getAllUsers);
router.put('/users/:id', authenticateToken, updateUser);
router.delete('/users/:id', authenticateToken, deleteUser);

module.exports = router;