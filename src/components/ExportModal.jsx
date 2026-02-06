import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ModalShell from './ModalShell';
import * as XLSX from 'xlsx';

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
  const [exportMode, setExportMode] = useState('periods'); // 'periods' or 'template'
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [exportAllPeriods, setExportAllPeriods] = useState(false);
  const [detailedView, setDetailedView] = useState(true);
  
  // ✅ NEW: Template options
  const [templateMode, setTemplateMode] = useState('period'); // 'period' or 'blank'
  const [templatePeriod, setTemplatePeriod] = useState('');

  // Handle period selection
  const handlePeriodToggle = (periodId) => {
    if (selectedPeriods.includes(periodId)) {
      setSelectedPeriods(selectedPeriods.filter(id => id !== periodId));
    } else {
      setSelectedPeriods([...selectedPeriods, periodId]);
    }
  };

  // Handle "All Periods" toggle
  const handleAllPeriodsToggle = () => {
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
    } else {
      fileName = `Timesheet_Template_${selectedPeriod.label.replace(/\s+/g, '_')}.xlsx`;
    }
    
    XLSX.writeFile(wb, fileName);
    
    const message = templateMode === 'blank'
      ? `✅ Blank template exported!\n\nFile: ${fileName}\nFully customizable - add your own dates and data.`
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

  // Handle export
  const handleExport = () => {
    if (exportMode === 'template') {
      generateTemplate();
      return;
    }

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
    <ModalShell onClose={onClose} contentClassName="export-modal">
      <h3>📤 Export Timesheet Data</h3>
      <p className="settings-description">
        Export your timesheet data to Excel or download an empty template for bulk data entry.
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
              onClick={() => setExportMode('periods')}
            >
              📊 Export Data
            </button>
            <button
              className={`export-mode-tab ${exportMode === 'template' ? 'active' : ''}`}
              onClick={() => setExportMode('template')}
            >
              📋 Empty Template
            </button>
          </div>
        </div>

        {/* ✅ NEW: Template Options */}
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

            <div className="export-info-box template-info">
              <h4>
                {templateMode === 'blank' ? '📝 Blank Template' : '📋 Period Template'}
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

        {/* Period Mode - Existing Features */}
        {exportMode === 'periods' && (
          <>
            <div className="form-group">
              <label className="form-label">Export View</label>
              <div className="toggle-option">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={detailedView}
                    onChange={(e) => setDetailedView(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">
                    {detailedView ? '📊 Detailed View' : '📝 Simple View'}
                  </span>
                </label>
              </div>
              <small className="form-help">
                {detailedView 
                  ? 'Includes extra hours, break times, hours spent outside, and all details'
                  : 'Basic view with date, times, and hours worked only'
                }
              </small>
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

        {/* Actions */}
        <div className="form-actions">
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleExport}
            disabled={
              (exportMode === 'periods' && selectedPeriods.length === 0) ||
              (exportMode === 'template' && templateMode === 'period' && !templatePeriod)
            }
          >
            Export
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
