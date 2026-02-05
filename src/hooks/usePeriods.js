import { useState, useEffect, useCallback } from 'react';

const DEFAULT_PERIOD = {
  id: 'period-default',
  label: '23 Jan - 20 Feb 2026',
  start: '2026-01-23',
  end: '2026-02-20'
};

export function usePeriods() {
  const [periods, setPeriods] = useState(() => {
    const saved = localStorage.getItem('payPeriods');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed : [DEFAULT_PERIOD];
      } catch (e) {
        return [DEFAULT_PERIOD];
      }
    }
    return [DEFAULT_PERIOD];
  });

  const [currentPeriodId, setCurrentPeriodId] = useState(() => {
    const savedPeriods = localStorage.getItem('payPeriods');
    const savedCurrentId = localStorage.getItem('currentPeriodId');
    let loadedPeriods = [];
    if (savedPeriods) {
      try {
        loadedPeriods = JSON.parse(savedPeriods);
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
    localStorage.setItem('payPeriods', JSON.stringify(periods));
  }, [periods]);

  useEffect(() => {
    if (currentPeriodId) {
      localStorage.setItem('currentPeriodId', currentPeriodId);
    }
  }, [currentPeriodId]);

  const getCurrentPeriod = useCallback(() => {
    if (!periods || periods.length === 0) return null;
    const found = periods.find(p => p.id === currentPeriodId);
    return found || periods[0];
  }, [periods, currentPeriodId]);

  return { periods, setPeriods, currentPeriodId, setCurrentPeriodId, getCurrentPeriod };
}
