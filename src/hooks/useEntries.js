import { useState, useEffect, useCallback } from 'react';

export function useEntries() {
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem('timeEntries');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('timeEntries', JSON.stringify(entries));
  }, [entries]);

  const updateEntry = useCallback((date, updates) => {
    setEntries(prev => prev.map(e => e.date === date ? { ...e, ...updates } : e));
  }, []);

  const deleteEntry = useCallback((date) => {
    setEntries(prev => prev.filter(e => e.date !== date));
  }, []);

  const addEntry = useCallback((entry) => {
    setEntries(prev => [...prev, entry]);
  }, []);

  const clearAllEntries = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, setEntries, updateEntry, deleteEntry, addEntry, clearAllEntries };
}
