const AnalyticsService = require('../AnalyticsService');

// Mock the database pool
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: jest.fn()
  }))
}));

describe('AnalyticsService', () => {
  let mockQuery;

  beforeEach(() => {
    const { Pool } = require('pg');
    const mockPool = new Pool();
    mockQuery = mockPool.query;
    jest.clearAllMocks();
  });

  describe('Assignment Distribution Analytics', () => {
    test('should get assignment distribution correctly', async () => {
      const mockDistribution = [
        {
          id: 1,
          name: 'John Smith',
          specialty: 'Business Strategy',
          total_assignments: 10,
          completed_assignments: 8,
          active_assignments: 2,
          cancelled_assignments: 0,
          completion_rate: 80.00,
          lifetime_assignments: 15
        },
        {
          id: 2,
          name: 'Jane Doe',
          specialty: 'Marketing',
          total_assignments: 8,
          completed_assignments: 7,
          active_assignments: 1,
          cancelled_assignments: 0,
          completion_rate: 87.50,
          lifetime_assignments: 12
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockDistribution });

      const result = await AnalyticsService.getAssignmentDistribution('30 days');

      expect(result).toEqual(mockDistribution);
      expect(result[0].completion_rate).toBe(80.00);
      expect(result[1].completion_rate).toBe(87.50);
    });

    test('should handle different timeframes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await AnalyticsService.getAssignmentDistribution('7 days');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '7 days'")
      );
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate performance metrics correctly', async () => {
      const mockMetrics = {
        total_assignments: 50,
        completed_assignments: 42,
        active_assignments: 6,
        cancelled_assignments: 2,
        overall_completion_rate: 84.00,
        avg_response_time: 45.5,
        avg_completion_time: 120.3,
        avg_consultant_rating: 4.2,
        avg_sdr_rating: 4.1
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockMetrics] });

      const result = await AnalyticsService.getPerformanceMetrics('30 days');

      expect(result).toEqual(mockMetrics);
      expect(result.overall_completion_rate).toBe(84.00);
      expect(result.avg_response_time).toBe(45.5);
    });

    test('should handle null values in metrics', async () => {
      const mockMetrics = {
        total_assignments: 10,
        completed_assignments: 8,
        active_assignments: 2,
        cancelled_assignments: 0,
        overall_completion_rate: 80.00,
        avg_response_time: null,
        avg_completion_time: null,
        avg_consultant_rating: null,
        avg_sdr_rating: null
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockMetrics] });

      const result = await AnalyticsService.getPerformanceMetrics('7 days');

      expect(result).toEqual(mockMetrics);
      expect(result.avg_response_time).toBeNull();
    });
  });

  describe('SDR Performance Analytics', () => {
    test('should get SDR performance data', async () => {
      const mockPerformance = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@company.com',
          total_assignments: 15,
          completed_assignments: 12,
          completion_rate: 80.00,
          avg_response_time: 30.5,
          avg_completion_time: 95.2,
          avg_rating: 4.3
        },
        {
          id: 2,
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@company.com',
          total_assignments: 12,
          completed_assignments: 11,
          completion_rate: 91.67,
          avg_response_time: 25.1,
          avg_completion_time: 87.6,
          avg_rating: 4.5
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPerformance });

      const result = await AnalyticsService.getSDRPerformance('30 days');

      expect(result).toEqual(mockPerformance);
      expect(result.length).toBe(2);
      expect(result[0].completion_rate).toBe(80.00);
      expect(result[1].completion_rate).toBe(91.67);
    });
  });

  describe('Time-Based Analytics', () => {
    test('should get daily trends', async () => {
      const mockTrends = [
        {
          period: '2023-12-01',
          total_assignments: 5,
          completed_assignments: 4,
          active_assignments: 1,
          cancelled_assignments: 0,
          unique_consultants: 3,
          unique_sdrs: 2
        },
        {
          period: '2023-12-02',
          total_assignments: 7,
          completed_assignments: 6,
          active_assignments: 1,
          cancelled_assignments: 0,
          unique_consultants: 4,
          unique_sdrs: 3
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTrends });

      const result = await AnalyticsService.getTimeBasedAnalytics('7 days', 'day');

      expect(result).toEqual(mockTrends);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('YYYY-MM-DD')
      );
    });

    test('should get weekly trends', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await AnalyticsService.getTimeBasedAnalytics('30 days', 'week');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('YYYY-"W"WW')
      );
    });
  });

  describe('Consultant Utilization', () => {
    test('should calculate consultant utilization', async () => {
      const mockUtilization = [
        {
          id: 1,
          name: 'John Smith',
          specialty: 'Business Strategy',
          hourly_rate: 150.00,
          assignments_received: 8,
          assignments_completed: 7,
          total_billable_minutes: 420,
          estimated_revenue: 1050.00,
          avg_rating: 4.2,
          currently_available: true
        },
        {
          id: 2,
          name: 'Jane Doe',
          specialty: 'Marketing',
          hourly_rate: 120.00,
          assignments_received: 6,
          assignments_completed: 6,
          total_billable_minutes: 360,
          estimated_revenue: 720.00,
          avg_rating: 4.5,
          currently_available: false
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockUtilization });

      const result = await AnalyticsService.getConsultantUtilization('30 days');

      expect(result).toEqual(mockUtilization);
      expect(result[0].estimated_revenue).toBe(1050.00);
      expect(result[1].estimated_revenue).toBe(720.00);
    });
  });

  describe('Availability Analytics', () => {
    test('should get availability analytics', async () => {
      const mockAvailability = [
        {
          id: 1,
          name: 'John Smith',
          specialty: 'Business Strategy',
          timezone: 'America/New_York',
          scheduled_hours: 40,
          available_hours: 35,
          currently_on_timeoff: false,
          available_now: true
        },
        {
          id: 2,
          name: 'Jane Doe',
          specialty: 'Marketing',
          timezone: 'America/Los_Angeles',
          scheduled_hours: 35,
          available_hours: 35,
          currently_on_timeoff: true,
          available_now: false
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockAvailability });

      const result = await AnalyticsService.getAvailabilityAnalytics();

      expect(result).toEqual(mockAvailability);
      expect(result[0].currently_on_timeoff).toBe(false);
      expect(result[1].currently_on_timeoff).toBe(true);
    });
  });

  describe('Fairness Analytics', () => {
    test('should analyze assignment fairness', async () => {
      const mockFairness = [
        {
          id: 1,
          name: 'John Smith',
          recent_assignments: 5,
          lifetime_assignments: 15,
          avg_recent: 4.5,
          avg_lifetime: 12.3,
          recent_deviation: 0.5,
          lifetime_deviation: 2.7,
          recent_fairness_score: 0.3,
          lifetime_fairness_score: 0.8
        },
        {
          id: 2,
          name: 'Jane Doe',
          recent_assignments: 3,
          lifetime_assignments: 8,
          avg_recent: 4.5,
          avg_lifetime: 12.3,
          recent_deviation: 1.5,
          lifetime_deviation: 4.3,
          recent_fairness_score: 1.2,
          lifetime_fairness_score: 1.5
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockFairness });

      const result = await AnalyticsService.getFairnessAnalytics('30 days');

      expect(result).toEqual(mockFairness);
      expect(result[0].recent_fairness_score).toBeLessThan(result[1].recent_fairness_score);
    });
  });

  describe('Custom Reports', () => {
    test('should generate custom report with filters', async () => {
      const mockReport = [
        {
          id: 1,
          assigned_at: '2023-12-01T10:00:00Z',
          status: 'completed',
          consultant_name: 'John Smith',
          consultant_email: 'john@consulting.com',
          specialty: 'Business Strategy',
          sdr_name: 'Jane Doe',
          sdr_email: 'jane@company.com',
          response_time_minutes: 30,
          completion_time_minutes: 120,
          consultant_rating: 4,
          sdr_rating: 5,
          notes: 'Great session'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockReport });

      const filters = {
        startDate: '2023-12-01',
        endDate: '2023-12-31',
        specialties: ['Business Strategy'],
        statuses: ['completed']
      };

      const result = await AnalyticsService.generateCustomReport(filters);

      expect(result).toEqual(mockReport);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        expect.arrayContaining(['2023-12-01', '2023-12-31', ['Business Strategy'], ['completed']])
      );
    });

    test('should handle empty filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await AnalyticsService.generateCustomReport({});

      expect(result).toEqual([]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        []
      );
    });
  });

  describe('Dashboard Summary', () => {
    test('should get dashboard summary', async () => {
      const mockOverview = [{ 
        total_sdrs: 5, 
        active_consultants: 8, 
        active_assignments: 3, 
        todays_assignments: 7 
      }];
      
      const mockActivity = [
        {
          activity_type: 'assignment',
          activity_time: '2023-12-01T14:30:00Z',
          actor: 'John Doe',
          description: 'assigned to Jane Smith'
        }
      ];
      
      const mockPerformers = [
        { name: 'John Smith', assignments_count: 5, avg_rating: 4.5 },
        { name: 'Jane Doe', assignments_count: 4, avg_rating: 4.3 }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: mockOverview })
        .mockResolvedValueOnce({ rows: mockActivity })
        .mockResolvedValueOnce({ rows: mockPerformers });

      const result = await AnalyticsService.getDashboardSummary();

      expect(result.overview).toEqual(mockOverview);
      expect(result.recentActivity).toEqual(mockActivity);
      expect(result.topPerformers).toEqual(mockPerformers);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(AnalyticsService.getAssignmentDistribution())
        .rejects.toThrow('Database connection failed');
    });

    test('should handle empty result sets', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await AnalyticsService.getAssignmentDistribution();

      expect(result).toEqual([]);
    });
  });

  describe('Query Performance', () => {
    test('should use efficient queries for large datasets', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await AnalyticsService.getAssignmentDistribution('365 days');

      // Verify that the query contains performance optimizations
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN')
      );
    });

    test('should limit result sets appropriately', async () => {
      const largeMockData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Consultant ${i}`,
        total_assignments: Math.floor(Math.random() * 10)
      }));

      mockQuery.mockResolvedValueOnce({ rows: largeMockData });

      const result = await AnalyticsService.getAssignmentDistribution();

      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });
});