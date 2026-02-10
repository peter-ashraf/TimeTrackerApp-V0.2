import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import emailjs from 'emailjs-com';

// Enhanced Excel export with formatting
export const exportToExcel = (data, options = {}) => {
  const {
    filename = 'timesheet_export',
    sheetName = 'Timesheet',
    includeFormatting = true,
    includeCharts = false
  } = options;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  if (includeFormatting) {
    // Set column widths
    const colWidths = data[0]?.map(() => ({ wch: 15 })) || [];
    ws['!cols'] = colWidths;

    // Add header styling
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      
      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    // Add total row styling if present
    const lastRow = data.length - 1;
    if (data[lastRow]?.[0] === 'TOTAL') {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: lastRow, c: C });
        if (!ws[cellAddress]) continue;
        
        ws[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E2EFDA' } }
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${timestamp}.xlsx`;
  
  XLSX.writeFile(wb, fullFilename);
  return fullFilename;
};

// PDF Report Generation
export const generatePDFReport = async (data, options = {}) => {
  const {
    title = 'Timesheet Report',
    employee = {},
    period = {},
    includeCharts = false,
    template = 'timesheet'
  } = options;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight = 10) => {
    if (yPosition + requiredHeight > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Employee and Period Info
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  
  if (employee.name) {
    pdf.text(`Employee: ${employee.name}`, 20, yPosition);
    yPosition += 8;
  }
  
  if (period.label) {
    pdf.text(`Period: ${period.label}`, 20, yPosition);
    yPosition += 8;
  }
  
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
  yPosition += 15;

  // Table Headers
  const headers = data[0] || [];
  const tableData = data.slice(1);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  
  let xPosition = 20;
  const columnWidth = (pageWidth - 40) / headers.length;
  
  headers.forEach(header => {
    pdf.text(header, xPosition, yPosition);
    xPosition += columnWidth;
  });
  yPosition += 8;

  // Table Data
  pdf.setFont('helvetica', 'normal');
  
  tableData.forEach((row, rowIndex) => {
    checkPageBreak();
    
    xPosition = 20;
    row.forEach(cell => {
      const cellText = String(cell || '');
      const textWidth = pdf.getTextWidth(cellText);
      
      if (textWidth > columnWidth - 2) {
        // Truncate long text
        const truncated = cellText.substring(0, Math.floor(columnWidth / 3)) + '...';
        pdf.text(truncated, xPosition, yPosition);
      } else {
        pdf.text(cellText, xPosition, yPosition);
      }
      xPosition += columnWidth;
    });
    yPosition += 7;
  });

  // Footer
  const footer = `Page ${pdf.internal.getNumberOfPages()}`;
  pdf.setFontSize(8);
  pdf.text(footer, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save PDF
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${title.replace(/\s+/g, '_')}_${timestamp}.pdf`;
  pdf.save(filename);
  
  return filename;
};

// PDF Report with Charts (using html2canvas)
export const generatePDFWithCharts = async (chartElements, data, options = {}) => {
  const {
    title = 'Analytics Report',
    employee = {},
    period = {}
  } = options;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Employee Info
  if (employee.name) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Employee: ${employee.name}`, 20, yPosition);
    yPosition += 10;
  }

  // Add charts as images
  for (const chartElement of chartElements) {
    if (yPosition > 150) {
      pdf.addPage();
      yPosition = 20;
    }

    try {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 20, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 20;
    } catch (error) {
      console.error('Error capturing chart:', error);
    }
  }

  // Add summary table
  if (data && data.length > 0) {
    if (yPosition > 120) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary Data', 20, yPosition);
    yPosition += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    data.forEach(row => {
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }
      
      const rowText = Array.isArray(row) ? row.join(' | ') : String(row);
      pdf.text(rowText, 20, yPosition);
      yPosition += 7;
    });
  }

  // Save PDF
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${title.replace(/\s+/g, '_')}_${timestamp}.pdf`;
  pdf.save(filename);
  
  return filename;
};

// Email functionality
export const sendEmailReport = async (recipient, subject, attachmentData, options = {}) => {
  const {
    emailServiceId = process.env.REACT_APP_EMAILJS_SERVICE_ID,
    emailTemplateId = process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
    emailUserId = process.env.REACT_APP_EMAILJS_USER_ID
  } = options;

  if (!emailServiceId || !emailTemplateId || !emailUserId) {
    throw new Error('EmailJS configuration is missing. Please set environment variables.');
  }

  const templateParams = {
    to_email: recipient,
    subject: subject,
    message: `Please find attached the timesheet report generated on ${new Date().toLocaleDateString()}.`,
    attachment_name: attachmentData.filename,
    attachment_data: attachmentData.data
  };

  try {
    const response = await emailjs.send(
      emailServiceId,
      emailTemplateId,
      templateParams,
      emailUserId
    );
    
    return {
      success: true,
      message: 'Email sent successfully',
      response: response
    };
  } catch (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Custom date range export
export const exportCustomDateRange = (entries, startDate, endDate, format = 'excel', options = {}) => {
  const filteredEntries = entries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate >= new Date(startDate) && entryDate <= new Date(endDate);
  });

  if (filteredEntries.length === 0) {
    throw new Error('No entries found in the selected date range');
  }

  const data = formatEntriesForExport(filteredEntries, options.detailedView);
  
  if (format === 'excel') {
    return exportToExcel(data, {
      filename: `timesheet_${startDate}_to_${endDate}`,
      ...options
    });
  } else if (format === 'pdf') {
    return generatePDFReport(data, {
      title: `Timesheet Report ${startDate} to ${endDate}`,
      ...options
    });
  }
};

// Format entries for export
export const formatEntriesForExport = (entries, detailedView = true) => {
  const headers = detailedView 
    ? [
        'Date',
        'Check In',
        'Check Out',
        'Hours Worked',
        'Extra Hours',
        'Extra Hours x1.5',
        'Type',
        'Break Out Times',
        'Break In Times',
        'Hours Spent Outside'
      ]
    : [
        'Date',
        'Check In',
        'Check Out',
        'Hours Worked',
        'Type'
      ];

  const rows = entries.map(entry => {
    const hoursWorked = entry.hoursWorked || 0;
    const extraHours = entry.extraHours || 0;
    const extraHoursWithFactor = entry.extraHoursWithFactor || 0;
    const hoursSpentOutside = entry.hoursSpentOutside || 0;

    const firstIn = entry.intervals?.[0]?.in || '-';
    const lastOut = entry.intervals?.[0]?.out || '-';
    const breakIntervals = entry.intervals?.slice(1) || [];
    const breakOutTimes = breakIntervals.map(b => b.out || '-').join(', ') || '-';
    const breakInTimes = breakIntervals.map(b => b.in || '-').join(', ') || '-';

    if (detailedView) {
      return [
        new Date(entry.date).toLocaleDateString(),
        firstIn,
        lastOut,
        entry.type === 'Regular' ? `${hoursWorked.toFixed(2)}h` : entry.type,
        entry.type === 'Regular' ? `${extraHours.toFixed(2)}h` : '-',
        entry.type === 'Regular' ? `${extraHoursWithFactor.toFixed(2)}h` : '-',
        entry.type,
        breakOutTimes,
        breakInTimes,
        entry.type === 'Regular' ? `${hoursSpentOutside.toFixed(2)}h` : '-'
      ];
    } else {
      return [
        new Date(entry.date).toLocaleDateString(),
        firstIn,
        lastOut,
        entry.type === 'Regular' ? `${hoursWorked.toFixed(2)}h` : entry.type,
        entry.type
      ];
    }
  });

  // Calculate totals
  const totalsRow = detailedView
    ? [
        'TOTAL',
        '',
        '',
        `${entries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0).toFixed(2)}h`,
        `${entries.reduce((sum, e) => sum + (e.extraHours || 0), 0).toFixed(2)}h`,
        `${entries.reduce((sum, e) => sum + (e.extraHoursWithFactor || 0), 0).toFixed(2)}h`,
        '',
        '',
        '',
        ''
      ]
    : [
        'TOTAL',
        '',
        '',
        `${entries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0).toFixed(2)}h`,
        ''
      ];

  return [headers, ...rows, totalsRow];
};

// Multiple report templates
export const reportTemplates = {
  timesheet: {
    name: 'Timesheet Report',
    columns: ['Date', 'Check In', 'Check Out', 'Hours Worked', 'Type'],
    includeTotals: true
  },
  summary: {
    name: 'Summary Report',
    columns: ['Period', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Leave Days'],
    includeTotals: false
  },
  analytics: {
    name: 'Analytics Report',
    columns: ['Metric', 'Value', 'Percentage', 'Trend'],
    includeTotals: false
  },
  detailed: {
    name: 'Detailed Report',
    columns: ['Date', 'Check In', 'Check Out', 'Break Times', 'Hours Worked', 'Extra Hours', 'Hours Outside', 'Type'],
    includeTotals: true
  }
};

// Generate report based on template
export const generateReportFromTemplate = (entries, templateName, options = {}) => {
  const template = reportTemplates[templateName];
  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }

  let data;
  
  switch (templateName) {
    case 'timesheet':
      data = formatEntriesForExport(entries, false);
      break;
    case 'summary':
      data = generateSummaryData(entries);
      break;
    case 'analytics':
      data = generateAnalyticsData(entries);
      break;
    case 'detailed':
      data = formatEntriesForExport(entries, true);
      break;
    default:
      data = formatEntriesForExport(entries, false);
  }

  return {
    data,
    template,
    filename: `${template.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`
  };
};

// Generate summary data for summary template
const generateSummaryData = (entries) => {
  const totalHours = entries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
  const regularHours = entries.filter(e => e.type === 'Regular')
    .reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
  const overtimeHours = entries.reduce((sum, e) => sum + (e.extraHours || 0), 0);
  const leaveDays = entries.filter(e => e.type !== 'Regular').length;

  return [
    ['Metric', 'Value'],
    ['Total Hours', `${totalHours.toFixed(2)}h`],
    ['Regular Hours', `${regularHours.toFixed(2)}h`],
    ['Overtime Hours', `${overtimeHours.toFixed(2)}h`],
    ['Leave Days', leaveDays.toString()],
    ['Working Days', entries.filter(e => e.type === 'Regular').length.toString()]
  ];
};

// Generate analytics data for analytics template
const generateAnalyticsData = (entries) => {
  const totalHours = entries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
  const regularDays = entries.filter(e => e.type === 'Regular').length;
  const avgHoursPerDay = regularDays > 0 ? totalHours / regularDays : 0;
  const overtimeHours = entries.reduce((sum, e) => sum + (e.extraHours || 0), 0);
  const overtimePercentage = totalHours > 0 ? (overtimeHours / totalHours * 100) : 0;

  return [
    ['Metric', 'Value', 'Percentage', 'Trend'],
    ['Total Hours', `${totalHours.toFixed(2)}h`, '100%', '↑'],
    ['Average Hours/Day', `${avgHoursPerDay.toFixed(2)}h`, `${((avgHoursPerDay / 9) * 100).toFixed(1)}%`, avgHoursPerDay >= 9 ? '↑' : '↓'],
    ['Overtime Hours', `${overtimeHours.toFixed(2)}h`, `${overtimePercentage.toFixed(1)}%`, overtimeHours > 0 ? '↑' : '→'],
    ['Productivity Score', avgHoursPerDay >= 9 ? 'Excellent' : avgHoursPerDay >= 8 ? 'Good' : 'Needs Improvement', '', '']
  ];
};
