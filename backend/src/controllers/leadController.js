const Lead = require('../models/Lead');
const auditLogger = require('../utils/logger');

const getAllLeads = async (req, res) => {
  try {
    const leads = await Lead.findAll();
    res.json(leads);
  } catch (error) {
    console.error('Get all leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getQualifiedLeads = async (req, res) => {
  try {
    const leads = await Lead.findQualifiedLeads();
    res.json(leads);
  } catch (error) {
    console.error('Get qualified leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMyLeads = async (req, res) => {
  try {
    const sdrId = req.user.id;
    const leads = await Lead.findBySDR(sdrId);
    res.json(leads);
  } catch (error) {
    console.error('Get my leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createLead = async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      sdrId: req.user.id // Assign to current user if not specified
    };

    const newLead = await Lead.create(leadData);
    
    await auditLogger.logSystemEvent('LEAD_CREATED', {
      lead_id: newLead.id,
      sdr_id: req.user.id,
      company_name: newLead.company_name,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Lead created successfully',
      lead: newLead
    });
  } catch (error) {
    await auditLogger.logError('LEAD_CREATION_ERROR', error, {
      sdr_id: req.user?.id
    });
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedLead = await Lead.update(id, req.body);
    
    if (!updatedLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await auditLogger.logSystemEvent('LEAD_UPDATED', {
      lead_id: id,
      updated_by: req.user.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Lead updated successfully',
      lead: updatedLead
    });
  } catch (error) {
    await auditLogger.logError('LEAD_UPDATE_ERROR', error, {
      lead_id: req.params.id,
      user_id: req.user?.id
    });
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLead = await Lead.delete(id);
    
    if (!deletedLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await auditLogger.logSystemEvent('LEAD_DELETED', {
      lead_id: id,
      deleted_by: req.user.id,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    await auditLogger.logError('LEAD_DELETE_ERROR', error, {
      lead_id: req.params.id,
      user_id: req.user?.id
    });
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllLeads,
  getQualifiedLeads,
  getMyLeads,
  createLead,
  updateLead,
  deleteLead
};