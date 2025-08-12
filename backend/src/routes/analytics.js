const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/AnalyticsService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get assignment distribution analytics
router.get('/distribution', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    const distribution = await AnalyticsService.getAssignmentDistribution(timeframe);
    res.json(distribution);
  } catch (error) {
    console.error('Error getting distribution analytics:', error);
    res.status(500).json({ error: 'Failed to get distribution analytics' });
  }
});

// Get performance metrics
router.get('/performance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    const metrics = await AnalyticsService.getPerformanceMetrics(timeframe);
    res.json(metrics);
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// Get SDR performance analytics
router.get('/sdr-performance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    const performance = await AnalyticsService.getSDRPerformance(timeframe);
    res.json(performance);
  } catch (error) {
    console.error('Error getting SDR performance:', error);
    res.status(500).json({ error: 'Failed to get SDR performance' });
  }
});

// Get time-based analytics
router.get('/trends', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '30 days', groupBy = 'day' } = req.query;
    const trends = await AnalyticsService.getTimeBasedAnalytics(timeframe, groupBy);
    res.json(trends);
  } catch (error) {
    console.error('Error getting trends:', error);
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

// Get consultant utilization
router.get('/utilization', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    const utilization = await AnalyticsService.getConsultantUtilization(timeframe);
    res.json(utilization);
  } catch (error) {
    console.error('Error getting utilization:', error);
    res.status(500).json({ error: 'Failed to get utilization' });
  }
});

// Get availability analytics
router.get('/availability', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const availability = await AnalyticsService.getAvailabilityAnalytics();
    res.json(availability);
  } catch (error) {
    console.error('Error getting availability analytics:', error);
    res.status(500).json({ error: 'Failed to get availability analytics' });
  }
});

// Get fairness analytics
router.get('/fairness', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    const fairness = await AnalyticsService.getFairnessAnalytics(timeframe);
    res.json(fairness);
  } catch (error) {
    console.error('Error getting fairness analytics:', error);
    res.status(500).json({ error: 'Failed to get fairness analytics' });
  }
});

// Generate custom report
router.post('/custom-report', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const filters = req.body;
    const report = await AnalyticsService.generateCustomReport(filters);
    res.json(report);
  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).json({ error: 'Failed to generate custom report' });
  }
});

// Get dashboard summary
router.get('/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const summary = await AnalyticsService.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    res.status(500).json({ error: 'Failed to get dashboard summary' });
  }
});

module.exports = router;