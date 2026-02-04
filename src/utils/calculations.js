/**
 * Calculate total hours, overtime, and salary for records
 */
export function calculateTotals(records, config) {
  let totalHours = 0;
  let regularHours = 0;
  let overtime = 0;
  let vacationDays = 0;
  let sickDays = 0;

  records.forEach(record => {
    if (record.type === 'vacation') {
      vacationDays++;
    } else if (record.type === 'sick') {
      sickDays++;
    } else if (record.hoursWorked) {
      const hours = parseFloat(record.hoursWorked);
      totalHours += hours;

      if (hours > config.workingHours) {
        regularHours += config.workingHours;
        overtime += hours - config.workingHours;
      } else {
        regularHours += hours;
      }
    }
  });

  const estimatedSalary = (regularHours * config.hourlyRate) + 
                          (overtime * config.hourlyRate * config.overtimeMultiplier);

  return {
    totalHours: Number(totalHours.toFixed(2)),
    regularHours: Number(regularHours.toFixed(2)),
    overtime: Number(overtime.toFixed(2)),
    estimatedSalary: Number(estimatedSalary.toFixed(2)),
    vacationDays,
    sickDays
  };
}

/**
 * Calculate period statistics
 */
export function calculatePeriodStats(records, config) {
  const workRecords = records.filter(r => r.type !== 'vacation' && r.type !== 'sick' && r.hoursWorked);
  
  const workDays = workRecords.length;
  const totalHours = workRecords.reduce((sum, r) => sum + parseFloat(r.hoursWorked || 0), 0);
  const avgHoursPerDay = workDays > 0 ? totalHours / workDays : 0;
  
  const overtimeHours = workRecords.reduce((sum, r) => {
    const hours = parseFloat(r.hoursWorked || 0);
    return sum + Math.max(0, hours - config.workingHours);
  }, 0);
  
  const overtimePercentage = totalHours > 0 ? (overtimeHours / totalHours) * 100 : 0;

  return {
    workDays,
    avgHoursPerDay: Number(avgHoursPerDay.toFixed(2)),
    overtimePercentage: Number(overtimePercentage.toFixed(2)),
    totalHours: Number(totalHours.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2))
  };
}

/**
 * Calculate hours worked from check-in and check-out times
 */
export function calculateHoursWorked(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;

  const [inHour, inMin] = checkIn.split(':').map(Number);
  const [outHour, outMin] = checkOut.split(':').map(Number);

  const inMinutes = inHour * 60 + inMin;
  const outMinutes = outHour * 60 + outMin;

  const diffMinutes = outMinutes - inMinutes;
  const hours = diffMinutes / 60;

  return Number(hours.toFixed(2));
}

/**
 * Calculate work time (alias for calculateHoursWorked)
 */
export function calculateWorkTime(checkIn, checkOut) {
  return calculateHoursWorked(checkIn, checkOut);
}

/**
 * Validate time format (HH:MM)
 */
export function isValidTimeFormat(time) {
  if (!time) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Check if check-out is after check-in
 */
export function isValidTimeRange(checkIn, checkOut) {
  if (!isValidTimeFormat(checkIn) || !isValidTimeFormat(checkOut)) {
    return false;
  }

  const [inHour, inMin] = checkIn.split(':').map(Number);
  const [outHour, outMin] = checkOut.split(':').map(Number);

  const inMinutes = inHour * 60 + inMin;
  const outMinutes = outHour * 60 + outMin;

  return outMinutes > inMinutes;
}
