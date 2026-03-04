// Password strength utility
export const checkPasswordStrength = (password) => {
  if (!password) {
    return {
      score: 0,
      strength: 'weak',
      message: 'Password is required',
      color: '#dc3545',
      checks: {
        length: false,
        lowercase: false,
        uppercase: false,
        numbers: false,
        special: false
      }
    };
  }

  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  let score, strength, message, color;

  if (passedChecks === 0) {
    score = 0;
    strength = 'weak';
    message = 'Very weak password';
    color = '#dc3545';
  } else if (passedChecks === 1) {
    score = 20;
    strength = 'weak';
    message = 'Weak password';
    color = '#dc3545';
  } else if (passedChecks === 2) {
    score = 40;
    strength = 'fair';
    message = 'Fair password';
    color = '#ffc107';
  } else if (passedChecks === 3) {
    score = 60;
    strength = 'good';
    message = 'Good password';
    color = '#28a745';
  } else if (passedChecks === 4) {
    score = 80;
    strength = 'strong';
    message = 'Strong password';
    color = '#28a745';
  } else {
    score = 100;
    strength = 'very-strong';
    message = 'Very strong password';
    color = '#28a745';
  }

  // Bonus points for length
  if (password.length >= 12) {
    score = Math.min(100, score + 10);
  }
  if (password.length >= 16) {
    score = Math.min(100, score + 10);
  }

  return {
    score,
    strength,
    message,
    color,
    checks
  };
};

export const getPasswordStrengthLabel = (strength) => {
  const labels = {
    'weak': 'Weak',
    'fair': 'Fair',
    'good': 'Good',
    'strong': 'Strong',
    'very-strong': 'Very Strong'
  };
  return labels[strength] || 'Weak';
};
