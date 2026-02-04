import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import * as XLSX from 'xlsx';
import '../styles/import-modal.css';

function ImportModal({ onClose }) {
  const { 
    entries, 
    setEntries, 
    periods, 
    setPeriods, 
    calculateHoursWorked 
  } = useTimeTracker();

  // ===== STATE MANAGEMENT =====
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  
  // ✅ NEW: Multi-step flow state
  const [currentStep, setCurrentStep] = useState(1); // 1: File, 2: Period, 3: Conflict
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [periodOption, setPeriodOption] = useState('auto'); // 'auto', 'existing', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [importMode, setImportMode] = useState('merge'); // 'merge' or 'replace'
  const [conflictInfo, setConflictInfo] = useState(null);

  // ===== HELPER FUNCTIONS =====
  
  // Convert Excel time (fraction) to HH:MM:SS
  const excelTimeToString = (excelTime) => {
    if (!excelTime || excelTime === '-') return null;
    
    if (typeof excelTime === 'string' && excelTime.includes(':')) {
      return excelTime.trim();
    }
    
    if (typeof excelTime === 'number') {
      const totalSeconds = Math.round(excelTime * 24 * 60 * 60);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    return null;
  };

  // Convert Excel date (serial number) to YYYY-MM-DD
  const excelDateToString = (excelDate) => {
    if (typeof excelDate === 'number') {
      const date = XLSX.SSF.parse_date_code(excelDate);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    } else if (typeof excelDate === 'string') {
      const dateStr = excelDate.toString().trim();
      const parts = dateStr.split('/');
      
      if (parts.length === 3) {
        const day = String(parts[0]).padStart(2, '0');
        const month = String(parts[1]).padStart(2, '0');
        const year = String(parts[2]);
        return `${year}-${month}-${day}`;
      }
    }
    
    throw new Error(`Invalid date format: ${excelDate}`);
  };

  // ✅ Extract date range from imported entries
  const extractDateRange = (importedEntries) => {
    const dates = importedEntries.map(e => e.entry.date).sort();
    return {
      start: dates[0],
      end: dates[dates.length - 1]
    };
  };

  // ✅ Format period label: "27 Nov - 19 Dec 2025"
  const formatPeriodLabel = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'short' 
      });
    };
    
    const year = end.getFullYear();
    
    return `${formatDate(start)} - ${formatDate(end)} ${year}`;
  };

  // ✅ Check if period exists in periods array
  const findPeriodByDateRange = (start, end) => {
    return periods.find(p => p.start === start && p.end === end);
  };

  // ✅ Check for conflicts (existing data in period)
  const checkForConflicts = (periodStart, periodEnd, importedData) => {
    const existingEntriesInPeriod = entries.filter(e => 
      e.date >= periodStart && e.date <= periodEnd
    );

    return {
      hasExisting: existingEntriesInPeriod.length > 0,
      existingCount: existingEntriesInPeriod.length,
      importingCount: importedData.length,
      periodStart,
      periodEnd
    };
  };

  // ===== FILE PARSING =====
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('❌ Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setPreviewData(null);
    setValidationErrors([]);
    setCurrentStep(1);
    parseExcelFile(file);
  };

  const parseExcelFile = (file) => {
    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        const parsedData = [];
        const errors = [];

        workbook.SheetNames.forEach((sheetName) => {
          if (sheetName.toLowerCase().includes('instruction')) {
            return;
          }

          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

          if (jsonData.length < 2) {
            errors.push(`Sheet "${sheetName}": No data found`);
            return;
          }

          const headers = jsonData[0];
          const dateCol = headers.findIndex(h => h && h.toString().toLowerCase().includes('date'));
          const typeCol = headers.findIndex(h => h && h.toString().toLowerCase().includes('type'));
          const checkInCol = headers.findIndex(h => h && h.toString().toLowerCase().includes('check in'));
          const checkOutCol = headers.findIndex(h => h && h.toString().toLowerCase().includes('check out'));
          const breakOutCol = headers.findIndex(h => h && h.toString().toLowerCase().includes('break out'));
          const breakInCol = headers.findIndex(h => h && h.toString().toLowerCase().includes('break in'));

          if (dateCol === -1 || typeCol === -1) {
            errors.push(`Sheet "${sheetName}": Missing required columns (Date and Type)`);
            return;
          }

          const dataRows = jsonData.slice(1).filter(row => {
            if (!row[dateCol]) return false;
            const firstCell = row[dateCol].toString().toLowerCase();
            return firstCell !== 'total' && firstCell !== '';
          });

          dataRows.forEach((row, rowIndex) => {
            try {
              const dateStr = excelDateToString(row[dateCol]);
              const checkIn = checkInCol !== -1 ? excelTimeToString(row[checkInCol]) : null;
              const checkOut = checkOutCol !== -1 ? excelTimeToString(row[checkOutCol]) : null;
              const type = typeCol !== -1 && row[typeCol] ? row[typeCol].toString().trim() : 'Regular';

              let breakIntervals = [];
              if (breakOutCol !== -1 && breakInCol !== -1) {
                const breakOutValue = row[breakOutCol];
                const breakInValue = row[breakInCol];

                if (breakOutValue && breakOutValue !== '-') {
                  const breakOutTimes = breakOutValue.toString().split(',').map(t => excelTimeToString(t.trim())).filter(t => t);
                  const breakInTimes = breakInValue ? breakInValue.toString().split(',').map(t => excelTimeToString(t.trim())).filter(t => t) : [];

                  breakIntervals = breakOutTimes.map((out, i) => ({
                    in: breakInTimes[i] || null,
                    out: out
                  }));
                }
              }

              const entry = {
                date: dateStr,
                type: type,
                intervals: []
              };

              if (checkIn && checkOut) {
                entry.intervals.push({
                  in: checkIn,
                  out: checkOut
                });
              }

              if (breakIntervals.length > 0) {
                entry.intervals.push(...breakIntervals);
              }

              if (entry.type === 'Regular' && entry.intervals.length > 0) {
                const hoursWorked = calculateHoursWorked 
                  ? calculateHoursWorked(entry.intervals, dateStr)
                  : 0;

                const dayOfWeek = new Date(dateStr).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const standardHours = isWeekend ? 0 : 9;
                const extraHours = hoursWorked - standardHours;
                const extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;

                entry.hoursWorked = hoursWorked;
                entry.extraHours = extraHours;
                entry.extraHoursWithFactor = extraHoursWithFactor;
                entry.hoursSpentOutside = 0;
              } else {
                entry.hoursWorked = 0;
                entry.extraHours = 0;
                entry.extraHoursWithFactor = 0;
                entry.hoursSpentOutside = 0;
              }

              parsedData.push({
                sheetName,
                entry
              });
            } catch (err) {
              errors.push(`Sheet "${sheetName}", Row ${rowIndex + 2}: ${err.message}`);
            }
          });
        });

        setValidationErrors(errors);
        setPreviewData(parsedData);
        setIsProcessing(false);

        // ✅ AUTO-SUGGEST PERIOD after parsing
        if (parsedData.length > 0) {
          const { start, end } = extractDateRange(parsedData);
          const autoSuggestedPeriod = {
            id: `period-${Date.now()}`,
            label: formatPeriodLabel(start, end),
            start,
            end
          };
          setSelectedPeriod(autoSuggestedPeriod);
          setPeriodOption('auto');
          setCustomStartDate(start);
          setCustomEndDate(end);
        }

        if (errors.length > 0) {
          console.warn('Import validation errors:', errors);
        }
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        alert('❌ Failed to parse Excel file. Please check the file format.');
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      alert('❌ Failed to read file');
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // ===== STEP NAVIGATION =====
  
  const handleNextToPeriodSelection = () => {
    if (!previewData || previewData.length === 0) {
      alert('❌ No valid data to proceed');
      return;
    }

    if (validationErrors.length > 0) {
      const confirmProceed = window.confirm(
        `⚠️ Warning: ${validationErrors.length} error(s) found.\n\n` +
        `Some rows may be skipped.\n\n` +
        `Continue anyway?`
      );
      if (!confirmProceed) return;
    }

    setCurrentStep(2);
  };

  const handlePeriodConfirm = () => {
    let finalPeriod = null;

    // Determine final period based on user selection
    if (periodOption === 'auto') {
      finalPeriod = selectedPeriod;
    } else if (periodOption === 'existing') {
      if (!selectedPeriod) {
        alert('❌ Please select an existing period');
        return;
      }
      finalPeriod = selectedPeriod;
    } else if (periodOption === 'custom') {
      if (!customStartDate || !customEndDate) {
        alert('❌ Please enter both start and end dates');
        return;
      }
      if (customStartDate > customEndDate) {
        alert('❌ Start date must be before end date');
        return;
      }
      finalPeriod = {
        id: `period-${Date.now()}`,
        label: formatPeriodLabel(customStartDate, customEndDate),
        start: customStartDate,
        end: customEndDate
      };
    }

    setSelectedPeriod(finalPeriod);

    // Check for conflicts
    const conflict = checkForConflicts(
      finalPeriod.start, 
      finalPeriod.end, 
      previewData
    );

    setConflictInfo(conflict);

    if (conflict.hasExisting) {
      setCurrentStep(3); // Show conflict resolution
    } else {
      // No conflict, import directly
      executeImport(finalPeriod, 'merge');
    }
  };

  // ===== IMPORT EXECUTION =====
  
  const executeImport = (period, mode) => {
    try {
      // ✅ CRITICAL: Get entries OUTSIDE selected period (NEVER TOUCH THESE)
      const entriesOutsidePeriod = entries.filter(e => 
        e.date < period.start || e.date > period.end
      );

      // ✅ Get entries INSIDE selected period
      const entriesInsidePeriod = entries.filter(e => 
        e.date >= period.start && e.date <= period.end
      );

      // Extract imported entries
      const importedEntries = previewData.map(item => item.entry);

      let finalEntries;

      if (mode === 'replace') {
        // ✅ REPLACE MODE: Keep outside + imported only
        finalEntries = [...entriesOutsidePeriod, ...importedEntries];
      } else {
        // ✅ MERGE MODE: Keep outside + merge inside with imported
        const mergedMap = new Map(entriesInsidePeriod.map(e => [e.date, e]));
        importedEntries.forEach(e => mergedMap.set(e.date, e));
        const mergedEntries = Array.from(mergedMap.values());
        finalEntries = [...entriesOutsidePeriod, ...mergedEntries];
      }

      // ✅ CRITICAL: Sort by date ASCENDING (oldest first)
      finalEntries.sort((a, b) => a.date.localeCompare(b.date));

      // Update entries
      setEntries(finalEntries);

      // ✅ Create period if it doesn't exist
      const periodExists = findPeriodByDateRange(period.start, period.end);
      if (!periodExists) {
        setPeriods([...periods, period]);
      }

      const message = mode === 'replace'
        ? `✅ Import successful!\n\n${importedEntries.length} entries imported\nMode: Replace (period-scoped)\nPeriod: ${period.label}`
        : `✅ Import successful!\n\n${importedEntries.length} entries imported\nMode: Merge\nPeriod: ${period.label}`;

      alert(message);
      onClose();
    } catch (err) {
      console.error('Error importing data:', err);
      alert('❌ Failed to import data. Please try again.');
    }
  };

  const handleFinalImport = () => {
    if (!selectedPeriod) {
      alert('❌ No period selected');
      return;
    }
    executeImport(selectedPeriod, importMode);
  };

  // ===== RENDER =====
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
        <h3>📥 Import Timesheet Data</h3>
        
        {/* Step Indicator */}
        <div className="import-steps">
          <div className={`import-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'complete' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Select File</span>
          </div>
          <div className={`import-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'complete' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Choose Period</span>
          </div>
          <div className={`import-step ${currentStep >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Confirm</span>
          </div>
        </div>

        {/* STEP 1: FILE SELECTION */}
        {currentStep === 1 && (
          <>
            <p className="settings-description">
              Import timesheet data from an Excel file. Supports DD/MM/YYYY dates and HH:MM:SS times.
            </p>

            <div className="form-group">
              <label className="form-label">Select Excel File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="file-input"
              />
              {selectedFile && (
                <div className="selected-file">
                  📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="import-processing">
                <div className="spinner"></div>
                <span>Processing file...</span>
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="import-errors">
                <strong>⚠️ Validation Warnings ({validationErrors.length}):</strong>
                <div className="error-list">
                  {validationErrors.slice(0, 5).map((error, index) => (
                    <div key={index} className="error-item">• {error}</div>
                  ))}
                  {validationErrors.length > 5 && (
                    <div className="error-item">... and {validationErrors.length - 5} more</div>
                  )}
                </div>
              </div>
            )}

            {previewData && previewData.length > 0 && (
              <div className="import-preview">
                <strong>📊 Preview:</strong>
                <div className="preview-stats">
                  <div className="preview-stat">
                    <span className="stat-value">{previewData.length}</span>
                    <span className="stat-label">Total Entries</span>
                  </div>
                  <div className="preview-stat">
                    <span className="stat-value">
                      {new Set(previewData.map(d => d.sheetName)).size}
                    </span>
                    <span className="stat-label">Sheets Found</span>
                  </div>
                  <div className="preview-stat">
                    <span className="stat-value">
                      {previewData.filter(d => d.entry.type === 'Regular').length}
                    </span>
                    <span className="stat-label">Regular Days</span>
                  </div>
                </div>

                <div className="preview-sample">
                  <strong>Sample entries:</strong>
                  <div className="sample-list">
                    {previewData.slice(0, 3).map((item, index) => (
                      <div key={index} className="sample-item">
                        <span className="sample-date">{item.entry.date}</span>
                        <span className="sample-type">{item.entry.type}</span>
                        <span className="sample-sheet">({item.sheetName})</span>
                      </div>
                    ))}
                    {previewData.length > 3 && (
                      <div className="sample-item">... and {previewData.length - 3} more</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleNextToPeriodSelection}
                disabled={!previewData || previewData.length === 0 || isProcessing}
              >
                Next: Select Period →
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* STEP 2: PERIOD SELECTION */}
        {currentStep === 2 && (
          <>
            <p className="settings-description">
              Select which period this imported data belongs to. The app can auto-suggest based on date range.
            </p>

            <div className="period-info-box">
              <strong>📅 Imported Date Range:</strong><br/>
              {selectedPeriod && `${selectedPeriod.start} to ${selectedPeriod.end}`}
              <br/>
              <strong>📊 Total Entries:</strong> {previewData.length}
            </div>

            <div className="form-group">
              <label className="form-label">Period Selection</label>
              
              {/* Option 1: Auto-suggested */}
              <div className="period-option">
                <label>
                  <input
                    type="radio"
                    name="periodOption"
                    value="auto"
                    checked={periodOption === 'auto'}
                    onChange={(e) => setPeriodOption(e.target.value)}
                  />
                  <div className="period-option-content">
                    <strong>✨ Auto-suggested Period (Recommended)</strong>
                    <div className="period-option-details">
                      {selectedPeriod && selectedPeriod.label}
                    </div>
                  </div>
                </label>
              </div>

              {/* Option 2: Choose existing */}
              <div className="period-option">
                <label>
                  <input
                    type="radio"
                    name="periodOption"
                    value="existing"
                    checked={periodOption === 'existing'}
                    onChange={(e) => setPeriodOption(e.target.value)}
                  />
                  <div className="period-option-content">
                    <strong>📋 Choose Existing Period</strong>
                    {periodOption === 'existing' && (
                      <select
                        className="form-control"
                        value={selectedPeriod?.id || ''}
                        onChange={(e) => {
                          const period = periods.find(p => p.id === e.target.value);
                          setSelectedPeriod(period);
                        }}
                      >
                        <option value="">-- Select Period --</option>
                        {periods.map(period => (
                          <option key={period.id} value={period.id}>
                            {period.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              </div>

              {/* Option 3: Custom dates */}
              <div className="period-option">
                <label>
                  <input
                    type="radio"
                    name="periodOption"
                    value="custom"
                    checked={periodOption === 'custom'}
                    onChange={(e) => setPeriodOption(e.target.value)}
                  />
                  <div className="period-option-content">
                    <strong>✏️ Custom Date Range</strong>
                    {periodOption === 'custom' && (
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
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="import-help">
              <strong>💡 Note:</strong> Only data within the selected period dates will be affected. All other data remains untouched.
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentStep(1)}
              >
                ← Back
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handlePeriodConfirm}
              >
                Next: Confirm Import →
              </button>
            </div>
          </>
        )}

        {/* STEP 3: CONFLICT RESOLUTION */}
        {currentStep === 3 && conflictInfo && (
          <>
            <div className="conflict-warning-box">
              <h4>⚠️ Period Already Contains Data</h4>
              <p>The selected period already has existing entries. Choose how to handle this:</p>
              
              <div className="conflict-stats">
                <div className="conflict-stat">
                  <span className="stat-icon">📥</span>
                  <div>
                    <strong>{conflictInfo.importingCount}</strong>
                    <small>Importing</small>
                  </div>
                </div>
                <div className="conflict-stat">
                  <span className="stat-icon">📊</span>
                  <div>
                    <strong>{conflictInfo.existingCount}</strong>
                    <small>Existing</small>
                  </div>
                </div>
                <div className="conflict-stat">
                  <span className="stat-icon">📅</span>
                  <div>
                    <strong>{selectedPeriod.label}</strong>
                    <small>Period</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Import Mode</label>
              
              <div className="import-mode-option">
                <label>
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={(e) => setImportMode(e.target.value)}
                  />
                  <div className="import-mode-content">
                    <strong>🔄 Merge (Recommended)</strong>
                    <small>Keep existing entries and add/update new ones. Duplicate dates will be updated with imported data.</small>
                  </div>
                </label>
              </div>

              <div className="import-mode-option">
                <label>
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value)}
                  />
                  <div className="import-mode-content">
                    <strong>⚠️ Replace</strong>
                    <small>
                      Delete ALL existing entries in this period ({conflictInfo.existingCount} entries) and import new data.
                      <br/>
                      <strong>✅ Data outside this period is safe and will NOT be touched.</strong>
                    </small>
                  </div>
                </label>
              </div>
            </div>

            <div className="import-help">
              <strong>🔒 Safety Guarantee:</strong> Only entries within <strong>{selectedPeriod.label}</strong> will be affected. All data outside this period remains completely untouched.
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentStep(2)}
              >
                ← Back
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleFinalImport}
              >
                {importMode === 'replace' ? '⚠️ Replace & Import' : '✅ Merge & Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ImportModal;
