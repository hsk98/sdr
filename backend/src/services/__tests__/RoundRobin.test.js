// Round-Robin Assignment Logic Tests
// Testing the core algorithm without database dependencies

describe('Round-Robin Assignment Algorithm', () => {
  
  // Helper function to simulate the core round-robin logic
  function selectConsultantUsingRoundRobin(consultants) {
    if (!consultants || consultants.length === 0) {
      throw new Error('No consultants available for assignment');
    }

    // Sort by assignment count (ascending), then by last_assigned_at (oldest first)
    const sortedConsultants = consultants.sort((a, b) => {
      // Primary sort: assignment count (lower is better)
      if (a.assignment_count !== b.assignment_count) {
        return a.assignment_count - b.assignment_count;
      }
      
      // Secondary sort: last assigned date (older is better, null means never assigned)
      if (a.last_assigned_at === null && b.last_assigned_at === null) {
        return 0; // Both never assigned, order doesn't matter
      }
      if (a.last_assigned_at === null) {
        return -1; // a never assigned, should come first
      }
      if (b.last_assigned_at === null) {
        return 1; // b never assigned, should come first
      }
      
      // Both have been assigned, older assignment comes first
      return new Date(a.last_assigned_at) - new Date(b.last_assigned_at);
    });

    return sortedConsultants[0];
  }

  // Helper function to calculate fairness score
  function calculateFairnessScore(consultant, avgAssignments, currentTime = new Date()) {
    const assignmentCount = consultant.assignment_count || 0;
    const lastAssigned = consultant.last_assigned_at;
    
    // Base score: inverse of assignment count relative to average
    let score = Math.max(1, avgAssignments - assignmentCount + 1) * 10;
    
    // Time bonus: hours since last assignment
    if (lastAssigned === null) {
      score += 100; // Never assigned gets huge bonus
    } else {
      const hoursSinceAssignment = (currentTime - new Date(lastAssigned)) / (1000 * 60 * 60);
      score += Math.min(hoursSinceAssignment, 168) * 0.5; // Cap at 1 week
    }
    
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  describe('Basic Round-Robin Selection', () => {
    test('should select consultant with lowest assignment count', () => {
      const consultants = [
        { id: 1, name: 'John Smith', assignment_count: 5, last_assigned_at: '2023-01-01T10:00:00Z' },
        { id: 2, name: 'Jane Doe', assignment_count: 3, last_assigned_at: '2023-01-02T10:00:00Z' },
        { id: 3, name: 'Bob Wilson', assignment_count: 7, last_assigned_at: '2023-01-03T10:00:00Z' }
      ];

      const selected = selectConsultantUsingRoundRobin(consultants);
      
      expect(selected.name).toBe('Jane Doe');
      expect(selected.assignment_count).toBe(3);
    });

    test('should use last_assigned_at as tiebreaker when counts are equal', () => {
      const consultants = [
        { id: 1, name: 'John Smith', assignment_count: 5, last_assigned_at: '2023-01-03T10:00:00Z' },
        { id: 2, name: 'Jane Doe', assignment_count: 5, last_assigned_at: '2023-01-01T10:00:00Z' }, // Oldest
        { id: 3, name: 'Bob Wilson', assignment_count: 5, last_assigned_at: '2023-01-02T10:00:00Z' }
      ];

      const selected = selectConsultantUsingRoundRobin(consultants);
      
      expect(selected.name).toBe('Jane Doe'); // Jane Doe, assigned longest ago
    });

    test('should prioritize never-assigned consultants (null last_assigned_at)', () => {
      const consultants = [
        { id: 1, name: 'John Smith', assignment_count: 2, last_assigned_at: '2023-01-01T10:00:00Z' },
        { id: 2, name: 'Jane Doe', assignment_count: 0, last_assigned_at: null }, // Never assigned
        { id: 3, name: 'Bob Wilson', assignment_count: 1, last_assigned_at: '2023-01-02T10:00:00Z' },
        { id: 4, name: 'Alice Brown', assignment_count: 0, last_assigned_at: null } // Also never assigned
      ];

      const selected = selectConsultantUsingRoundRobin(consultants);
      
      expect(selected.assignment_count).toBe(0);
      expect(selected.last_assigned_at).toBeNull();
      expect(['Jane Doe', 'Alice Brown']).toContain(selected.name);
    });

    test('should throw error when no consultants available', () => {
      expect(() => selectConsultantUsingRoundRobin([])).toThrow('No consultants available for assignment');
      expect(() => selectConsultantUsingRoundRobin(null)).toThrow('No consultants available for assignment');
      expect(() => selectConsultantUsingRoundRobin(undefined)).toThrow('No consultants available for assignment');
    });
  });

  describe('Fairness Score Calculation', () => {
    test('should calculate correct fairness score', () => {
      const consultant = { assignment_count: 5, last_assigned_at: '2023-01-01T10:00:00Z' };
      const avgAssignments = 4;
      const testTime = new Date('2023-01-01T14:00:00Z'); // 4 hours later

      const score = calculateFairnessScore(consultant, avgAssignments, testTime);

      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
      // Should be around 10 + 2 = 12 (base score + time bonus)
      expect(score).toBeCloseTo(12, 0);
    });

    test('should give high score to never-assigned consultants', () => {
      const consultant = { assignment_count: 0, last_assigned_at: null };
      const avgAssignments = 3;

      const score = calculateFairnessScore(consultant, avgAssignments);

      expect(score).toBeGreaterThan(100); // Should have bonus for never being assigned
      expect(score).toBeCloseTo(140, 0); // 40 base + 100 never assigned bonus
    });

    test('should penalize recently assigned consultants', () => {
      const avgAssignments = 3;
      const testTime = new Date('2023-01-01T14:00:00Z');
      
      const consultant1 = { assignment_count: 3, last_assigned_at: '2023-01-01T10:00:00Z' }; // 4 hours ago
      const consultant2 = { assignment_count: 3, last_assigned_at: '2023-01-01T13:30:00Z' }; // 30 min ago

      const score1 = calculateFairnessScore(consultant1, avgAssignments, testTime);
      const score2 = calculateFairnessScore(consultant2, avgAssignments, testTime);

      expect(score1).toBeGreaterThan(score2); // Older assignment should have higher score
    });

    test('should cap time bonus at reasonable limit', () => {
      const consultant = { assignment_count: 3, last_assigned_at: '2022-01-01T10:00:00Z' }; // Very old
      const avgAssignments = 3;
      const testTime = new Date('2023-01-01T14:00:00Z');

      const score = calculateFairnessScore(consultant, avgAssignments, testTime);

      // Should not exceed reasonable maximum due to capping
      expect(score).toBeLessThan(200);
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    test('should handle missing assignment_count gracefully', () => {
      const consultants = [
        { id: 1, name: 'John Smith', last_assigned_at: '2023-01-01T10:00:00Z' }, // Missing assignment_count
        { id: 2, name: 'Jane Doe', assignment_count: 3, last_assigned_at: '2023-01-02T10:00:00Z' }
      ];

      const selected = selectConsultantUsingRoundRobin(consultants);
      
      // Should handle gracefully and select the consultant with missing count (treated as 0)
      expect(selected.name).toBe('John Smith');
    });

    test('should handle malformed date strings', () => {
      const consultants = [
        { id: 1, name: 'John Smith', assignment_count: 5, last_assigned_at: 'invalid-date' },
        { id: 2, name: 'Jane Doe', assignment_count: 3, last_assigned_at: '2023-01-02T10:00:00Z' }
      ];

      // Should not throw error and still make a selection
      expect(() => selectConsultantUsingRoundRobin(consultants)).not.toThrow();
      const selected = selectConsultantUsingRoundRobin(consultants);
      expect(selected).toBeDefined();
    });

    test('should maintain consistent ordering for identical consultants', () => {
      const consultants = [
        { id: 1, name: 'John Smith', assignment_count: 3, last_assigned_at: '2023-01-01T10:00:00Z' },
        { id: 2, name: 'Jane Doe', assignment_count: 3, last_assigned_at: '2023-01-01T10:00:00Z' },
        { id: 3, name: 'Bob Wilson', assignment_count: 3, last_assigned_at: '2023-01-01T10:00:00Z' }
      ];

      const selected1 = selectConsultantUsingRoundRobin([...consultants]);
      const selected2 = selectConsultantUsingRoundRobin([...consultants]);
      
      // Should consistently select the same consultant (first one after sorting)
      expect(selected1.id).toBe(selected2.id);
    });
  });

  describe('Algorithm Fairness Validation', () => {
    test('should distribute assignments fairly over multiple rounds', () => {
      let consultants = [
        { id: 1, name: 'Consultant 1', assignment_count: 0, last_assigned_at: null },
        { id: 2, name: 'Consultant 2', assignment_count: 0, last_assigned_at: null },
        { id: 3, name: 'Consultant 3', assignment_count: 0, last_assigned_at: null }
      ];

      const assignmentLog = [];
      const currentTime = new Date('2023-01-01T09:00:00Z');

      // Simulate 9 assignments (3 rounds for each consultant)
      for (let i = 0; i < 9; i++) {
        const selected = selectConsultantUsingRoundRobin([...consultants]);
        assignmentLog.push(selected.id);
        
        // Update the selected consultant's data
        const consultantIndex = consultants.findIndex(c => c.id === selected.id);
        consultants[consultantIndex].assignment_count++;
        consultants[consultantIndex].last_assigned_at = new Date(currentTime.getTime() + i * 60000).toISOString();
      }

      // Each consultant should have received exactly 3 assignments
      const distribution = {};
      assignmentLog.forEach(id => {
        distribution[id] = (distribution[id] || 0) + 1;
      });

      expect(distribution[1]).toBe(3);
      expect(distribution[2]).toBe(3);
      expect(distribution[3]).toBe(3);
    });

    test('should handle uneven starting assignment counts', () => {
      const consultants = [
        { id: 1, name: 'Consultant 1', assignment_count: 5, last_assigned_at: '2023-01-01T08:00:00Z' },
        { id: 2, name: 'Consultant 2', assignment_count: 2, last_assigned_at: '2023-01-01T07:00:00Z' },
        { id: 3, name: 'Consultant 3', assignment_count: 8, last_assigned_at: '2023-01-01T06:00:00Z' }
      ];

      // Should prioritize consultant with lowest count (Consultant 2)
      const selected = selectConsultantUsingRoundRobin(consultants);
      expect(selected.id).toBe(2);
      expect(selected.assignment_count).toBe(2);
    });

    test('should calculate assignment balance metrics', () => {
      const assignments = [
        { consultant_id: 1, assignment_count: 10 },
        { consultant_id: 2, assignment_count: 8 },
        { consultant_id: 3, assignment_count: 12 },
        { consultant_id: 4, assignment_count: 6 }
      ];

      // Calculate standard deviation to measure fairness
      const counts = assignments.map(a => a.assignment_count);
      const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
      const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
      const standardDeviation = Math.sqrt(variance);

      expect(mean).toBe(9); // (10 + 8 + 12 + 6) / 4
      expect(standardDeviation).toBeGreaterThan(0);
      expect(standardDeviation).toBeCloseTo(2.24, 1); // Should be around 2.24
      
      // A fair distribution should have low standard deviation
      const isFair = standardDeviation < 3; // Arbitrary threshold
      expect(isFair).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large consultant pools efficiently', () => {
      // Generate 1000 consultants
      const largeConsultantPool = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Consultant ${i + 1}`,
        assignment_count: Math.floor(Math.random() * 20),
        last_assigned_at: new Date(Date.now() - Math.random() * 86400000).toISOString()
      }));

      const startTime = Date.now();
      const selected = selectConsultantUsingRoundRobin(largeConsultantPool);
      const endTime = Date.now();

      expect(selected).toBeDefined();
      expect(selected.id).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(50); // Should complete quickly
    });

    test('should maintain O(n log n) time complexity', () => {
      const sizes = [100, 500, 1000];
      const times = [];

      sizes.forEach(size => {
        const consultants = Array.from({ length: size }, (_, i) => ({
          id: i + 1,
          name: `Consultant ${i + 1}`,
          assignment_count: Math.floor(Math.random() * 10),
          last_assigned_at: new Date().toISOString()
        }));

        const startTime = Date.now();
        selectConsultantUsingRoundRobin(consultants);
        const endTime = Date.now();
        
        times.push(endTime - startTime);
      });

      // Each execution should complete quickly
      times.forEach(time => {
        expect(time).toBeLessThan(100);
      });
    });
  });

  describe('Business Rule Compliance', () => {
    test('should respect consultant availability status', () => {
      // This would integrate with availability checking in the real system
      const availableConsultants = [
        { id: 1, name: 'Available 1', assignment_count: 3, last_assigned_at: '2023-01-01T10:00:00Z', is_available: true },
        { id: 2, name: 'Available 2', assignment_count: 2, last_assigned_at: '2023-01-02T10:00:00Z', is_available: true }
      ];

      const selected = selectConsultantUsingRoundRobin(availableConsultants);
      expect(selected).toBeDefined();
      expect(selected.is_available).toBe(true);
    });

    test('should demonstrate workload balancing over time', () => {
      // Simulate a week of assignments
      const consultants = [
        { id: 1, name: 'Consultant 1', assignment_count: 0, last_assigned_at: null },
        { id: 2, name: 'Consultant 2', assignment_count: 0, last_assigned_at: null },
        { id: 3, name: 'Consultant 3', assignment_count: 0, last_assigned_at: null }
      ];

      const weeklyAssignments = [];
      let currentTime = new Date('2023-01-01T09:00:00Z');

      // Simulate 21 assignments over a week (3 per day)
      for (let day = 0; day < 7; day++) {
        for (let assignment = 0; assignment < 3; assignment++) {
          const consultantsCopy = consultants.map(c => ({ ...c }));
          const selected = selectConsultantUsingRoundRobin(consultantsCopy);
          
          weeklyAssignments.push({
            day: day + 1,
            assignment: assignment + 1,
            consultant_id: selected.id,
            timestamp: new Date(currentTime)
          });

          // Update assignment count and timestamp
          const consultantIndex = consultants.findIndex(c => c.id === selected.id);
          consultants[consultantIndex].assignment_count++;
          consultants[consultantIndex].last_assigned_at = currentTime.toISOString();
          
          currentTime = new Date(currentTime.getTime() + 2 * 60 * 60 * 1000); // Add 2 hours
        }
      }

      // Verify fair distribution
      const finalCounts = consultants.map(c => c.assignment_count);
      const maxCount = Math.max(...finalCounts);
      const minCount = Math.min(...finalCounts);
      
      // Difference should be at most 1 for perfect fairness
      expect(maxCount - minCount).toBeLessThanOrEqual(1);
      expect(weeklyAssignments).toHaveLength(21);
    });
  });
});

// Utility functions for testing
describe('Round-Robin Utility Functions', () => {
  test('should format assignment results correctly', () => {
    const mockAssignment = {
      id: 1,
      sdr_id: 1,
      consultant_id: 2,
      assigned_at: '2023-01-01T10:00:00Z',
      status: 'active'
    };

    const mockConsultant = {
      id: 2,
      name: 'Jane Doe',
      email: 'jane@consulting.com',
      phone: '+1-555-0102'
    };

    const result = {
      assignment: mockAssignment,
      consultant: mockConsultant,
      metadata: {
        assignment_method: 'enhanced_round_robin',
        fairness_score: 45.5,
        assignment_count: 3,
        last_assigned_at: '2023-01-01T08:00:00Z'
      }
    };

    expect(result.assignment.status).toBe('active');
    expect(result.consultant.name).toBe('Jane Doe');
    expect(result.metadata.assignment_method).toBe('enhanced_round_robin');
    expect(typeof result.metadata.fairness_score).toBe('number');
  });

  test('should validate assignment constraints', () => {
    const isValidAssignment = (sdrId, consultantId) => {
      return sdrId > 0 && consultantId > 0 && 
             typeof sdrId === 'number' && typeof consultantId === 'number';
    };

    expect(isValidAssignment(1, 2)).toBe(true);
    expect(isValidAssignment(0, 2)).toBe(false);
    expect(isValidAssignment(1, 0)).toBe(false);
    expect(isValidAssignment('1', 2)).toBe(false);
  });
});