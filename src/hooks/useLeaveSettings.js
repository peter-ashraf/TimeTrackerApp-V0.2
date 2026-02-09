import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export function useLeaveSettings() {
  const { getUserData, saveUserData } = useAuth();
  
  const [leaveSettings, setLeaveSettings] = useState(() => ({
    annualVacation: parseFloat(getUserData('annualVacation')) || 10,
    sickDays: parseFloat(getUserData('sickDays')) || 7
  }));

  useEffect(() => {
    saveUserData('annualVacation', leaveSettings.annualVacation);
    saveUserData('sickDays', leaveSettings.sickDays);
  }, [leaveSettings, saveUserData]);

  const updateLeaveSettings = (updates) => {
    setLeaveSettings(prev => ({ ...prev, ...updates }));
  };

  return { leaveSettings, updateLeaveSettings };
}
