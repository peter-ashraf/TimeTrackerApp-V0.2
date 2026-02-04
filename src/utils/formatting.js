/**
 * Format hours to HH:MM format
 */
export function formatTime(hours) {
  if (!hours || isNaN(hours)) return '0:00';
  
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format date to readable string
 */
export function formatDate(date, format = 'DD/MM/YYYY') {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Format currency
 */
export function formatCurrency(amount, currency = 'EGP') {
  if (!amount || isNaN(amount)) return `0 ${currency}`;
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Format time input (HH:MM)
 */
export function formatTimeInput(time) {
  if (!time) return '';
  
  // Remove non-numeric characters except colon
  let cleaned = time.replace(/[^\d:]/g, '');
  
  // Format as HH:MM
  if (cleaned.length >= 2 && !cleaned.includes(':')) {
    cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
  }
  
  // Limit to HH:MM format
  const parts = cleaned.split(':');
  if (parts[0] && parts[0].length > 2) {
    parts[0] = parts[0].slice(0, 2);
  }
  if (parts[1] && parts[1].length > 2) {
    parts[1] = parts[1].slice(0, 2);
  }
  
  return parts.join(':');
}

/**
 * Parse date string to Date object
 */
export function parseDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get day name from date
 */
export function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return days[d.getDay()];
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  
  const now = new Date();
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(d);
}
