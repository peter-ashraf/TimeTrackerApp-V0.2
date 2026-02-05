import { useState, useEffect } from 'react';

export function useEmployee() {
  const [employee, setEmployee] = useState({
    name: localStorage.getItem('fullName') || '',
    salary: parseFloat(localStorage.getItem('salary')) || 0
  });

  useEffect(() => {
    localStorage.setItem('fullName', employee.name);
    localStorage.setItem('salary', employee.salary);
  }, [employee]);

  const updateEmployee = (updates) => {
    setEmployee(prev => ({ ...prev, ...updates }));
  };

  return { employee, updateEmployee };
}
