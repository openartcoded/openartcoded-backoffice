import validator from 'validator';

export const isValidEmail = (value?: string | null) => !!value && validator.isEmail(value.trim());

/** belgian / french / dutch mobile phone numbers, same rule as the backend */
export const isValidMobilePhone = (value?: string | null) =>
  !!value && validator.isMobilePhone(value.trim(), ['fr-BE', 'nl-BE', 'fr-FR', 'nl-NL']);

export const required = (label = 'Required') => (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && !value.trim()) ? label : null;

export const emailValidator = (value?: string | null) => (isValidEmail(value) ? null : 'Invalid email');

export const countryCodeValidator = (value?: string | null) =>
  /^[A-Z]{2}$/.test(value ?? '') ? null : 'Two uppercase letters, e.g. BE';
