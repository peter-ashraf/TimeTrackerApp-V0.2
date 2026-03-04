import React from 'react';
import { checkPasswordStrength, getPasswordStrengthLabel } from '../utils/passwordStrength';

const PasswordStrengthMeter = ({ password }) => {
  const strength = checkPasswordStrength(password);

  if (!password) {
    return null;
  }

  return (
    <div className="password-strength-meter">
      <div className="strength-label">
        <span>Password Strength:</span>
        <span 
          className="strength-text"
          style={{ color: strength.color }}
        >
          {getPasswordStrengthLabel(strength.strength)}
        </span>
      </div>
      
      <div className="strength-bar-container">
        <div 
          className="strength-bar"
          style={{
            width: `${strength.score}%`,
            backgroundColor: strength.color
          }}
        />
      </div>
      
      <div className="strength-message" style={{ color: strength.color }}>
        {strength.message}
      </div>
      
      <div className="password-requirements">
        <div className="requirement-title">Requirements:</div>
        <div className="requirement-list">
          <div className={`requirement ${strength.checks.length ? 'met' : 'unmet'}`}>
            <span className="check-icon">{strength.checks.length ? '✓' : '○'}</span>
            At least 8 characters
          </div>
          <div className={`requirement ${strength.checks.lowercase ? 'met' : 'unmet'}`}>
            <span className="check-icon">{strength.checks.lowercase ? '✓' : '○'}</span>
            One lowercase letter
          </div>
          <div className={`requirement ${strength.checks.uppercase ? 'met' : 'unmet'}`}>
            <span className="check-icon">{strength.checks.uppercase ? '✓' : '○'}</span>
            One uppercase letter
          </div>
          <div className={`requirement ${strength.checks.numbers ? 'met' : 'unmet'}`}>
            <span className="check-icon">{strength.checks.numbers ? '✓' : '○'}</span>
            One number
          </div>
          <div className={`requirement ${strength.checks.special ? 'met' : 'unmet'}`}>
            <span className="check-icon">{strength.checks.special ? '✓' : '○'}</span>
            One special character (!@#$%^&*...)
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
