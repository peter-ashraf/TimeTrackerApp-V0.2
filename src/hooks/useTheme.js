import { useState, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

export function useTheme() {
  const [theme, setTheme] = useState('light');

  // Load theme on mount
  useEffect(() => {
    const savedTheme = loadFromStorage('appTheme') || 'light';
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  // Apply theme to document
  const applyTheme = (newTheme) => {
    // Remove all theme classes
    document.documentElement.classList.remove('light', 'dark');
    
    // Add new theme class
    if (newTheme === 'auto') {
      // Use system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.add(systemPrefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.classList.add(newTheme);
    }
  };

  // Update theme
  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    saveToStorage('appTheme', newTheme);
    applyTheme(newTheme);
  };

  return {
    theme,
    updateTheme
  };
}
