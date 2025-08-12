const AssignmentService = require('../AssignmentService');
const { Pool } = require('pg');

// Mock the database pool
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn()
    }))
  }))
}));

// Mock the logger
jest.mock('../../utils/logger');

describe('AssignmentService', () => {
  let mockPool;
  let mockQuery;

  beforeEach(() => {
    mockPool = new Pool();
    mockQuery = mockPool.query;
    jest.clearAllMocks();
  });

  describe('Round-Robin Assignment Algorithm', () => {
    test('should select consultant with lowest assignment count', async () => {
      // Mock available consultants with different assignment counts
      const mockConsultants = [
        { id: 1, name: 'John Smith', assignment_count: 5, last_assigned_at: '2023-01-01' },
        { id: 2, name: 'Jane Doe', assignment_count: 3, last_assigned_at: '2023-01-02' },
        { id: 3, name: 'Bob Wilson', assignment_count: 7, last_assigned_at: '2023-01-03' }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockConsultants });

      const result = await AssignmentService.selectConsultantUsingAdvancedRoundRobin();

      expect(result).toEqual(mockConsultants[1]); // Jane Doe with count 3
    });

    test('should use last_assigned_at as tiebreaker when assignment counts are equal', async () => {
      const mockConsultants = [
        { id: 1, name: 'John Smith', assignment_count: 5, last_assigned_at: '2023-01-03' },
        { id: 2, name: 'Jane Doe', assignment_count: 5, last_assigned_at: '2023-01-01' }, // Oldest
        { id: 3, name: 'Bob Wilson', assignment_count: 5, last_assigned_at: '2023-01-02' }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockConsultants });

      const result = await AssignmentService.selectConsultantUsingAdvancedRoundRobin();

      expect(result).toEqual(mockConsultants[1]); // Jane Doe assigned longest ago
    });

    test('should handle consultants with null last_assigned_at (never assigned)', async () => {
      const mockConsultants = [
        { id: 1, name: 'John Smith', assignment_count: 2, last_assigned_at: '2023-01-01' },
        { id: 2, name: 'Jane Doe', assignment_count: 0, last_assigned_at: null }, // Never assigned
        { id: 3, name: 'Bob Wilson', assignment_count: 1, last_assigned_at: '2023-01-02' }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockConsultants });

      const result = await AssignmentService.selectConsultantUsingAdvancedRoundRobin();

      expect(result).toEqual(mockConsultants[1]); // Jane Doe with 0 assignments
    });

    test('should throw error when no consultants are available', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(AssignmentService.selectConsultantUsingAdvancedRoundRobin())
        .rejects.toThrow('No consultants available for assignment');
    });
  });

  describe('Fairness Score Calculation', () => {
    test('should calculate fairness score correctly', () => {
      const consultant = { assignment_count: 5, last_assigned_at: '2023-01-01T10:00:00Z' };
      const avgAssignments = 4;
      const now = new Date('2023-01-01T14:00:00Z'); // 4 hours later

      const score = AssignmentService.calculateFairnessScore(consultant, avgAssignments, now);

      // Score should favor consultant with more assignments (5 vs avg 4) but recent assignment
      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
    });

    test('should handle consultant never assigned (null last_assigned_at)', () => {
      const consultant = { assignment_count: 0, last_assigned_at: null };
      const avgAssignments = 3;
      const now = new Date();

      const score = AssignmentService.calculateFairnessScore(consultant, avgAssignments, now);

      // Should have very high score (favorable for assignment)
      expect(score).toBeGreaterThan(100);
    });

    test('should penalize recently assigned consultants', () => {
      const consultant1 = { assignment_count: 3, last_assigned_at: '2023-01-01T10:00:00Z' };
      const consultant2 = { assignment_count: 3, last_assigned_at: '2023-01-01T13:30:00Z' };
      const avgAssignments = 3;
      const now = new Date('2023-01-01T14:00:00Z');

      const score1 = AssignmentService.calculateFairnessScore(consultant1, avgAssignments, now);
      const score2 = AssignmentService.calculateFairnessScore(consultant2, avgAssignments, now);

      // Consultant1 (assigned 4 hours ago) should have higher score than consultant2 (30 min ago)
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('Assignment Creation', () => {
    test('should create assignment successfully', async () => {
      const sdrId = 1;
      const consultantId = 2;
      const mockAssignment = {
        id: 1,
        sdr_id: sdrId,
        consultant_id: consultantId,
        assigned_at: new Date(),
        status: 'active'
      };

      // Mock the database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [mockAssignment] }) // INSERT assignment
        .mockResolvedValueOnce({ rows: [] }) // UPDATE assignment_counts
        .mockResolvedValueOnce({ rows: [{ id: consultantId, name: 'Jane Doe', email: 'jane@example.com' }] }); // Get consultant details

      const result = await AssignmentService.createAssignment(sdrId, consultantId);

      expect(result.assignment).toEqual(expect.objectContaining({
        id: 1,
        sdr_id: sdrId,
        consultant_id: consultantId
      }));
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    test('should handle assignment creation failure', async () => {
      const sdrId = 1;
      const consultantId = 2;

      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(AssignmentService.createAssignment(sdrId, consultantId))
        .rejects.toThrow('Database error');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(AssignmentService.selectConsultantUsingAdvancedRoundRobin())
        .rejects.toThrow('Connection failed');
    });

    test('should handle malformed consultant data', async () => {
      const mockConsultants = [
        { id: 1, name: 'John Smith' }, // Missing assignment_count and last_assigned_at
        { id: 2, name: 'Jane Doe', assignment_count: null, last_assigned_at: '2023-01-01' }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockConsultants });

      const result = await AssignmentService.selectConsultantUsingAdvancedRoundRobin();

      // Should handle missing data gracefully
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    test('should validate assignment count updates', async () => {
      const consultantId = 1;
      
      // Mock successful update
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await expect(AssignmentService.updateAssignmentCount(consultantId))
        .resolves.not.toThrow();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE assignment_counts'),
        expect.arrayContaining([consultantId])
      );
    });
  });

  describe('Assignment Statistics and Analytics', () => {
    test('should calculate assignment distribution correctly', async () => {
      const mockStats = [
        { consultant_id: 1, assignment_count: 5 },
        { consultant_id: 2, assignment_count: 3 },
        { consultant_id: 3, assignment_count: 7 }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockStats });

      const distribution = await AssignmentService.getAssignmentDistribution();

      expect(distribution).toEqual(mockStats);
      expect(distribution.length).toBe(3);
    });

    test('should identify fairness imbalances', () => {
      const assignments = [
        { consultant_id: 1, assignment_count: 10 },
        { consultant_id: 2, assignment_count: 2 },
        { consultant_id: 3, assignment_count: 8 }
      ];

      const fairnessReport = AssignmentService.analyzeFairness(assignments);

      expect(fairnessReport.isBalanced).toBe(false);
      expect(fairnessReport.standardDeviation).toBeGreaterThan(0);
      expect(fairnessReport.recommendations).toContain('consultant_id: 2');
    });
  });

  describe('Business Rules and Constraints', () => {
    test('should respect consultant availability', async () => {
      const mockAvailableConsultants = [
        { id: 1, name: 'John Smith', assignment_count: 3, last_assigned_at: '2023-01-01' },
        { id: 2, name: 'Jane Doe', assignment_count: 2, last_assigned_at: '2023-01-02' }
      ];

      // Mock the availability check function
      mockQuery.mockResolvedValueOnce({ rows: mockAvailableConsultants });

      const result = await AssignmentService.selectConsultantUsingAdvancedRoundRobin();

      expect(result).toEqual(mockAvailableConsultants[1]); // Jane with lower count
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('check_consultant_availability')
      );
    });

    test('should enforce maximum assignments per day', async () => {
      const sdrId = 1;
      const maxAssignmentsPerDay = 5;

      // Mock current assignments count
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const canAssign = await AssignmentService.canSDRReceiveAssignment(sdrId, maxAssignmentsPerDay);

      expect(canAssign).toBe(false);
    });

    test('should allow assignments under daily limit', async () => {
      const sdrId = 1;
      const maxAssignmentsPerDay = 5;

      // Mock current assignments count
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const canAssign = await AssignmentService.canSDRReceiveAssignment(sdrId, maxAssignmentsPerDay);

      expect(canAssign).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large consultant pool efficiently', async () => {
      // Generate large dataset
      const largeConsultantPool = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Consultant ${i + 1}`,
        assignment_count: Math.floor(Math.random() * 10),
        last_assigned_at: new Date(Date.now() - Math.random() * 86400000).toISOString()
      }));

      mockQuery.mockResolvedValueOnce({ rows: largeConsultantPool });

      const startTime = Date.now();
      const result = await AssignmentService.selectConsultantUsingAdvancedRoundRobin();
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should cache assignment counts for performance', async () => {
      // Test caching mechanism if implemented
      const consultantId = 1;

      mockQuery.mockResolvedValueOnce({ rows: [{ assignment_count: 5 }] });

      const count1 = await AssignmentService.getAssignmentCount(consultantId);
      const count2 = await AssignmentService.getAssignmentCount(consultantId);

      expect(count1).toBe(count2);
      // Should only query database once if caching is implemented
    });
  });
});

// Integration-style tests
describe('AssignmentService Integration', () => {
  test('complete assignment flow', async () => {
    const sdrId = 1;
    
    // Mock the complete flow
    const mockPool = new Pool();
    const mockQuery = mockPool.query;

    // Step 1: Get available consultants
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'John Smith', assignment_count: 2, last_assigned_at: '2023-01-01' },
        { id: 2, name: 'Jane Doe', assignment_count: 1, last_assigned_at: '2023-01-02' }
      ]
    });

    // Step 2: Create assignment
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 1,
        sdr_id: sdrId,
        consultant_id: 2,
        assigned_at: new Date(),
        status: 'active'
      }]
    });

    // Step 3: Update assignment count
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    // Step 4: Get consultant details
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 2, name: 'Jane Doe', email: 'jane@example.com' }]
    });

    const result = await AssignmentService.getNextAssignment(sdrId);

    expect(result).toEqual(expect.objectContaining({
      assignment: expect.objectContaining({
        sdr_id: sdrId,
        consultant_id: 2
      }),
      consultant: expect.objectContaining({
        name: 'Jane Doe'
      })
    }));
  });
});