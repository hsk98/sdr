const ValidationService = require('../ValidationService');

// Mock the database pool
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: jest.fn()
  }))
}));

describe('ValidationService', () => {
  let mockQuery;

  beforeEach(() => {
    const { Pool } = require('pg');
    const mockPool = new Pool();
    mockQuery = mockPool.query;
    jest.clearAllMocks();
  });

  describe('Entity Validation', () => {
    test('should validate consultant data successfully', async () => {
      // Mock validation rules
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            entity_type: 'consultants',
            field_name: 'name',
            rule_type: 'required',
            rule_config: {},
            error_message: 'Name is required'
          },
          {
            entity_type: 'consultants',
            field_name: 'email',
            rule_type: 'format',
            rule_config: { pattern: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$' },
            error_message: 'Invalid email format'
          }
        ]
      });

      // Mock email uniqueness check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const consultantData = {
        name: 'John Smith',
        email: 'john@example.com',
        phone: '+1-555-0101',
        specialty: 'Business Strategy'
      };

      const result = await ValidationService.validateEntity('consultants', consultantData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect validation errors', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            entity_type: 'consultants',
            field_name: 'name',
            rule_type: 'required',
            rule_config: {},
            error_message: 'Name is required'
          },
          {
            entity_type: 'consultants',
            field_name: 'email',
            rule_type: 'format',
            rule_config: { pattern: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$' },
            error_message: 'Invalid email format'
          }
        ]
      });

      const invalidData = {
        name: '', // Empty name
        email: 'invalid-email', // Invalid format
        phone: 'abc123' // Invalid phone
      };

      const result = await ValidationService.validateEntity('consultants', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Name is required');
      expect(result.errors).toContain('Invalid email format');
    });
  });

  describe('Field Type Validation', () => {
    test('should validate required fields', () => {
      const validation = ValidationService.validateRequired('name', '', false);
      expect(validation.isValid).toBe(false);

      const validation2 = ValidationService.validateRequired('name', 'John Smith', false);
      expect(validation2.isValid).toBe(true);
    });

    test('should validate email format', () => {
      const ruleConfig = { pattern: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$' };
      
      const validation1 = ValidationService.validateFormat('email', 'john@example.com', ruleConfig);
      expect(validation1.isValid).toBe(true);

      const validation2 = ValidationService.validateFormat('email', 'invalid-email', ruleConfig);
      expect(validation2.isValid).toBe(false);
    });

    test('should validate number ranges', () => {
      const ruleConfig = { min: 10, max: 1000, type: 'number' };
      
      const validation1 = ValidationService.validateRange('hourly_rate', 150, ruleConfig);
      expect(validation1.isValid).toBe(true);

      const validation2 = ValidationService.validateRange('hourly_rate', 5, ruleConfig);
      expect(validation2.isValid).toBe(false);

      const validation3 = ValidationService.validateRange('hourly_rate', 1500, ruleConfig);
      expect(validation3.isValid).toBe(false);
    });

    test('should validate string length ranges', () => {
      const ruleConfig = { min: 3, max: 50, type: 'length' };
      
      const validation1 = ValidationService.validateRange('name', 'John Smith', ruleConfig);
      expect(validation1.isValid).toBe(true);

      const validation2 = ValidationService.validateRange('name', 'Jo', ruleConfig);
      expect(validation2.isValid).toBe(false);
    });
  });

  describe('Custom Validators', () => {
    test('should validate phone format', () => {
      const validation1 = ValidationService.validatePhoneFormat('phone', '+1-555-0101', {});
      expect(validation1.isValid).toBe(true);

      const validation2 = ValidationService.validatePhoneFormat('phone', 'abc123', {});
      expect(validation2.isValid).toBe(false);
    });

    test('should validate timezone', () => {
      const validation1 = ValidationService.validateTimezone('timezone', 'America/New_York', {});
      expect(validation1.isValid).toBe(true);

      const validation2 = ValidationService.validateTimezone('timezone', 'Invalid/Timezone', {});
      expect(validation2.isValid).toBe(false);
    });

    test('should validate specialty', () => {
      const validation1 = ValidationService.validateSpecialty('specialty', 'Business Strategy', {});
      expect(validation1.isValid).toBe(true);

      const validation2 = ValidationService.validateSpecialty('specialty', 'Invalid Specialty', {});
      expect(validation2.isValid).toBe(false);
    });
  });

  describe('Batch Validation', () => {
    test('should validate multiple entities', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const dataArray = [
        { name: 'John Smith', email: 'john@example.com' },
        { name: 'Jane Doe', email: 'jane@example.com' },
        { name: '', email: 'invalid-email' } // Invalid data
      ];

      const result = await ValidationService.validateBatch('consultants', dataArray);

      expect(result.summary.total).toBe(3);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(1);
    });
  });

  describe('Dynamic Rule Management', () => {
    test('should add new validation rule', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const ruleId = await ValidationService.addValidationRule(
        'consultants',
        'test_field',
        'required',
        {},
        'Test field is required'
      );

      expect(ruleId).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO validation_rules'),
        expect.arrayContaining(['consultants', 'test_field', 'required'])
      );
    });

    test('should update validation rule', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await ValidationService.updateValidationRule(1, {
        error_message: 'Updated error message',
        is_active: false
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE validation_rules'),
        expect.arrayContaining(['Updated error message', false, 1])
      );
    });

    test('should delete validation rule', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await ValidationService.deleteValidationRule(1);

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM validation_rules WHERE id = $1',
        [1]
      );
    });
  });

  describe('Entity-Specific Validation', () => {
    test('should validate consultant-specific rules', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Email uniqueness check

      const consultantData = {
        name: 'John Smith',
        email: 'john@example.com',
        hourly_rate: 150
      };

      const result = await ValidationService.validateConsultant(consultantData, false);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should detect unreasonable hourly rates', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const consultantData = {
        name: 'John Smith',
        email: 'john@example.com',
        hourly_rate: 5 // Too low
      };

      const result = await ValidationService.validateConsultant(consultantData, false);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('unusually low');
    });

    test('should validate user-specific rules', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Username uniqueness

      const userData = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
        role: 'sdr'
      };

      const result = await ValidationService.validateUser(userData, false);

      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid user roles', async () => {
      const userData = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
        role: 'invalid_role'
      };

      const result = await ValidationService.validateUser(userData, false);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('must be either "sdr" or "admin"');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await ValidationService.validateEntity('consultants', {
        name: 'John Smith',
        email: 'john@example.com'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Validation service error');
    });

    test('should handle invalid regex patterns', () => {
      const ruleConfig = { pattern: '[invalid regex(' };

      expect(() => {
        ValidationService.validateFormat('test', 'value', ruleConfig);
      }).toThrow('Invalid regex pattern');
    });
  });
});