const { Pool } = require('pg');
const config = require('../config/database');

class ValidationService {
  constructor() {
    this.pool = new Pool(config);
    this.validationRules = new Map();
    this.loadValidationRules();
  }

  // Load validation rules from database
  async loadValidationRules() {
    try {
      const query = 'SELECT * FROM validation_rules WHERE is_active = true';
      const result = await this.pool.query(query);
      
      result.rows.forEach(rule => {
        const key = `${rule.entity_type}.${rule.field_name}.${rule.rule_type}`;
        this.validationRules.set(key, rule);
      });
    } catch (error) {
      console.error('Error loading validation rules:', error);
    }
  }

  // Validate a single entity
  async validateEntity(entityType, data, isUpdate = false) {
    const errors = [];
    const warnings = [];

    try {
      // Get all validation rules for this entity type
      const entityRules = Array.from(this.validationRules.values())
        .filter(rule => rule.entity_type === entityType);

      for (const rule of entityRules) {
        const fieldValue = data[rule.field_name];
        const ruleConfig = rule.rule_config;

        try {
          const validationResult = this.validateField(
            rule.field_name,
            fieldValue,
            rule.rule_type,
            ruleConfig,
            isUpdate
          );

          if (!validationResult.isValid) {
            errors.push({
              field: rule.field_name,
              message: rule.error_message,
              value: fieldValue,
              rule: rule.rule_type
            });
          }

          if (validationResult.warning) {
            warnings.push({
              field: rule.field_name,
              message: validationResult.warning,
              value: fieldValue
            });
          }
        } catch (validationError) {
          errors.push({
            field: rule.field_name,
            message: `Validation error: ${validationError.message}`,
            value: fieldValue,
            rule: rule.rule_type
          });
        }
      }

      // Additional entity-specific validations
      const entityValidation = await this.validateEntitySpecific(entityType, data, isUpdate);
      errors.push(...entityValidation.errors);
      warnings.push(...entityValidation.warnings);

    } catch (error) {
      errors.push({
        field: 'general',
        message: `Validation service error: ${error.message}`,
        value: null,
        rule: 'system'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.map(e => e.message),
      warnings: warnings.map(w => w.message),
      details: { errors, warnings }
    };
  }

  // Validate a single field based on rule type
  validateField(fieldName, value, ruleType, ruleConfig, isUpdate) {
    switch (ruleType) {
      case 'required':
        return this.validateRequired(fieldName, value, isUpdate);
      
      case 'format':
        return this.validateFormat(fieldName, value, ruleConfig);
      
      case 'range':
        return this.validateRange(fieldName, value, ruleConfig);
      
      case 'custom':
        return this.validateCustom(fieldName, value, ruleConfig);
      
      default:
        throw new Error(`Unknown validation rule type: ${ruleType}`);
    }
  }

  // Required field validation
  validateRequired(fieldName, value, isUpdate) {
    if (isUpdate && value === undefined) {
      // For updates, undefined values are allowed (field not being updated)
      return { isValid: true };
    }

    const isEmpty = value === null || value === undefined || 
                   (typeof value === 'string' && value.trim() === '') ||
                   (Array.isArray(value) && value.length === 0);

    return {
      isValid: !isEmpty,
      warning: isEmpty ? `${fieldName} is required` : null
    };
  }

  // Format validation (regex, email, phone, etc.)
  validateFormat(fieldName, value, ruleConfig) {
    if (value === null || value === undefined || value === '') {
      return { isValid: true }; // Let required rule handle empty values
    }

    const { pattern, flags = 'i' } = ruleConfig;
    
    if (!pattern) {
      throw new Error('Format validation requires a pattern');
    }

    try {
      const regex = new RegExp(pattern, flags);
      const isValid = regex.test(String(value));
      
      return {
        isValid,
        warning: !isValid ? `${fieldName} format is invalid` : null
      };
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }
  }

  // Range validation (numbers, dates, lengths)
  validateRange(fieldName, value, ruleConfig) {
    if (value === null || value === undefined || value === '') {
      return { isValid: true }; // Let required rule handle empty values
    }

    const { min, max, type = 'number' } = ruleConfig;
    let numericValue;

    try {
      switch (type) {
        case 'number':
          numericValue = Number(value);
          if (isNaN(numericValue)) {
            return { isValid: false, warning: `${fieldName} must be a number` };
          }
          break;
        
        case 'length':
          numericValue = String(value).length;
          break;
        
        case 'date':
          numericValue = new Date(value).getTime();
          if (isNaN(numericValue)) {
            return { isValid: false, warning: `${fieldName} must be a valid date` };
          }
          break;
        
        default:
          throw new Error(`Unknown range type: ${type}`);
      }

      const isValid = (min === undefined || numericValue >= min) &&
                     (max === undefined || numericValue <= max);

      let warning = null;
      if (!isValid) {
        if (min !== undefined && max !== undefined) {
          warning = `${fieldName} must be between ${min} and ${max}`;
        } else if (min !== undefined) {
          warning = `${fieldName} must be at least ${min}`;
        } else if (max !== undefined) {
          warning = `${fieldName} must be at most ${max}`;
        }
      }

      return { isValid, warning };
    } catch (error) {
      throw new Error(`Range validation error: ${error.message}`);
    }
  }

  // Custom validation (business logic)
  validateCustom(fieldName, value, ruleConfig) {
    const { validator, params = {} } = ruleConfig;

    switch (validator) {
      case 'unique_email':
        return this.validateUniqueEmail(fieldName, value, params);
      
      case 'phone_format':
        return this.validatePhoneFormat(fieldName, value, params);
      
      case 'timezone':
        return this.validateTimezone(fieldName, value, params);
      
      case 'specialty':
        return this.validateSpecialty(fieldName, value, params);
      
      default:
        throw new Error(`Unknown custom validator: ${validator}`);
    }
  }

  // Custom validator: Unique email
  async validateUniqueEmail(fieldName, value, params) {
    if (!value) return { isValid: true };

    const { table, excludeId } = params;
    let query = `SELECT COUNT(*) FROM ${table} WHERE email = $1`;
    const queryParams = [value];

    if (excludeId) {
      query += ' AND id != $2';
      queryParams.push(excludeId);
    }

    try {
      const result = await this.pool.query(query, queryParams);
      const count = parseInt(result.rows[0].count);
      
      return {
        isValid: count === 0,
        warning: count > 0 ? `Email ${value} is already in use` : null
      };
    } catch (error) {
      throw new Error(`Database error in unique email validation: ${error.message}`);
    }
  }

  // Custom validator: Phone format
  validatePhoneFormat(fieldName, value, params) {
    if (!value) return { isValid: true };

    // Basic international phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const isValid = phoneRegex.test(String(value).replace(/[\s\-\(\)]/g, ''));

    return {
      isValid,
      warning: !isValid ? `${fieldName} must be a valid phone number` : null
    };
  }

  // Custom validator: Timezone
  validateTimezone(fieldName, value, params) {
    if (!value) return { isValid: true };

    try {
      // Try to create a date with the timezone to validate it
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        warning: `${fieldName} must be a valid timezone (e.g., America/New_York)`
      };
    }
  }

  // Custom validator: Specialty
  validateSpecialty(fieldName, value, params) {
    if (!value) return { isValid: true };

    const validSpecialties = [
      'Business Strategy',
      'Marketing',
      'Financial Planning',
      'Operations',
      'Technology',
      'HR & Recruiting',
      'Sales',
      'Legal',
      'Project Management',
      'Data Analysis',
      'Customer Success',
      'Product Management'
    ];

    const isValid = validSpecialties.includes(value);

    return {
      isValid,
      warning: !isValid ? `${fieldName} must be one of: ${validSpecialties.join(', ')}` : null
    };
  }

  // Entity-specific validation
  async validateEntitySpecific(entityType, data, isUpdate) {
    const errors = [];
    const warnings = [];

    switch (entityType) {
      case 'consultants':
        const consultantValidation = await this.validateConsultant(data, isUpdate);
        errors.push(...consultantValidation.errors);
        warnings.push(...consultantValidation.warnings);
        break;
      
      case 'users':
        const userValidation = await this.validateUser(data, isUpdate);
        errors.push(...userValidation.errors);
        warnings.push(...userValidation.warnings);
        break;
      
      case 'assignments':
        const assignmentValidation = await this.validateAssignment(data, isUpdate);
        errors.push(...assignmentValidation.errors);
        warnings.push(...assignmentValidation.warnings);
        break;
    }

    return { errors, warnings };
  }

  // Consultant-specific validation
  async validateConsultant(data, isUpdate) {
    const errors = [];
    const warnings = [];

    // Check hourly rate reasonableness
    if (data.hourly_rate && (data.hourly_rate < 10 || data.hourly_rate > 1000)) {
      warnings.push({
        field: 'hourly_rate',
        message: 'Hourly rate seems unusually low or high',
        value: data.hourly_rate
      });
    }

    // Validate email uniqueness
    if (data.email && !isUpdate) {
      try {
        const emailCheck = await this.pool.query(
          'SELECT COUNT(*) FROM consultants WHERE email = $1',
          [data.email]
        );
        
        if (parseInt(emailCheck.rows[0].count) > 0) {
          errors.push({
            field: 'email',
            message: 'Email address is already registered',
            value: data.email
          });
        }
      } catch (error) {
        warnings.push({
          field: 'email',
          message: 'Could not verify email uniqueness',
          value: data.email
        });
      }
    }

    return { errors, warnings };
  }

  // User-specific validation
  async validateUser(data, isUpdate) {
    const errors = [];
    const warnings = [];

    // Validate role
    if (data.role && !['sdr', 'admin'].includes(data.role)) {
      errors.push({
        field: 'role',
        message: 'Role must be either "sdr" or "admin"',
        value: data.role
      });
    }

    // Password strength validation
    if (data.password && data.password.length < 6) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 6 characters long',
        value: '[hidden]'
      });
    }

    // Username uniqueness
    if (data.username && !isUpdate) {
      try {
        const usernameCheck = await this.pool.query(
          'SELECT COUNT(*) FROM users WHERE username = $1',
          [data.username]
        );
        
        if (parseInt(usernameCheck.rows[0].count) > 0) {
          errors.push({
            field: 'username',
            message: 'Username is already taken',
            value: data.username
          });
        }
      } catch (error) {
        warnings.push({
          field: 'username',
          message: 'Could not verify username uniqueness',
          value: data.username
        });
      }
    }

    return { errors, warnings };
  }

  // Assignment-specific validation
  async validateAssignment(data, isUpdate) {
    const errors = [];
    const warnings = [];

    // Validate consultant exists and is active
    if (data.consultant_id) {
      try {
        const consultantCheck = await this.pool.query(
          'SELECT is_active FROM consultants WHERE id = $1',
          [data.consultant_id]
        );
        
        if (consultantCheck.rows.length === 0) {
          errors.push({
            field: 'consultant_id',
            message: 'Consultant not found',
            value: data.consultant_id
          });
        } else if (!consultantCheck.rows[0].is_active) {
          errors.push({
            field: 'consultant_id',
            message: 'Consultant is not active',
            value: data.consultant_id
          });
        }
      } catch (error) {
        warnings.push({
          field: 'consultant_id',
          message: 'Could not verify consultant status',
          value: data.consultant_id
        });
      }
    }

    // Validate SDR exists
    if (data.sdr_id) {
      try {
        const sdrCheck = await this.pool.query(
          'SELECT role FROM users WHERE id = $1',
          [data.sdr_id]
        );
        
        if (sdrCheck.rows.length === 0) {
          errors.push({
            field: 'sdr_id',
            message: 'SDR not found',
            value: data.sdr_id
          });
        } else if (sdrCheck.rows[0].role !== 'sdr') {
          errors.push({
            field: 'sdr_id',
            message: 'User is not an SDR',
            value: data.sdr_id
          });
        }
      } catch (error) {
        warnings.push({
          field: 'sdr_id',
          message: 'Could not verify SDR status',
          value: data.sdr_id
        });
      }
    }

    return { errors, warnings };
  }

  // Batch validation
  async validateBatch(entityType, dataArray) {
    const results = [];
    
    for (const [index, data] of dataArray.entries()) {
      const validation = await this.validateEntity(entityType, data);
      results.push({
        index,
        data,
        ...validation
      });
    }

    const summary = {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      withWarnings: results.filter(r => r.warnings.length > 0).length
    };

    return { results, summary };
  }

  // Get validation rules for an entity
  getValidationRules(entityType) {
    return Array.from(this.validationRules.values())
      .filter(rule => rule.entity_type === entityType)
      .map(rule => ({
        field: rule.field_name,
        type: rule.rule_type,
        config: rule.rule_config,
        message: rule.error_message
      }));
  }

  // Add new validation rule
  async addValidationRule(entityType, fieldName, ruleType, ruleConfig, errorMessage) {
    const query = `
      INSERT INTO validation_rules (entity_type, field_name, rule_type, rule_config, error_message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [
      entityType,
      fieldName,
      ruleType,
      JSON.stringify(ruleConfig),
      errorMessage
    ]);

    // Reload validation rules
    await this.loadValidationRules();
    
    return result.rows[0].id;
  }

  // Update validation rule
  async updateValidationRule(ruleId, updates) {
    const setParts = [];
    const values = [];
    let paramIndex = 1;

    const updateableFields = ['rule_config', 'error_message', 'is_active'];
    
    for (const field of updateableFields) {
      if (updates.hasOwnProperty(field)) {
        setParts.push(`${field} = $${paramIndex}`);
        values.push(field === 'rule_config' ? JSON.stringify(updates[field]) : updates[field]);
        paramIndex++;
      }
    }

    if (setParts.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(ruleId);
    
    const query = `
      UPDATE validation_rules 
      SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
    `;

    await this.pool.query(query, values);
    
    // Reload validation rules
    await this.loadValidationRules();
  }

  // Delete validation rule
  async deleteValidationRule(ruleId) {
    await this.pool.query('DELETE FROM validation_rules WHERE id = $1', [ruleId]);
    
    // Reload validation rules
    await this.loadValidationRules();
  }
}

module.exports = new ValidationService();