/**
 * Environment variables utility
 * 
 * This file provides a consistent way to access environment variables
 * regardless of whether the app is using Create React App (REACT_APP_)
 * or Vite (VITE_) prefixes.
 */

// Helper function to get environment variables with fallbacks
const getEnvVar = (reactAppKey: string, viteKey: string, fallback: string = ''): string => {
  // Check for Vite environment variables
  if (import.meta && typeof import.meta.env !== 'undefined') {
    const viteValue = import.meta.env[viteKey];
    if (viteValue) return viteValue;
  }
  
  // Check for React environment variables
  if (typeof process !== 'undefined' && process.env) {
    const reactValue = process.env[reactAppKey];
    if (reactValue) return reactValue;
  }
  
  // Return fallback if no environment variable is found
  return fallback;
};

// Imagga API credentials
export const IMAGGA_API_KEY = getEnvVar(
  'REACT_APP_IMAGGA_API_KEY', 
  'VITE_IMAGGA_API_KEY',
  'acc_3b4c6292b187491' // Fallback for development
);

export const IMAGGA_API_SECRET = getEnvVar(
  'REACT_APP_IMAGGA_API_SECRET', 
  'VITE_IMAGGA_API_SECRET',
  '94f73d0d8f43055b84be90be2d3f1992' // Fallback for development
);

export const IMAGGA_AUTH = getEnvVar(
  'REACT_APP_IMAGGA_AUTH', 
  'VITE_IMAGGA_AUTH',
  'Basic YWNjXzNiNGM2MjkyYjE4NzQ5MTo5NGY3M2QwZDhmNDMwNTViODRiZTkwYmUyZDNmMTk5Mg==' // Fallback for development
);

// Add other environment variables as needed
