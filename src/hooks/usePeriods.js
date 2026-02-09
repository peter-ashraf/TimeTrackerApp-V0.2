import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_PERIOD = {
  id: 'period-default',
  label: '23 Jan - 20 Feb 2026',
  start: '2026-01-23',
  end: '2026-02-20'
};

export function usePeriods() {
  const { getUserData, saveUserData } = useAuth();
  
  const [periods, setPeriods] = useState(() => {
    const saved = getUserData('payPeriods');
    if (saved) {
      try {
        const parsed = saved;
        return parsed.length > 0 ? parsed : [DEFAULT_PERIOD];
      } catch (e) {
        return [DEFAULT_PERIOD];
      }
    }
    return [DEFAULT_PERIOD];
  });

  const [currentPeriodId, setCurrentPeriodId] = useState(() => {
    const savedPeriods = getUserData('payPeriods');
    const savedCurrentId = getUserData('currentPeriodId');
    let loadedPeriods = [];
    if (savedPeriods) {
      try {
        loadedPeriods = savedPeriods;
      } catch (e) {
        // ignore
      }
    }
    if (savedCurrentId && loadedPeriods.some(p => p.id === savedCurrentId)) {
      return savedCurrentId;
    }
    if (loadedPeriods.length > 0) {
      return loadedPeriods[0].id;
    }
    return 'period-default';
  });

  useEffect(() => {
    saveUserData('payPeriods', periods);
  }, [periods, saveUserData]);

  useEffect(() => {
    if (currentPeriodId) {
      saveUserData('currentPeriodId', currentPeriodId);
    }
  }, [currentPeriodId, saveUserData]);

  const getCurrentPeriod = useCallback(() => {
    if (!periods || periods.length === 0) return null;
    const found = periods.find(p => p.id === currentPeriodId);
    return found || periods[0];
  }, [periods, currentPeriodId]);

  return { periods, setPeriods, currentPeriodId, setCurrentPeriodId, getCurrentPeriod };
}
