const Consultant = require('../models/Consultant');
const auditLogger = require('../utils/logger');

const getAllConsultants = async (req, res) => {
  try {
    const consultants = await Consultant.findAll();
    res.json(consultants);
  } catch (error) {
    console.error('Get consultants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getActiveConsultants = async (req, res) => {
  try {
    const consultants = await Consultant.findActive();
    res.json(consultants);
  } catch (error) {
    console.error('Get active consultants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getConsultantById = async (req, res) => {
  try {
    const { id } = req.params;
    const consultant = await Consultant.findById(id);
    
    if (!consultant) {
      return res.status(404).json({ error: 'Consultant not found' });
    }
    
    res.json(consultant);
  } catch (error) {
    console.error('Get consultant by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createConsultant = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const consultant = await Consultant.create({ name, email, phone });
    res.status(201).json(consultant);
  } catch (error) {
    console.error('Create consultant error:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

const updateConsultant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, is_active } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Get current consultant data to compare availability changes
    const currentConsultant = await Consultant.findById(id);
    if (!currentConsultant) {
      return res.status(404).json({ error: 'Consultant not found' });
    }
    
    const consultant = await Consultant.update(id, {
      name,
      email,
      phone,
      is_active
    });
    
    // Log availability changes
    if (currentConsultant.is_active !== is_active) {
      await auditLogger.logConsultantAvailabilityChange(
        parseInt(id),
        is_active,
        req.user.id
      );
    }

    // Log general consultant updates
    await auditLogger.logSystemEvent('CONSULTANT_UPDATED', {
      consultant_id: parseInt(id),
      updated_by: req.user.id,
      changes: {
        name_changed: currentConsultant.name !== name,
        email_changed: currentConsultant.email !== email,
        phone_changed: currentConsultant.phone !== phone,
        availability_changed: currentConsultant.is_active !== is_active
      },
      previous_values: {
        name: currentConsultant.name,
        email: currentConsultant.email,
        phone: currentConsultant.phone,
        is_active: currentConsultant.is_active
      }
    });
    
    res.json(consultant);
  } catch (error) {
    await auditLogger.logError('UPDATE_CONSULTANT_ERROR', error, {
      consultant_id: req.params.id,
      updated_by: req.user?.id
    });
    console.error('Update consultant error:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

const deleteConsultant = async (req, res) => {
  try {
    const { id } = req.params;
    const consultant = await Consultant.delete(id);
    
    if (!consultant) {
      return res.status(404).json({ error: 'Consultant not found' });
    }
    
    res.json({ message: 'Consultant deleted successfully' });
  } catch (error) {
    console.error('Delete consultant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllConsultants,
  getActiveConsultants,
  getConsultantById,
  createConsultant,
  updateConsultant,
  deleteConsultant
};