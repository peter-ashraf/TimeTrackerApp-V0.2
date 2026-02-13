import React, { useState, useEffect } from 'react';
import ModalShell from './ModalShell';
import { getSimpleEncryptedItem, generateSimpleEncryptionKey, simpleDecrypt } from '../utils/simple-encryption';
import { exportToExcel, generatePDFReport } from '../utils/exportUtils';
import hapticFeedback from '../utils/hapticFeedback';
import '../styles/export-modal-enhanced.css';

const RecoveryModal = ({ onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [recoveryResults, setRecoveryResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [error, setError] = useState('');
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel', 'pdf', 'email'

  // Extract potential usernames from localStorage
  const extractPotentialUsernames = () => {
    const allKeys = Object.keys(localStorage);
    const userSpecificKeys = allKeys.filter(key => 
      key.includes('_') && !key.startsWith('__') && key !== 'currentUser' && key !== 'users'
    );
    
    const potentialUsernames = [...new Set(
      userSpecificKeys.map(key => {
        const parts = key.split('_');
        return parts.length > 1 ? parts.slice(1).join('_') : null;
      }).filter(Boolean)
    )];
    
    return potentialUsernames;
  };

  // Try to decrypt data with a specific username
  const tryDecryptWithUsername = (username) => {
    const results = {
      username,
      success: false,
      decryptedData: {},
      errors: [],
      dataCount: 0
    };

    try {
      const allKeys = Object.keys(localStorage);
      const userKeys = allKeys.filter(key => 
        key.includes(`_${username}`) || key === 'currentUser' || key === 'users'
      );

      for (const key of userKeys) {
        try {
          const encryptedData = localStorage.getItem(key);
          if (encryptedData && encryptedData.startsWith('encrypted:')) {
            const decrypted = simpleDecrypt(encryptedData, username);
            if (decrypted !== null && decrypted !== undefined) {
              results.decryptedData[key] = decrypted;
              results.success = true;
              results.dataCount++;
            }
          }
        } catch (error) {
          results.errors.push(`Failed to decrypt ${key}`);
        }
      }
    } catch (error) {
      results.errors.push(`General error for username ${username}`);
    }

    return results;
  };

  // Scan for recoverable data
  const startScan = async () => {
    hapticFeedback.buttonClick();
    setIsScanning(true);
    setError('');
    setRecoveryResults([]);

    try {
      const potentialUsernames = extractPotentialUsernames();
      const results = [];

      // Simulate scanning progress for better UX
      for (let i = 0; i < potentialUsernames.length; i++) {
        const username = potentialUsernames[i];
        const result = tryDecryptWithUsername(username);
        
        if (result.success) {
          results.push(result);
        }

        // Small delay for progress indication
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setRecoveryResults(results);
      setScanComplete(true);
      
      if (results.length === 0) {
        setError('No recoverable data found. This might mean data was cleared or you\'re in a different browser.');
      }
    } catch (error) {
      setError(`Scanning failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Format date for export (exact same as ExportModal)
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Format time for export (exact same as ExportModal)
  const formatTime = (time24) => {
    if (!time24) return '-';
    return time24;
  };

  // Generate Excel data using EXACT same logic as ExportModal.generatePeriodData
  const generateRecoveryData = (recoveryResult) => {
    const decryptedData = recoveryResult.decryptedData;
    const periodEntries = decryptedData[`timeEntries_${recoveryResult.username}`] || [];
    
    // Use exact same headers as ExportModal (detailed view to match template)
    const headers = [
      'Date',
      'Check In',
      'Check Out',
      'Hours Worked',
      'Extra Hours',
      'Extra Hours x1.5',
      'Type',
      'Break Out Times',
      'Break In Times',
      'Hours Spent Outside',
      'Notes'
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

      // Use exact same detailed view logic as ExportModal
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
        entry.type === 'Regular' ? `${hoursSpentOutside.toFixed(2)}h` : '-',
        entry.notes || ''
      ];
    });

    return [headers, ...rows];
  };

  // Export recovered data using existing export logic
  const exportUserData = async (recoveryResult) => {
    hapticFeedback.buttonClick();
    setIsExporting(true);
    setSelectedUser(recoveryResult.username);

    try {
      let filename = '';
      
      if (exportFormat === 'excel') {
        // Use existing Excel export function with exact same structure as ExportModal
        const excelData = generateRecoveryData(recoveryResult);
        filename = exportToExcel(excelData, {
          filename: `timesheet_recovery_${recoveryResult.username}`,
          sheetName: 'Recovered Data',
          includeFormatting: true
        });
      } else if (exportFormat === 'pdf') {
        // Use existing PDF export function
        const pdfData = generateRecoveryData(recoveryResult);
        filename = await generatePDFReport(pdfData, {
          title: `Timesheet Recovery - ${recoveryResult.username}`,
          employee: { name: recoveryResult.username },
          period: { label: 'Recovered Data' }
        });
      }

      hapticFeedback.success();
      
      // Show success message
      setTimeout(() => {
        alert(`✅ Data exported successfully!\n\nFile: ${filename}\n\nNext steps:\n1. Create a new account\n2. Use the Import feature to restore your data`);
      }, 500);

    } catch (error) {
      hapticFeedback.error();
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
      setSelectedUser(null);
    }
  };

  // Format data size for display
  const formatDataSize = (data) => {
    try {
      const size = new Blob([JSON.stringify(data)]).size;
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
      return 'Unknown';
    }
  };

  // Get data summary for a user
  const getDataSummary = (recoveryResult) => {
    const data = recoveryResult.decryptedData;
    const summary = [];
    
    if (data[`timeEntries_${recoveryResult.username}`]) {
      const entries = data[`timeEntries_${recoveryResult.username}`];
      summary.push(`${entries.length} time entries`);
    }
    
    if (data[`payPeriods_${recoveryResult.username}`]) {
      const periods = data[`payPeriods_${recoveryResult.username}`];
      summary.push(`${periods.length} pay periods`);
    }
    
    if (data[`fullName_${recoveryResult.username}`]) {
      summary.push('user settings');
    }
    
    return summary.length > 0 ? summary.join(', ') : 'Basic data';
  };

  return (
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="export-modal">
      <h3>🔐 Data Recovery</h3>
      <p className="settings-description">
        Recover your timesheet data when you've forgotten your password. 
        Your data is encrypted locally for security, so we'll extract it for you to import into a new account.
      </p>

      {/* Employee Info Preview */}
      <div className="export-preview-box">
        <strong>🔍 Recovery Status:</strong> {scanComplete ? `${recoveryResults.length} user(s) found` : 'Ready to scan'}
      </div>

      {!scanComplete ? (
        <div className="form-group">
          <label className="form-label">Recovery Options</label>
          <div className="export-mode-tabs">
            <button
              className={`export-mode-tab active`}
              onClick={startScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <>
                  <div className="btn-spinner"></div>
                  Scanning...
                </>
              ) : (
                '🔍 Scan for Data'
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Export Format Selection */}
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
            </div>
          </div>

          {/* User Selection */}
          <div className="form-group">
            <label className="form-label">Select User to Export</label>
            <div className="recovery-list">
              {recoveryResults.map((result, index) => (
                <div key={index} className="recovery-item">
                  <div className="recovery-item-header">
                    <div className="user-info">
                      <h5>👤 {result.username}</h5>
                      <span className="data-count">{result.dataCount} data items</span>
                    </div>
                    <div className="data-summary">
                      {getDataSummary(result)}
                    </div>
                  </div>
                  
                  <div className="recovery-item-details">
                    <div className="data-size">
                      Size: {formatDataSize(result.decryptedData)}
                    </div>
                    <button 
                      className="btn btn-primary export-button"
                      onClick={() => exportUserData(result)}
                      disabled={isExporting && selectedUser === result.username}
                    >
                      {isExporting && selectedUser === result.username ? (
                        <>
                          <div className="btn-spinner"></div>
                          Exporting...
                        </>
                      ) : (
                        '📥 Export Data'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="export-summary">
            <p>
              <strong>📋 Next Steps:</strong><br/>
              1. Export your data using the button above<br/>
              2. Create a new account in TimeTracker<br/>
              3. Use the Import feature to restore your data
            </p>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="form-actions">
        {!scanComplete && (
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        )}
        
        {scanComplete && (
          <>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => {
                setScanComplete(false);
                setRecoveryResults([]);
                setError('');
              }}
            >
              🔄 Scan Again
            </button>
            <button 
              type="button"
              className="btn btn-primary"
              onClick={onClose}
            >
              Done
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
};

export default RecoveryModal;
