import { useState, useEffect } from 'react';

export function useLeaveSettings() {
  const [leaveSettings, setLeaveSettings] = useState({
    annualVacation: parseFloat(localStorage.getItem('annualVacation')) || 10,
    sickDays: parseFloat(localStorage.getItem('sickDays')) || 7
  });

  useEffect(() => {
    localStorage.setItem('annualVacation', leaveSettings.annualVacation);
    localStorage.setItem('sickDays', leaveSettings.sickDays);
  }, [leaveSettings]);

  const updateLeaveSettings = (updates) => {
    setLeaveSettings(prev => ({ ...prev, ...updates }));
  };

  return { leaveSettings, updateLeaveSettings };
}
