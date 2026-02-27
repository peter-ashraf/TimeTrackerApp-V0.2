/**
 * Haptic Feedback Utilities
 * Provides vibration patterns for different user interactions
 */

// Check if vibration API is supported
const isVibrationSupported = () => {
  return 'vibrate' in navigator;
};

// Get user preference for haptic feedback
const getHapticPreference = () => {
  const preference = localStorage.getItem('hapticFeedbackEnabled');
  return preference !== null ? preference === 'true' : true; // Default to enabled
};

// Set user preference for haptic feedback
const setHapticPreference = (enabled) => {
  localStorage.setItem('hapticFeedbackEnabled', enabled.toString());
};

// Safe vibration function with preference check
const vibrate = (pattern) => {
  if (!isVibrationSupported() || !getHapticPreference()) {
    return false;
  }
  
  try {
    navigator.vibrate(pattern);
    return true;
  } catch (error) {
    
    return false;
  }
};

// Different vibration patterns
const hapticPatterns = {
  // Light tap for button clicks
  light: [10],
  
  // Medium pulse for toggle switches
  medium: [50],
  
  // Strong pulse for important actions (check-in/out)
  strong: [100],
  
  // Success pattern (double tap)
  success: [50, 50, 50],
  
  // Error pattern (long vibration)
  error: [200],
  
  // Warning pattern (triple short)
  warning: [30, 30, 30],
  
  // Notification pattern (long-short-long)
  notification: [100, 50, 100],
  
  // Subtle pattern for minor interactions
  subtle: [5]
};

// Haptic feedback functions for different interactions
export const hapticFeedback = {
  // Button click feedback
  buttonClick: () => vibrate(hapticPatterns.light),
  
  // Toggle switch feedback
  toggleSwitch: () => vibrate(hapticPatterns.medium),
  
  // Check-in feedback (success pattern)
  checkIn: () => vibrate(hapticPatterns.success),
  
  // Check-out feedback (strong pulse)
  checkOut: () => vibrate(hapticPatterns.strong),
  
  // Success feedback
  success: () => vibrate(hapticPatterns.success),
  
  // Error feedback
  error: () => vibrate(hapticPatterns.error),
  
  // Warning feedback
  warning: () => vibrate(hapticPatterns.warning),
  
  // Notification feedback
  notification: () => vibrate(hapticPatterns.notification),
  
  // Subtle feedback
  subtle: () => vibrate(hapticPatterns.subtle),
  
  // Custom pattern
  custom: (pattern) => vibrate(pattern),
  
  // Utility functions
  isSupported: isVibrationSupported,
  isEnabled: getHapticPreference,
  setEnabled: setHapticPreference,
  
  // Test all patterns
  testAll: () => {
    Object.entries(hapticPatterns).forEach(([name, pattern]) => {
      setTimeout(() => {
        
        vibrate(pattern);
      }, Object.keys(hapticPatterns).indexOf(name) * 500);
    });
  }
};

export default hapticFeedback;
