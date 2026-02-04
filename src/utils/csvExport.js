// CSV import/export functionality (exact copy from app.csv.js)
export const exportToCSV = (entries) => {
  if (!entries || entries.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = ['Date', 'Check In', 'Check Out', 'Type', 'Duration', 'Hours Spent'];
  const rows = entries.map(entry => [
    entry.date || '',
    entry.intervals?.[0]?.in || entry.checkIn || '',
    entry.intervals?.[0]?.out || entry.checkOut || '',
    entry.type || 'Regular',
    entry.duration || '1',
    entry.hours || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `timesheet_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const triggerFileInput = (onFileRead) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target.result;
        const entries = parseCSV(csv);
        onFileRead(entries);
      } catch (error) {
        alert('Error parsing CSV file: ' + error.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
};

const parseCSV = (csv) => {
  const lines = csv.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    
    const entry = {
      date: values[0],
      type: values[3] || 'Regular',
      duration: parseFloat(values[4]) || 1,
      intervals: [{
        in: values[1] || '',
        out: values[2] || ''
      }]
    };
    
    entries.push(entry);
  }
  
  return entries;
};
