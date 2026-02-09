import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export function useEmployee() {
  const { getUserData, saveUserData } = useAuth();
  
  const [employee, setEmployee] = useState(() => ({
    name: getUserData('fullName') || '',
    salary: parseFloat(getUserData('salary')) || 0
  }));

  useEffect(() => {
    saveUserData('fullName', employee.name);
    saveUserData('salary', employee.salary);
  }, [employee, saveUserData]);

  const updateEmployee = (updates) => {
    setEmployee(prev => ({ ...prev, ...updates }));
  };

  return { employee, updateEmployee };
}
