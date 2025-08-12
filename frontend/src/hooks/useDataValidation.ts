import { useState, useCallback } from 'react';

// Simple sanitization function to avoid DOMPurify dependency  
function sanitizeHTML(input: string): string {
  // Basic XSS prevention - remove potentially dangerous characters and patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags for simple text inputs
    .trim();
}

interface ValidationRule {
  field: string;
  validator: (value: any) => boolean;
  message: string;
}

interface ValidationError {
  field: string;
  message: string;
}

export const useDataValidation = () => {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState(true);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Phone validation regex (supports various formats)
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$|^[\+]?[(]?[0-9]{3}[)]?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4,6}$/;

  // Sanitize input to prevent XSS and injection attacks
  const sanitizeInput = useCallback((input: string): string => {
    if (typeof input !== 'string') return '';
    
    // Remove HTML tags and dangerous characters
    const sanitized = sanitizeHTML(input);
    
    // Additional sanitization for common injection patterns
    return sanitized
      .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }, []);

  // Validate email format
  const validateEmail = useCallback((email: string): boolean => {
    if (!email) return false;
    return emailRegex.test(email.toLowerCase().trim());
  }, [emailRegex]);

  // Validate phone number format
  const validatePhone = useCallback((phone: string): boolean => {
    if (!phone) return false;
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 10;
  }, [phoneRegex]);

  // Validate required fields
  const validateRequired = useCallback((value: any): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !isNaN(value);
    return value != null;
  }, []);

  // Validate lead ID format
  const validateLeadId = useCallback((leadId: string): boolean => {
    if (!leadId) return false;
    const sanitized = sanitizeInput(leadId);
    // Allow alphanumeric, hyphens, and underscores, 3-50 characters
    return /^[a-zA-Z0-9_-]{3,50}$/.test(sanitized);
  }, [sanitizeInput]);

  // Validate company/lead name
  const validateCompanyName = useCallback((name: string): boolean => {
    if (!name) return false;
    const sanitized = sanitizeInput(name);
    return sanitized.length >= 2 && sanitized.length <= 100;
  }, [sanitizeInput]);

  // Run validation on form data
  const validateForm = useCallback((data: Record<string, any>, rules: ValidationRule[]): boolean => {
    const newErrors: ValidationError[] = [];

    rules.forEach(rule => {
      const value = data[rule.field];
      if (!rule.validator(value)) {
        newErrors.push({
          field: rule.field,
          message: rule.message
        });
      }
    });

    setErrors(newErrors);
    setIsValid(newErrors.length === 0);
    return newErrors.length === 0;
  }, []);

  // Real-time field validation
  const validateField = useCallback((field: string, value: any, rules: ValidationRule[]): string | null => {
    const rule = rules.find(r => r.field === field);
    if (!rule) return null;

    if (!rule.validator(value)) {
      return rule.message;
    }

    // Remove error for this field if it exists
    setErrors(prev => prev.filter(error => error.field !== field));
    return null;
  }, []);

  // Get validation rules for lead assignment form
  const getLeadAssignmentRules = useCallback((): ValidationRule[] => [
    {
      field: 'leadId',
      validator: validateLeadId,
      message: 'Lead ID must be 3-50 characters, alphanumeric with hyphens/underscores only'
    },
    {
      field: 'leadName',
      validator: validateCompanyName,
      message: 'Lead/Company name must be 2-100 characters'
    }
  ], [validateLeadId, validateCompanyName]);

  // Get validation rules for consultant form
  const getConsultantRules = useCallback((): ValidationRule[] => [
    {
      field: 'name',
      validator: validateCompanyName,
      message: 'Consultant name must be 2-100 characters'
    },
    {
      field: 'email',
      validator: validateEmail,
      message: 'Please enter a valid email address'
    },
    {
      field: 'phone',
      validator: (phone: string) => !phone || validatePhone(phone),
      message: 'Please enter a valid phone number (10+ digits)'
    }
  ], [validateCompanyName, validateEmail, validatePhone]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
    setIsValid(true);
  }, []);

  // Get error for specific field
  const getFieldError = useCallback((field: string): string | null => {
    const error = errors.find(e => e.field === field);
    return error ? error.message : null;
  }, [errors]);

  // Check for duplicate data (would need API integration)
  const checkDuplicateLead = useCallback(async (leadId: string, leadName: string): Promise<boolean> => {
    // This would integrate with your API to check for duplicates
    // For now, return false (no duplicates)
    try {
      // Mock implementation - replace with actual API call
      const response = await fetch('/api/leads/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, leadName })
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.isDuplicate;
      }
    } catch (error) {
      console.warn('[Validation] Could not check for duplicates:', error);
    }
    
    return false;
  }, []);

  return {
    errors,
    isValid,
    validateForm,
    validateField,
    validateEmail,
    validatePhone,
    validateRequired,
    validateLeadId,
    validateCompanyName,
    sanitizeInput,
    getLeadAssignmentRules,
    getConsultantRules,
    clearErrors,
    getFieldError,
    checkDuplicateLead
  };
};