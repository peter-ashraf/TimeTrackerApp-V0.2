import React, { useState } from 'react';

import { useTimeTracker } from '../context/TimeTrackerContext';

import ModalShell from './ModalShell';

import * as XLSX from 'xlsx';
import { 
  exportToExcel, 
  generatePDFReport, 
  generatePDFWithCharts,
  sendEmailReport,
  exportCustomDateRange,
  generateReportFromTemplate,
  reportTemplates
} from '../utils/exportUtils';

import hapticFeedback from '../utils/hapticFeedback';

import '../styles/export-modal-enhanced.css';



function ExportModal({ onClose }) {

  const { 

    entries, 

    periods, 

    employee,

    calculateOvertimeDetails,

    confirmModal,

    setConfirmModal

  } = useTimeTracker();



  // Export options state

  const [exportMode, setExportMode] = useState('periods'); // 'periods', 'template', 'custom'

  const [exportFormat, setExportFormat] = useState('excel'); // 'excel', 'pdf', 'email'

  const [reportTemplate, setReportTemplate] = useState('timesheet'); // template type

  const [selectedPeriods, setSelectedPeriods] = useState([]);

  const [exportAllPeriods, setExportAllPeriods] = useState(false);

  const [detailedView, setDetailedView] = useState(true);

  const [includeCharts, setIncludeCharts] = useState(false);

  const [emailRecipient, setEmailRecipient] = useState('');

  const [emailSubject, setEmailSubject] = useState('');

  const [isExporting, setIsExporting] = useState(false);



  // ✅ NEW: Template options

  const [templateMode, setTemplateMode] = useState('period'); // 'period', 'blank', or 'custom'

  const [templatePeriod, setTemplatePeriod] = useState('');

  const [customStartDate, setCustomStartDate] = useState('');

  const [customEndDate, setCustomEndDate] = useState('');



  // ✅ NEW: Custom date range for data export

  const [customExportStart, setCustomExportStart] = useState('');

  const [customExportEnd, setCustomExportEnd] = useState('');



  // Handle period selection

  const handlePeriodToggle = (periodId) => {
    hapticFeedback.subtle(); // Light feedback for checkbox interaction
    
    if (selectedPeriods.includes(periodId)) {
      setSelectedPeriods(selectedPeriods.filter(id => id !== periodId));
    } else {
      setSelectedPeriods([...selectedPeriods, periodId]);
    }
  };



  // Handle "All Periods" toggle

  const handleAllPeriodsToggle = () => {
    hapticFeedback.toggleSwitch(); // Medium feedback for toggle action
    
    if (exportAllPeriods) {
      setExportAllPeriods(false);
      setSelectedPeriods([]);
    } else {
      setExportAllPeriods(true);
      setSelectedPeriods(periods.map(p => p.id));
    }
  };



  // Format date for display

  const formatDate = (dateStr) => {

    const date = new Date(dateStr);

    return date.toLocaleDateString('en-US', { 

      year: 'numeric', 

      month: 'short', 

      day: 'numeric' 

    });

  };



  // Format date for template (DD/MM/YYYY)

  const formatDateTemplate = (dateStr) => {

    const [year, month, day] = dateStr.split('-');

    return `${day}/${month}/${year}`;

  };



  // Format time for export

  const formatTime = (time24) => {

    if (!time24) return '-';

    return time24;

  };



  // Generate Excel data using stored calculated values

  const generatePeriodData = (period) => {

    const periodEntries = entries

      .filter(e => e.date >= period.start && e.date <= period.end)

      .sort((a, b) => a.date.localeCompare(b.date));



    const overtimeDetails = calculateOvertimeDetails 

      ? calculateOvertimeDetails(entries, period.start, period.end)

      : { totalHoursWorked: 0, totalExtraHours: 0, totalExtraHoursWithFactor: 0 };



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



    const rows = periodEntries.map(entry => {

      const hoursWorked = entry.hoursWorked || 0;

      const extraHours = entry.extraHours || 0;

      const extraHoursWithFactor = entry.extraHoursWithFactor || 0;

      const hoursSpentOutside = entry.hoursSpentOutside || 0;



      const firstIn = entry.intervals?.[0]?.in || '-';

      const lastOut = entry.intervals?.[0]?.out || '-';

      const breakIntervals = entry.intervals?.slice(1) || [];

      const breakOutTimes = breakIntervals.map(b => formatTime(b.out)).join(', ') || '-';

      const breakInTimes = breakIntervals.map(b => formatTime(b.in)).join(', ') || '-';



      if (detailedView) {

        return [

          formatDate(entry.date),

          formatTime(firstIn),

          formatTime(lastOut),

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

          formatDate(entry.date),

          formatTime(firstIn),

          formatTime(lastOut),

          entry.type === 'Regular' ? `${hoursWorked.toFixed(2)}h` : entry.type,

          entry.type

        ];

      }

    });



    const totalsRow = detailedView

      ? [

          'TOTAL',

          '',

          '',

          `${overtimeDetails.totalHoursWorked.toFixed(2)}h`,

          `${overtimeDetails.totalExtraHours.toFixed(2)}h`,

          `${overtimeDetails.totalExtraHoursWithFactor.toFixed(2)}h`,

          '',

          '',

          '',

          ''

        ]

      : [

          'TOTAL',

          '',

          '',

          `${overtimeDetails.totalHoursWorked.toFixed(2)}h`,

          ''

        ];



    return [headers, ...rows, totalsRow];

  };



  // ✅ NEW: Generate template with period selection

  const generateTemplate = () => {

    let selectedPeriod = null;

    let dates = [];



    if (templateMode === 'period') {

      if (!templatePeriod) {

        setConfirmModal({

          isOpen: true,

          title: 'Period Not Selected',

          message: 'Please select a period for the template.',

          type: 'warning',

          confirmText: 'OK',

          showCancel: false,

          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })

        });

        return;

      }





      selectedPeriod = periods.find(p => p.id === templatePeriod);

      if (!selectedPeriod) {

        setConfirmModal({

          isOpen: true,

          title: 'Period Not Found',

          message: 'The selected period could not be found. Please try again.',

          type: 'danger',

          confirmText: 'OK',

          showCancel: false,

          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })

        });

        return;

      }



      // Generate all dates in selected period

      const startDate = new Date(selectedPeriod.start);

      const endDate = new Date(selectedPeriod.end);



      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {

        dates.push(new Date(d));

      }

    } else if (templateMode === 'custom') {

      // Validate custom date range

      if (!customStartDate || !customEndDate) {

        setConfirmModal({

          isOpen: true,

          title: 'Dates Required',

          message: 'Please enter both start and end dates for the custom template.',

          type: 'warning',

          confirmText: 'OK',

          showCancel: false,

          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })

        });

        return;

      }

      if (customStartDate > customEndDate) {

        setConfirmModal({

          isOpen: true,

          title: 'Invalid Date Range',

          message: 'Start date must be before end date. Please adjust the dates.',

          type: 'warning',

          confirmText: 'OK',

          showCancel: false,

          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })

        });

        return;

      }



      // Generate all dates in custom range

      const startDate = new Date(customStartDate);

      const endDate = new Date(customEndDate);



      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {

        dates.push(new Date(d));

      }



      selectedPeriod = {

        label: `${customStartDate} to ${customEndDate}`,

        start: customStartDate,

        end: customEndDate

      };

    }



    // Create template headers

    const templateHeaders = [

      'Date (DD/MM/YYYY)',

      'Type',

      'Check In (HH:MM:SS)',

      'Check Out (HH:MM:SS)',

      'Break Out Times',

      'Break In Times',

      'Notes'

    ];



    let templateRows = [];



    if (templateMode === 'blank') {

      // ✅ Completely blank template - just headers with 5 empty rows as examples

      templateRows = Array(5).fill(null).map(() => [

        '', // Date

        'Regular', // Type

        '', // Check In

        '', // Check Out

        '', // Break Out Times

        '', // Break In Times

        ''  // Notes

      ]);

    } else {

      // Period template with dates pre-filled

      templateRows = dates.map(date => {

        const dateStr = date.toISOString().split('T')[0];

        const dayOfWeek = date.getDay();

        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;



        return [

          formatDateTemplate(dateStr),

          isWeekend ? 'Leave' : 'Regular',

          '', // Check In

          '', // Check Out

          '', // Break Out Times

          '', // Break In Times

          ''  // Notes

        ];

      });

    }



    // Create workbook

    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateRows]);



    // Set column widths

    ws['!cols'] = [

      { wch: 18 }, // Date

      { wch: 15 }, // Type

      { wch: 20 }, // Check In

      { wch: 20 }, // Check Out

      { wch: 20 }, // Break Out Times

      { wch: 20 }, // Break In Times

      { wch: 30 }  // Notes

    ];



    XLSX.utils.book_append_sheet(wb, ws, 'Template');



    // Add instructions sheet

    const instructions = [

      ['📋 TIMESHEET TEMPLATE - IMPORT INSTRUCTIONS'],

      [''],

      ['🎯 FILE & SHEET NAMING:'],

      ['• File name: ANY name is accepted (e.g., "My_Timesheet.xlsx", "February_2026.xlsx")'],

      ['• Sheet name: Keep as "Template" OR rename to anything you like'],

      ['• The import will read ALL sheets in your file automatically'],

      [''],

      ['📊 COLUMN HEADERS (Required - keep these exact names):'],

      [''],

      ['Column', 'Description', 'Format / Examples'],

      ['Date', 'Date in DD/MM/YYYY format', '01/02/2026, 28/02/2026'],

      ['Type', 'Day type', 'Regular, Vacation, Sick Leave, Holiday, Leave, To Be Added'],

      ['Check In', 'Check-in time (24-hour with seconds)', '08:30:00, 09:15:00'],

      ['Check Out', 'Check-out time (24-hour with seconds)', '17:30:00, 18:45:00'],

      ['Break Out Times', 'Break end times (comma-separated)', '13:30:00, 15:15:00'],

      ['Break In Times', 'Break start times (comma-separated)', '13:00:00, 15:00:00'],

      ['Notes', 'Any notes (optional)', 'Training, Meeting, etc.'],

      [''],

      ['⚠️ IMPORTANT RULES:'],

      ['1. Date format MUST be DD/MM/YYYY (NOT MM/DD/YYYY)'],

      ['2. Time format MUST be HH:MM:SS in 24-hour (e.g., 14:30:00 NOT 2:30 PM)'],

      ['3. Check Out must be AFTER Check In'],

      ['4. Break times are optional (leave blank if no breaks)'],

      ['5. Multiple breaks: separate times with commas (e.g., "13:30:00, 15:15:00")'],

      ['6. For non-working days (Vacation/Holiday), leave time fields empty'],

      [''],

      ['✅ WHAT GETS CALCULATED AUTOMATICALLY:'],

      ['• Hours Worked (based on Check In/Out and breaks)'],

      ['• Extra Hours (hours beyond 9h standard)'],

      ['• Extra Hours with Factor (1.5x for overtime, 2x for weekends/holidays)'],

      ['• Hours Spent Outside (break time outside allowed 13:00-13:30 window)'],

      [''],

      ['💡 IMPORT TIPS:'],

      ['• You can create multiple sheets for different periods'],

      ['• Import will read ALL sheets automatically'],

      ['• Duplicate dates will be overwritten by imported data'],

      ['• Use "Merge" mode to keep existing data, "Replace" mode to clear everything'],

      [''],

      ['🔄 HOW TO IMPORT:'],

      ['1. Fill in this template with your data'],

      ['2. Save the file (keep as .xlsx format)'],

      ['3. In the app, go to Settings → Import'],

      ['4. Choose "Merge" or "Replace" mode'],

      ['5. Select your file'],

      ['6. Review the preview'],

      ['7. Click "Import" - Done!'],

      [''],

      ['📝 EXAMPLE ROWS:'],

      ['Date', 'Type', 'Check In', 'Check Out', 'Break Out', 'Break In', 'Notes'],

      ['01/02/2026', 'Regular', '08:30:00', '18:00:00', '13:30:00', '13:00:00', 'Normal day'],

      ['02/02/2026', 'Regular', '09:00:00', '19:30:00', '13:30:00, 16:00:00', '13:00:00, 15:45:00', 'Overtime + 2 breaks'],

      ['03/02/2026', 'Vacation', '', '', '', '', 'Paid leave'],

      ['04/02/2026', 'Sick Leave', '', '', '', '', 'Was sick']

    ];



    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);

    wsInstructions['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 35 }];

    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');



    // Export file

    let fileName;

    if (templateMode === 'blank') {

      fileName = `Timesheet_Template_Blank.xlsx`;

    } else if (templateMode === 'custom') {

      fileName = `Timesheet_Template_Custom_${customStartDate}_to_${customEndDate}.xlsx`;

    } else {

      fileName = `Timesheet_Template_${selectedPeriod.label.replace(/\s+/g, '_')}.xlsx`;

    }

    

    XLSX.writeFile(wb, fileName);

    

    const message = templateMode === 'blank'

      ? `✅ Blank template exported!\n\nFile: ${fileName}\nFully customizable - add your own dates and data.`

      : templateMode === 'custom'

      ? `✅ Custom template exported!\n\nFile: ${fileName}\nDate Range: ${customStartDate} to ${customEndDate}\nAll dates pre-filled and ready to use!`

      : `✅ Template exported!\n\nFile: ${fileName}\nPeriod: ${selectedPeriod.label}\nAll dates pre-filled and ready to use!`;

    

    setConfirmModal({

      isOpen: true,

      title: 'Template Downloaded',

      message: message,

      type: 'success',

      confirmText: 'OK',

      showCancel: false,

      onConfirm: () => {

        setConfirmModal({ ...confirmModal, isOpen: false });

        onClose();

      }

    });

  };



  // ✅ NEW: Enhanced export handlers
  const handleEnhancedExport = async () => {
    hapticFeedback.buttonClick(); // Initial button feedback
    setIsExporting(true);
    
    try {
      let data = [];
      let filename = '';
      let selectedPeriod = null;

      // Get data based on export mode
      if (exportMode === 'custom') {
        // Custom date range export
        if (!customExportStart || !customExportEnd) {
          hapticFeedback.warning(); // Warning vibration
          setConfirmModal({
            isOpen: true,
            title: 'Dates Required',
            message: 'Please select both start and end dates for custom export.',
            type: 'warning',
            confirmText: 'OK',
            showCancel: false,
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
          return;
        }

        const filteredEntries = entries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= new Date(customExportStart) && entryDate <= new Date(customExportEnd);
        });

        if (filteredEntries.length === 0) {
          hapticFeedback.warning(); // Warning vibration
          setConfirmModal({
            isOpen: true,
            title: 'No Data',
            message: 'No entries found in the selected date range.',
            type: 'warning',
            confirmText: 'OK',
            showCancel: false,
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
          return;
        }

        data = generateReportFromTemplate(filteredEntries, reportTemplate, { detailedView });
        selectedPeriod = { label: `${customExportStart} to ${customExportEnd}` };
        
      } else if (exportMode === 'periods') {
        // Period-based export
        if (selectedPeriods.length === 0) {
          hapticFeedback.warning(); // Warning vibration
          setConfirmModal({
            isOpen: true,
            title: 'No Periods Selected',
            message: 'Please select at least one period to export.',
            type: 'warning',
            confirmText: 'OK',
            showCancel: false,
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
          return;
        }

        const periodsToExport = periods.filter(p => selectedPeriods.includes(p.id));
        selectedPeriod = periodsToExport.length === 1 ? periodsToExport[0] : { label: 'Multiple Periods' };
        
        // Combine data from all selected periods
        const allEntries = [];
        periodsToExport.forEach(period => {
          const periodEntries = entries.filter(e => e.date >= period.start && e.date <= period.end);
          allEntries.push(...periodEntries);
        });
        
        data = generateReportFromTemplate(allEntries, reportTemplate, { detailedView });
      }

      // Export based on format
      if (exportFormat === 'excel') {
        filename = exportToExcel(data.data, {
          filename: data.filename.replace('.xlsx', ''),
          sheetName: selectedPeriod?.label?.replace(/[:\\/?*\[\]]/g, '-').substring(0, 31) || 'Export',
          includeFormatting: true
        });
        
      } else if (exportFormat === 'pdf') {
        if (includeCharts) {
          // Find chart elements in the DOM
          const chartElements = document.querySelectorAll('.chart-container, .analytics-chart');
          filename = await generatePDFWithCharts(Array.from(chartElements), data.data, {
            title: data.template.name,
            employee,
            period: selectedPeriod
          });
        } else {
          filename = await generatePDFReport(data.data, {
            title: data.template.name,
            employee,
            period: selectedPeriod
          });
        }
        
      } else if (exportFormat === 'email') {
        if (!emailRecipient) {
          hapticFeedback.warning(); // Warning vibration
          setConfirmModal({
            isOpen: true,
            title: 'Email Required',
            message: 'Please enter a recipient email address.',
            type: 'warning',
            confirmText: 'OK',
            showCancel: false,
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
          return;
        }

        // Generate Excel file first
        const excelFilename = exportToExcel(data.data, {
          filename: data.filename.replace('.xlsx', ''),
          sheetName: selectedPeriod?.label?.replace(/[:\\/?*\[\]]/g, '-').substring(0, 31) || 'Export',
          includeFormatting: true
        });

        // Send email
        await sendEmailReport(emailRecipient, emailSubject || data.template.name, {
          filename: excelFilename,
          data: data.data
        });

        hapticFeedback.success(); // Success vibration for email sent
        setConfirmModal({
          isOpen: true,
          title: 'Email Sent Successfully',
          message: `Report has been sent to ${emailRecipient}`,
          type: 'success',
          confirmText: 'OK',
          showCancel: false,
          onConfirm: () => {
            setConfirmModal({ ...confirmModal, isOpen: false });
            onClose();
          }
        });
        
        localStorage.setItem('lastBackupDate', new Date().toISOString());
        return;
      }

      // Success message for non-email exports
      hapticFeedback.success(); // Success vibration for export completed
      setConfirmModal({
        isOpen: true,
        title: 'Export Successful',
        message: `Your ${exportFormat.toUpperCase()} report has been generated!\n\nFile: ${filename}\nTemplate: ${data.template.name}\nPeriod: ${selectedPeriod?.label || 'Custom Range'}`,
        type: 'success',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => {
          setConfirmModal({ ...confirmModal, isOpen: false });
          onClose();
        }
      });
      
      localStorage.setItem('lastBackupDate', new Date().toISOString());
      
    } catch (error) {
      
      hapticFeedback.error(); // Error vibration
      setConfirmModal({
        isOpen: true,
        title: 'Export Failed',
        message: `Failed to generate export: ${error.message}`,
        type: 'danger',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle export
  const handleExport = () => {
    if (exportMode === 'template') {
      generateTemplate();
      return;
    }

    if (exportMode === 'custom' || exportFormat !== 'excel' || reportTemplate !== 'timesheet') {
      handleEnhancedExport();
      return;
    }

    // Legacy Excel export for backwards compatibility
    if (selectedPeriods.length === 0) {
      setConfirmModal({
        isOpen: true,
        title: 'No Periods Selected',
        message: 'Please select at least one period to export.',
        type: 'warning',
        confirmText: 'OK',
        showCancel: false,
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
      });
      return;
    }

    const workbook = XLSX.utils.book_new();
    const periodsToExport = periods.filter(p => selectedPeriods.includes(p.id));

    periodsToExport.forEach(period => {
      const sheetData = generatePeriodData(period);
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      const colWidths = detailedView
        ? [
            { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
            { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 18 },
            { wch: 18 }, { wch: 16 }
          ]
        : [
            { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }
          ];

      worksheet['!cols'] = colWidths;

      let sheetName = period.label
        .replace(/[:\\/?*\[\]]/g, '-')
        .substring(0, 31);

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = periodsToExport.length === 1
      ? `Timesheet_${periodsToExport[0].label.replace(/\s+/g, '_')}_${timestamp}.xlsx`
      : `Timesheet_Multiple_Periods_${timestamp}.xlsx`;

    XLSX.writeFile(workbook, filename);
    localStorage.setItem('lastBackupDate', new Date().toISOString());
    setConfirmModal({
      isOpen: true,
      title: 'Export Successful',
      message: `Your data has been exported!\n\nFile: ${filename}\nPeriods: ${periodsToExport.length}\nView: ${detailedView ? 'Detailed' : 'Simple'}`,
      type: 'success',
      confirmText: 'OK',
      showCancel: false,
      onConfirm: () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        onClose();
      }
    });
  };


  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="export-modal">
      <h3>📤 Enhanced Export Timesheet Data</h3>
      <p className="settings-description">
        Export your timesheet data to Excel, PDF reports, or send via email with advanced formatting options.
      </p>

      {/* Employee Info Preview */}
      <div className="export-preview-box">
        <strong>📋 Employee:</strong> {employee.name || 'Not set'}
      </div>

      {/* Export Mode Selection */}
      <div className="form-group">
        <label className="form-label">Export Mode</label>
        <div className="export-mode-tabs">
          <button
            className={`export-mode-tab ${exportMode === 'periods' ? 'active' : ''}`}
            onClick={() => {
              hapticFeedback.buttonClick();
              setExportMode('periods');
            }}
          >
            📊 Export Data
          </button>
          <button
            className={`export-mode-tab ${exportMode === 'template' ? 'active' : ''}`}
            onClick={() => {
              hapticFeedback.buttonClick();
              setExportMode('template');
            }}
          >
            📋 Empty Template
          </button>
          <button
            className={`export-mode-tab ${exportMode === 'custom' ? 'active' : ''}`}
            onClick={() => {
              hapticFeedback.buttonClick();
              setExportMode('custom');
            }}
          >
            📅 Custom Range
          </button>
        </div>
      </div>

      {/* Export Format Selection */}
      {exportMode !== 'template' && (
        <div className="form-group">
          <label className="form-label">Export Format</label>
          <div className="export-format-options">
            <label className="export-format-option">
              <input
                type="radio"
                name="exportFormat"
                value="excel"
                checked={exportFormat === 'excel'}
                onChange={(e) => {
                  hapticFeedback.buttonClick();
                  setExportFormat(e.target.value);
                }}
              />
              <div className="export-format-content">
                <strong>📊 Excel</strong>
                <small>Formatted spreadsheet with data</small>
              </div>
            </label>
            <label className="export-format-option">
              <input
                type="radio"
                name="exportFormat"
                value="pdf"
                checked={exportFormat === 'pdf'}
                onChange={(e) => {
                  hapticFeedback.buttonClick();
                  setExportFormat(e.target.value);
                }}
              />
              <div className="export-format-content">
                <strong>📄 PDF Report</strong>
                <small>Professional document format</small>
              </div>
            </label>
            <label className="export-format-option">
              <input
                type="radio"
                name="exportFormat"
                value="email"
                checked={exportFormat === 'email'}
                onChange={(e) => {
                  hapticFeedback.buttonClick();
                  setExportFormat(e.target.value);
                }}
              />
              <div className="export-format-content">
                <strong>📧 Email</strong>
                <small>Send report via email</small>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Report Template Selection */}
      {exportMode !== 'template' && exportFormat !== 'excel' && (
        <div className="form-group">
          <label className="form-label">Report Template</label>
          <select
            className="form-control"
            value={reportTemplate}
            onChange={(e) => setReportTemplate(e.target.value)}
          >
            {Object.entries(reportTemplates).map(([key, template]) => (
              <option key={key} value={key}>
                {template.name}
              </option>
            ))}
          </select>
          <small className="form-help">
            {reportTemplates[reportTemplate]?.name} - {reportTemplates[reportTemplate]?.columns?.join(', ')}
          </small>
        </div>
      )}

      {/* PDF Options */}
      {exportFormat === 'pdf' && (
        <div className="export-toggle-container">
          <div className="export-toggle-wrapper">
            <label className="export-toggle-switch">
              <input 
                type="checkbox" 
                checked={includeCharts}
                onChange={(e) => {
                  hapticFeedback.toggleSwitch();
                  setIncludeCharts(e.target.checked);
                }}
              />
              <span className="export-toggle-slider"></span>
            </label>
            <span className="export-toggle-label">
              {includeCharts ? '📈 Include Charts' : '📊 Text Only'}
            </span>
          </div>
          <span className="export-toggle-help">
            {includeCharts 
              ? 'Include charts and graphs in the PDF report' 
              : 'Generate text-only PDF report'
            }
          </span>
        </div>
      )}

      {/* Email Options */}
      {exportFormat === 'email' && (
        <>
          <div className="form-group">
            <label className="form-label">Recipient Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="recipient@example.com"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Subject (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="Timesheet Report"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>
        </>
      )}

      {/* Custom Date Range for Export */}
      {exportMode === 'custom' && (
        <div className="form-group">
          <label className="form-label">Custom Date Range</label>
          <div className="custom-date-inputs">
            <div className="date-input-group">
              <label>Start Date:</label>
              <input
                type="date"
                className="form-control"
                value={customExportStart}
                onChange={(e) => setCustomExportStart(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label>End Date:</label>
              <input
                type="date"
                className="form-control"
                value={customExportEnd}
                onChange={(e) => setCustomExportEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Period Mode - Existing Features */}
      {exportMode === 'periods' && (
        <>
          <div className="export-toggle-container">
            <div className="export-toggle-wrapper">
              <label className="export-toggle-switch">
                <input 
                  type="checkbox" 
                  checked={detailedView}
                  onChange={(e) => {
                    hapticFeedback.toggleSwitch();
                    setDetailedView(e.target.checked);
                  }}
                />
                <span className="export-toggle-slider"></span>
              </label>
              <span className="export-toggle-label">
                {detailedView ? '📊 Detailed View' : '📝 Simple View'}
              </span>
            </div>
            <span className="export-toggle-help">
              {detailedView 
                ? 'Includes extra hours, break times, hours spent outside, and all details'
                : 'Basic view with date, times, and hours worked only'
              }
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Select Periods</label>
            
            <div className="period-checkbox-item">
              <label>
                <input
                  type="checkbox"
                  checked={exportAllPeriods}
                  onChange={handleAllPeriodsToggle}
                />
                <span className="period-checkbox-label">
                  <strong>📅 All Periods ({periods.length})</strong>
                </span>
              </label>
            </div>

            <div className="period-divider"></div>

            <div className="period-checkbox-list">
              {periods.map(period => (
                <div key={period.id} className="period-checkbox-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedPeriods.includes(period.id)}
                      onChange={() => handlePeriodToggle(period.id)}
                      disabled={exportAllPeriods}
                    />
                    <span className="period-checkbox-label">
                      {period.label}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {selectedPeriods.length > 0 && (
            <div className="export-summary">
              <p>
                <strong>📊 Export Summary:</strong><br/>
                {selectedPeriods.length} period(s) selected<br/>
                {detailedView ? 'Detailed' : 'Simple'} view<br/>
                {selectedPeriods.length > 1 ? 'Multiple sheets' : 'Single sheet'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Template Mode - Existing Features */}
      {exportMode === 'template' && (
        <>
          <div className="form-group">
            <label className="form-label">Template Type</label>
            <div className="template-type-options">
              <label className="template-type-option">
                <input
                  type="radio"
                  name="templateMode"
                  value="period"
                  checked={templateMode === 'period'}
                  onChange={(e) => setTemplateMode(e.target.value)}
                />
                <div className="template-type-content">
                  <strong>📅 Period Template</strong>
                  <small>Pre-fill dates for a specific period</small>
                </div>
              </label>
              <label className="template-type-option">
                <input
                  type="radio"
                  name="templateMode"
                  value="blank"
                  checked={templateMode === 'blank'}
                  onChange={(e) => setTemplateMode(e.target.value)}
                />
                <div className="template-type-content">
                  <strong>📝 Blank Template</strong>
                  <small>Completely empty - add your own dates</small>
                </div>
              </label>
              <label className="template-type-option">
                <input
                  type="radio"
                  name="templateMode"
                  value="custom"
                  checked={templateMode === 'custom'}
                  onChange={(e) => setTemplateMode(e.target.value)}
                />
                <div className="template-type-content">
                  <strong>✏️ Custom Template</strong>
                  <small>Create template with custom date range</small>
                </div>
              </label>
            </div>
          </div>

          {templateMode === 'period' && (
            <div className="form-group">
              <label className="form-label">Select Period</label>
              <select
                className="form-control"
                value={templatePeriod}
                onChange={(e) => setTemplatePeriod(e.target.value)}
              >
                <option value="">-- Choose a period --</option>
                {periods.map(period => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {templateMode === 'custom' && (
            <div className="form-group">
              <label className="form-label">Custom Date Range</label>
              <div className="custom-date-inputs">
                <div className="date-input-group">
                  <label>Start Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="date-input-group">
                  <label>End Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="export-info-box template-info">
            <h4>
              {templateMode === 'blank' ? '📝 Blank Template' : 
               templateMode === 'custom' ? '✏️ Custom Template' : '📋 Period Template'}
            </h4>
            {templateMode === 'blank' ? (
              <>
                <p>Download a completely blank template with:</p>
                <ul>
                  <li>✅ Column headers only</li>
                  <li>✅ No pre-filled dates</li>
                  <li>✅ Fully customizable</li>
                  <li>✅ Detailed import instructions</li>
                </ul>
                <p><strong>Perfect for:</strong> Custom date ranges, flexible data entry</p>
              </>
            ) : templateMode === 'custom' ? (
              <>
                <p>Download a template for your custom date range with:</p>
                <ul>
                  <li>✅ All dates pre-filled for your range</li>
                  <li>✅ Weekends marked as "Leave"</li>
                  <li>✅ Empty columns ready to fill</li>
                  <li>✅ Detailed import instructions</li>
                </ul>
                <p><strong>Perfect for:</strong> Specific date ranges, flexible period coverage</p>
              </>
            ) : (
              <>
                <p>Download a template for the selected period with:</p>
                <ul>
                  <li>✅ All dates pre-filled</li>
                  <li>✅ Weekends marked as "Leave"</li>
                  <li>✅ Empty columns ready to fill</li>
                  <li>✅ Detailed import instructions</li>
                </ul>
                <p><strong>Perfect for:</strong> Bulk data entry, period-based import</p>
              </>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="form-actions">
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={handleExport}
          disabled={isExporting || (
            (exportMode === 'periods' && selectedPeriods.length === 0) ||
            (exportMode === 'template' && templateMode === 'period' && !templatePeriod) ||
            (exportMode === 'template' && templateMode === 'custom' && (!customStartDate || !customEndDate)) ||
            (exportMode === 'custom' && (!customExportStart || !customExportEnd)) ||
            (exportFormat === 'email' && !emailRecipient)
          )}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

export default ExportModal;
