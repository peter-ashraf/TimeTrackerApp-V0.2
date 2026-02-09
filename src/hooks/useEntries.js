import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useEntries() {
  const { getUserData, saveUserData } = useAuth();
  
  const [entries, setEntries] = useState(() => {
    const saved = getUserData('timeEntries');
    return saved ? saved : [];
  });

  useEffect(() => {
    saveUserData('timeEntries', entries);
  }, [entries, saveUserData]);

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
