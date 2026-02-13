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
  const [recoveryMode, setRecoveryMode] = useState('show'); // 'show', 'specific', 'all', 'all-data'
  const [selectedUserForExport, setSelectedUserForExport] = useState('');

  // Extract potential usernames from localStorage (enhanced logic)
  const extractPotentialUsernames = () => {
    const allKeys = Object.keys(localStorage);
    const userSpecificKeys = allKeys.filter(key => 
      key.includes('_') && !key.startsWith('__') && key !== 'currentUser' && key !== 'users'
    );
    
    const potentialUsernames = new Set();
    
    // Try multiple extraction methods
    userSpecificKeys.forEach(key => {
      // Method 1: Split on first underscore
      const parts1 = key.split('_');
      if (parts1.length > 1) {
        potentialUsernames.add(parts1.slice(1).join('_'));
      }
      
      // Method 2: Split on last underscore  
      const lastUnderscore = key.lastIndexOf('_');
      if (lastUnderscore > 0) {
        potentialUsernames.add(key.substring(lastUnderscore + 1));
      }
      
      // Method 3: Try common patterns
      const patterns = [
        /timeEntries_(.+)/,
        /payPeriods_(.+)/,
        /fullName_(.+)/,
        /salary_(.+)/,
        /annualVacation_(.+)/,
        /sickDays_(.+)/,
        /currentPeriodId_(.+)/
      ];
      
      patterns.forEach(pattern => {
        const match = key.match(pattern);
        if (match && match[1]) {
          potentialUsernames.add(match[1]);
        }
      });
    });
    
    // Also try to get username from currentUser if available
    try {
      const currentUserData = localStorage.getItem('currentUser');
      if (currentUserData) {
        // Try to decrypt with common usernames
        const commonUsernames = ['admin', 'user', 'test', 'guest', 'employee'];
        commonUsernames.forEach(username => {
          try {
            const decrypted = simpleDecrypt(currentUserData, username);
            if (decrypted && decrypted.username) {
              potentialUsernames.add(decrypted.username);
            }
          } catch (e) {
            // Ignore decryption errors
          }
        });
      }
    } catch (e) {
      // Ignore errors
    }
    
    return Array.from(potentialUsernames).filter(Boolean);
  };

  // Try to decrypt data with a specific username (enhanced logic)
  const tryDecryptWithUsername = (username) => {
    const results = {
      username,
      success: false,
      decryptedData: {},
      errors: [],
      dataCount: 0,
      debugInfo: {
        keysChecked: 0,
        keysDecrypted: 0,
        keysFailed: 0
      }
    };

    try {
      const allKeys = Object.keys(localStorage);
      
      // Try multiple key matching patterns
      const keyPatterns = [
        `_${username}`,
        `_${username.toLowerCase()}`,
        `_${username.toUpperCase()}`,
        `${username}_`,
        `${username.toLowerCase()}_`,
        `${username.toUpperCase()}_`
      ];
      
      const userKeys = allKeys.filter(key => 
        keyPatterns.some(pattern => key.includes(pattern)) || 
        key === 'currentUser' || 
        key === 'users'
      );

      results.debugInfo.keysChecked = userKeys.length;

      for (const key of userKeys) {
        try {
          const encryptedData = localStorage.getItem(key);
          if (encryptedData && encryptedData.startsWith('encrypted:')) {
            // Try multiple username variations for decryption
            const usernameVariations = [
              username,
              username.toLowerCase(),
              username.toUpperCase(),
              username.charAt(0).toUpperCase() + username.slice(1).toLowerCase()
            ];
            
            let decrypted = null;
            let successfulVariation = null;
            
            for (const variation of usernameVariations) {
              try {
                decrypted = simpleDecrypt(encryptedData, variation);
                if (decrypted !== null && decrypted !== undefined) {
                  successfulVariation = variation;
                  break;
                }
              } catch (e) {
                // Try next variation
              }
            }
            
            if (decrypted !== null && decrypted !== undefined) {
              results.decryptedData[key] = decrypted;
              results.success = true;
              results.dataCount++;
              results.debugInfo.keysDecrypted++;
              
              // If we found data with a variation, add it to potential usernames
              if (successfulVariation !== username) {
                results.alternativeUsername = successfulVariation;
              }
            } else {
              results.debugInfo.keysFailed++;
              results.errors.push(`Failed to decrypt ${key} with all username variations`);
            }
          } else if (key === 'currentUser' || key === 'users') {
            // Try to decrypt these special keys too
            try {
              const decrypted = simpleDecrypt(encryptedData, username);
              if (decrypted !== null && decrypted !== undefined) {
                results.decryptedData[key] = decrypted;
                results.success = true;
                results.dataCount++;
                results.debugInfo.keysDecrypted++;
              }
            } catch (e) {
              results.debugInfo.keysFailed++;
              results.errors.push(`Failed to decrypt ${key}: ${e.message}`);
            }
          }
        } catch (error) {
          results.debugInfo.keysFailed++;
          results.errors.push(`Error processing ${key}: ${error.message}`);
        }
      }
    } catch (error) {
      results.errors.push(`General error for username ${username}: ${error.message}`);
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
        // Provide detailed error message
        const allKeys = Object.keys(localStorage);
        const hasEncryptedData = allKeys.some(key => {
          const value = localStorage.getItem(key);
          return value && value.startsWith('encrypted:');
        });
        
        let errorMsg = 'No recoverable data found. ';
        
        if (!hasEncryptedData) {
          errorMsg += 'No encrypted data found in this browser. This might mean:\n';
          errorMsg += '• Data was cleared from this browser\n';
          errorMsg += '• You\'re using a different browser or device\n';
          errorMsg += '• Data was stored in a different format\n';
        } else if (potentialUsernames.length === 0) {
          errorMsg += 'No user accounts detected in localStorage. This might mean:\n';
          errorMsg += '• Data keys have an unexpected format\n';
          errorMsg += '• Usernames contain special characters\n';
          errorMsg += '• Data structure has changed\n';
        } else {
          errorMsg += `Found ${potentialUsernames.length} potential usernames but couldn't decrypt data. This might mean:\n`;
          errorMsg += '• Username casing is different than expected\n';
          errorMsg += '• Encryption key derivation has changed\n';
          errorMsg += '• Data was corrupted\n\n';
          errorMsg += `Usernames tried: ${potentialUsernames.join(', ')}`;
        }
        
        setError(errorMsg);
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

  // Helper function to merge duplicate time entries
  const mergeTimeEntries = (existing, duplicate) => {
    // Prefer the entry with more complete data
    const existingCompleteness = calculateEntryCompleteness(existing);
    const duplicateCompleteness = calculateEntryCompleteness(duplicate);
    
    if (duplicateCompleteness > existingCompleteness) {
      return duplicate;
    } else if (existingCompleteness > duplicateCompleteness) {
      return existing;
    } else {
      // If equal completeness, merge the data
      const merged = { ...existing };
      
      // Merge intervals (take all unique intervals)
      const allIntervals = [...(existing.intervals || []), ...(duplicate.intervals || [])];
      merged.intervals = allIntervals;
      
      // Take the higher values for numeric fields
      merged.hoursWorked = Math.max(existing.hoursWorked || 0, duplicate.hoursWorked || 0);
      merged.extraHours = Math.max(existing.extraHours || 0, duplicate.extraHours || 0);
      merged.extraHoursWithFactor = Math.max(existing.extraHoursWithFactor || 0, duplicate.extraHoursWithFactor || 0);
      merged.hoursSpentOutside = Math.max(existing.hoursSpentOutside || 0, duplicate.hoursSpentOutside || 0);
      
      // Merge notes
      const notes = [existing.notes, duplicate.notes].filter(Boolean).join('; ');
      merged.notes = notes || existing.notes || duplicate.notes;
      
      // Prefer Regular type if one is Regular
      if (existing.type === 'Regular' || duplicate.type === 'Regular') {
        merged.type = 'Regular';
      } else {
        merged.type = existing.type || duplicate.type;
      }
      
      return merged;
    }
  };

  // Helper function to calculate how complete an entry is
  const calculateEntryCompleteness = (entry) => {
    let score = 0;
    
    if (entry.date) score += 1;
    if (entry.type) score += 1;
    if (entry.hoursWorked !== undefined && entry.hoursWorked !== null) score += 1;
    if (entry.extraHours !== undefined && entry.extraHours !== null) score += 1;
    if (entry.extraHoursWithFactor !== undefined && entry.extraHoursWithFactor !== null) score += 1;
    if (entry.hoursSpentOutside !== undefined && entry.hoursSpentOutside !== null) score += 1;
    if (entry.notes) score += 1;
    if (entry.intervals && entry.intervals.length > 0) {
      score += entry.intervals.length;
      entry.intervals.forEach(interval => {
        if (interval.in) score += 0.5;
        if (interval.out) score += 0.5;
      });
    }
    
    return score;
  };

  // Check if there's any encrypted data regardless of user detection
  const hasAnyEncryptedData = () => {
    const allKeys = Object.keys(localStorage);
    return allKeys.some(key => {
      const value = localStorage.getItem(key);
      return value && value.startsWith('encrypted:');
    });
  };

  // Get count of all encrypted data keys
  const getEncryptedDataCount = () => {
    const allKeys = Object.keys(localStorage);
    return allKeys.filter(key => {
      const value = localStorage.getItem(key);
      return value && value.startsWith('encrypted:');
    }).length;
  };
  const exportAllDataRegardless = async () => {
    hapticFeedback.buttonClick();
    setIsExporting(true);

    try {
      // Get all localStorage keys that contain encrypted data
      const allKeys = Object.keys(localStorage);
      const encryptedKeys = allKeys.filter(key => {
        const value = localStorage.getItem(key);
        return value && value.startsWith('encrypted:');
      });

      if (encryptedKeys.length === 0) {
        setError('No encrypted data found in this browser.');
        return;
      }

      let filename = '';
      let dataByType = {}; // Declare in outer scope
      let totalDecrypted = 0; // Declare in outer scope
      
      if (exportFormat === 'excel') {
        // Create a workbook with all encrypted data
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();
        
        // Group data by type and try decryption with multiple methods
        dataByType = {};
        const allUsernames = extractPotentialUsernames();
        const commonUsernames = ['admin', 'user', 'test', 'guest', 'employee', 'default', 'user1', 'demo', 'john', 'jane', 'peter', 'mary', 'david', 'sarah'];
        const allPossibleUsernames = [...new Set([...allUsernames, ...commonUsernames])];
        
        // Try to decrypt each key with all possible usernames
        encryptedKeys.forEach(key => {
          const parts = key.split('_');
          const dataType = parts[0] || 'unknown';
          
          if (!dataByType[dataType]) {
            dataByType[dataType] = [];
          }
          
          let decrypted = null;
          let successfulUsername = null;
          
          // Try all possible usernames
          for (const username of allPossibleUsernames) {
            try {
              const value = localStorage.getItem(key);
              const result = simpleDecrypt(value, username);
              if (result !== null && result !== undefined && result !== '') {
                decrypted = result;
                successfulUsername = username;
                break;
              }
            } catch (e) {
              // Try next username
            }
          }
          
          if (decrypted) {
            dataByType[dataType].push({
              key,
              data: decrypted,
              username: successfulUsername,
              originalKey: key
            });
          }
        });
        
        // Check if we successfully decrypted any data
        totalDecrypted = Object.values(dataByType).reduce((sum, items) => sum + items.length, 0);
        if (totalDecrypted === 0) {
          setError('Found encrypted data but could not decrypt with any known usernames. The data may be corrupted or use an unknown encryption key.');
          return;
        }
        
        // Create sheets for each data type with exact same structure as single user export
        Object.entries(dataByType).forEach(([dataType, items]) => {
          if (dataType === 'timeEntries' && items.length > 0) {
            // Use exact same structure as generateRecoveryData (detailed view)
            const sheetData = [
              ['Date', 'Check In', 'Check Out', 'Hours Worked', 'Extra Hours', 'Extra Hours x1.5', 'Type', 'Break Out Times', 'Break In Times', 'Hours Spent Outside', 'Notes']
            ];
            
            // Collect all entries and handle duplicates
            const allEntries = [];
            const dateMap = new Map(); // To handle duplicates by date
            
            items.forEach(item => {
              if (Array.isArray(item.data)) {
                item.data.forEach(entry => {
                  if (entry && entry.date) {
                    const dateKey = entry.date;
                    
                    if (dateMap.has(dateKey)) {
                      // Handle duplicate - merge or keep most complete
                      const existing = dateMap.get(dateKey);
                      const merged = mergeTimeEntries(existing, entry);
                      dateMap.set(dateKey, merged);
                    } else {
                      dateMap.set(dateKey, { ...entry, username: item.username });
                    }
                  }
                });
              } else if (typeof item.data === 'object' && item.data.date) {
                // Single entry object
                const dateKey = item.data.date;
                
                if (dateMap.has(dateKey)) {
                  // Handle duplicate
                  const existing = dateMap.get(dateKey);
                  const merged = mergeTimeEntries(existing, item.data);
                  dateMap.set(dateKey, { ...merged, username: item.username });
                } else {
                  dateMap.set(dateKey, { ...item.data, username: item.username });
                }
              } else if (typeof item.data === 'object' && item.data.length) {
                // Array-like object
                for (let i = 0; i < item.data.length; i++) {
                  const entry = item.data[i];
                  if (entry && entry.date) {
                    const dateKey = entry.date;
                    
                    if (dateMap.has(dateKey)) {
                      // Handle duplicate
                      const existing = dateMap.get(dateKey);
                      const merged = mergeTimeEntries(existing, entry);
                      dateMap.set(dateKey, { ...merged, username: item.username });
                    } else {
                      dateMap.set(dateKey, { ...entry, username: item.username });
                    }
                  }
                }
              }
            });
            
            // Convert map to array and sort by date
            const uniqueEntries = Array.from(dateMap.values()).sort((a, b) => {
              return new Date(a.date) - new Date(b.date);
            });
            
            // Process unique entries
            uniqueEntries.forEach(entry => {
              const hoursWorked = entry.hoursWorked || 0;
              const extraHours = entry.extraHours || 0;
              const extraHoursWithFactor = entry.extraHoursWithFactor || 0;
              const hoursSpentOutside = entry.hoursSpentOutside || 0;
              const firstIn = entry.intervals?.[0]?.in || '-';
              const lastOut = entry.intervals?.[0]?.out || '-';
              const breakIntervals = entry.intervals?.slice(1) || [];
              const breakOutTimes = breakIntervals.map(b => formatTime(b.out)).join(', ') || '-';
              const breakInTimes = breakIntervals.map(b => formatTime(b.in)).join(', ') || '-';
              
              // Add username to notes if from different users
              let notes = entry.notes || '';
              if (entry.username && notes && !notes.includes(`(User: ${entry.username})`)) {
                notes += ` (User: ${entry.username})`;
              } else if (entry.username && !notes) {
                notes = `User: ${entry.username}`;
              }
              
              sheetData.push([
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
                notes
              ]);
            });
            
            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
            worksheet['!cols'] = [
              { wch: 12 }, // Date
              { wch: 10 }, // Check In
              { wch: 10 }, // Check Out
              { wch: 14 }, // Hours Worked
              { wch: 12 }, // Extra Hours
              { wch: 16 }, // Extra Hours x1.5
              { wch: 10 }, // Type
              { wch: 18 }, // Break Out Times
              { wch: 18 }, // Break In Times
              { wch: 16 }, // Hours Spent Outside
              { wch: 20 }  // Notes
            ];
            
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Time Entries');
          } else if (items.length > 0) {
            // Create a simple sheet for other data types (EXCLUDE SENSITIVE DATA)
            // Skip sensitive data types like salary, passwordHash, etc.
            const sensitiveDataTypes = ['salary', 'passwordHash', 'users', 'currentUser'];
            if (sensitiveDataTypes.includes(dataType)) {
              console.log(`🔒 Skipping sensitive data type: ${dataType}`);
              return; // Skip this data type entirely
            }
            
            const sheetData = [[`Data Type: ${dataType}`, 'Key', 'Username', 'Data Preview', 'Full Data']];
            
            items.forEach(item => {
              if (typeof item.data === 'object') {
                Object.entries(item.data).forEach(([key, value]) => {
                  const preview = typeof value === 'string' 
                    ? value.substring(0, 50) + (value.length > 50 ? '...' : '')
                    : JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
                  
                  sheetData.push([key, item.originalKey, item.username, preview, JSON.stringify(value)]);
                });
              } else {
                const preview = String(item.data).substring(0, 50) + (String(item.data).length > 50 ? '...' : '');
                sheetData.push([item.originalKey, item.originalKey, item.username, preview, JSON.stringify(item.data)]);
              }
            });
            
            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
            worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 50 }];
            
            XLSX.utils.book_append_sheet(workbook, worksheet, dataType.charAt(0).toUpperCase() + dataType.slice(1));
          }
        });
        
        const timestamp = new Date().toISOString().split('T')[0];
        filename = `Timesheet_All_Data_${timestamp}.xlsx`;
        
        XLSX.writeFile(workbook, filename);
      } else if (exportFormat === 'pdf') {
        // For PDF, create a summary of all data
        const summaryData = [['Data Type', 'Key', 'Username', 'Data Preview', 'Decrypted Items']];
        
        // Initialize dataByType for PDF format
        dataByType = {};
        totalDecrypted = 0;
        
        encryptedKeys.forEach(key => {
          const value = localStorage.getItem(key);
          const parts = key.split('_');
          const dataType = parts[0] || 'unknown';
          
          // Try to decrypt with common usernames
          const commonUsernames = ['admin', 'user', 'test', 'guest', 'employee'];
          let decrypted = null;
          let successfulUsername = null;
          
          for (const username of commonUsernames) {
            try {
              const result = simpleDecrypt(value, username);
              if (result !== null && result !== undefined && result !== '') {
                decrypted = result;
                successfulUsername = username;
                break;
              }
            } catch (e) {
              // Try next username
            }
          }
          
          if (decrypted) {
            // Skip sensitive data types in PDF export too
            const sensitiveDataTypes = ['salary', 'passwordHash', 'users', 'currentUser'];
            if (sensitiveDataTypes.includes(dataType)) {
              console.log(`🔒 Skipping sensitive data type in PDF: ${dataType}`);
              return; // Skip this data type entirely
            }
            
            if (!dataByType[dataType]) {
              dataByType[dataType] = [];
            }
            dataByType[dataType].push({
              key,
              data: decrypted,
              username: successfulUsername,
              originalKey: key
            });
            totalDecrypted++;
            
            const preview = typeof decrypted === 'object' 
              ? `${Object.keys(decrypted).length} items` 
              : String(decrypted).substring(0, 50);
            
            summaryData.push([dataType, key, successfulUsername, preview, '✅']);
          } else {
            summaryData.push([dataType, key, 'Unknown', 'Encrypted data', '❌']);
          }
        });
        
        if (totalDecrypted === 0) {
          setError('Found encrypted data but could not decrypt with any known usernames.');
          return;
        }
        
        filename = await generatePDFReport(summaryData, {
          title: 'All Timesheet Data Summary',
          employee: { name: 'All Users' },
          period: { label: 'Complete Data Export' }
        });
      }

      hapticFeedback.success();
      
      // Set success message instead of alert
      setTimeout(() => {
        setScanComplete(false);
        setRecoveryResults([]);
        setError(`✅ Export successful!\n\nFile: ${filename}\nData types exported: ${Object.keys(dataByType).join(', ')}\nItems recovered: ${totalDecrypted}\n\nNext steps:\n1. Create a new account\n2. Use the Import feature to restore your data`);
      }, 500);

    } catch (error) {
      hapticFeedback.error();
      setError(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };
  const exportAllData = async () => {
    hapticFeedback.buttonClick();
    setIsExporting(true);

    try {
      let filename = '';
      
      if (exportFormat === 'excel') {
        // Create a workbook with multiple sheets, one for each user
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();
        
        recoveryResults.forEach((result, index) => {
          const sheetData = generateRecoveryData(result);
          const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
          
          // Set column widths (same as ExportModal)
          const colWidths = [
            { wch: 12 }, // Date
            { wch: 10 }, // Check In
            { wch: 10 }, // Check Out
            { wch: 14 }, // Hours Worked
            { wch: 12 }, // Extra Hours
            { wch: 16 }, // Extra Hours x1.5
            { wch: 10 }, // Type
            { wch: 18 }, // Break Out Times
            { wch: 18 }, // Break In Times
            { wch: 16 }, // Hours Spent Outside
            { wch: 20 }  // Notes
          ];
          
          worksheet['!cols'] = colWidths;
          
          // Clean sheet name
          let sheetName = result.username
            .replace(/[:\\/?*\[\]]/g, '-')
            .substring(0, 31);
          
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        });
        
        const timestamp = new Date().toISOString().split('T')[0];
        filename = `Timesheet_Recovery_All_Users_${timestamp}.xlsx`;
        
        XLSX.writeFile(workbook, filename);
      } else if (exportFormat === 'pdf') {
        // For PDF, combine all data into one sheet
        const allData = [['Date', 'Check In', 'Check Out', 'Hours Worked', 'Type']];
        
        recoveryResults.forEach(result => {
          const userData = generateRecoveryData(result);
          // Skip header row for subsequent users
          userData.slice(1).forEach(row => {
            // Add username prefix to distinguish users
            allData.push([`${result.username}: ${row[0]}`, ...row.slice(1)]);
          });
        });
        
        filename = await generatePDFReport(allData, {
          title: 'Timesheet Recovery - All Users',
          employee: { name: 'Multiple Users' },
          period: { label: 'All Recovered Data' }
        });
      }

      hapticFeedback.success();
      
      // Show success message
      setTimeout(() => {
        setError(`✅ All data exported successfully!\n\nFile: ${filename}\nUsers: ${recoveryResults.length}\n\nNext steps:\n1. Create a new account\n2. Use the Import feature to restore your data`);
      }, 500);

    } catch (error) {
      hapticFeedback.error();
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };
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
        setError(`✅ Data exported successfully!\n\nFile: ${filename}\n\nNext steps:\n1. Create a new account\n2. Use the Import feature to restore your data`);
      }, 500);

    } catch (error) {
      hapticFeedback.error();
      setError(`❌ Export failed: ${error.message}`);
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
          {/* Recovery Mode Selection */}
          <div className="form-group">
            <label className="form-label">Recovery Options</label>
            <div className="recovery-mode-tabs">
              <button
                className={`recovery-mode-tab ${recoveryMode === 'show' ? 'active' : ''}`}
                onClick={() => {
                  hapticFeedback.buttonClick();
                  setRecoveryMode('show');
                }}
              >
                <span className="tab-icon">👁️</span>
                <span className="tab-text">Show Users Found</span>
              </button>
              <button
                className={`recovery-mode-tab ${recoveryMode === 'specific' ? 'active' : ''}`}
                onClick={() => {
                  hapticFeedback.buttonClick();
                  setRecoveryMode('specific');
                }}
                disabled={recoveryResults.length === 0}
              >
                <span className="tab-icon">👤</span>
                <span className="tab-text">Export Specific User</span>
              </button>
              <button
                className={`recovery-mode-tab ${recoveryMode === 'all' ? 'active' : ''}`}
                onClick={() => {
                  hapticFeedback.buttonClick();
                  setRecoveryMode('all');
                }}
                disabled={recoveryResults.length === 0}
              >
                <span className="tab-icon">📦</span>
                <span className="tab-text">Export All Users</span>
              </button>
              <button
                className={`recovery-mode-tab ${recoveryMode === 'all-data' ? 'active' : ''}`}
                onClick={() => {
                  hapticFeedback.buttonClick();
                  setRecoveryMode('all-data');
                }}
              >
                <span className="tab-icon">💾</span>
                <span className="tab-text">Export All Data</span>
              </button>
            </div>
          </div>

          {/* Show Users Mode */}
          {recoveryMode === 'show' && (
            <div className="recovery-show-section">
              <h4>🔍 Users Found ({recoveryResults.length})</h4>
              {recoveryResults.length > 0 ? (
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
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-users-found">
                  <p>No valid users were found during the scan.</p>
                  {hasAnyEncryptedData() ? (
                    <>
                      <p>However, {getEncryptedDataCount()} encrypted data items were found!</p>
                      <p>Use the "Export All Data" option to recover this data.</p>
                    </>
                  ) : (
                    <p>No encrypted data found in this browser.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Export Specific User Mode */}
          {recoveryMode === 'specific' && (
            <div className="recovery-specific-section">
              <h4>👤 Export Specific User</h4>
              <div className="user-selection">
                <label className="form-label">Select User</label>
                <select 
                  className="form-select"
                  value={selectedUserForExport}
                  onChange={(e) => {
                    hapticFeedback.buttonClick();
                    setSelectedUserForExport(e.target.value);
                  }}
                >
                  <option value="">Choose a user...</option>
                  {recoveryResults.map((result, index) => (
                    <option key={index} value={result.username}>
                      {result.username} ({result.dataCount} items)
                    </option>
                  ))}
                </select>
                
                {selectedUserForExport && (
                  <div className="selected-user-info">
                    <div className="user-details">
                      <strong>👤 {selectedUserForExport}</strong>
                      <span className="data-count">
                        {recoveryResults.find(r => r.username === selectedUserForExport)?.dataCount || 0} data items
                      </span>
                      <span className="data-summary">
                        {getDataSummary(recoveryResults.find(r => r.username === selectedUserForExport))}
                      </span>
                    </div>
                    <button 
                      className="recovery-btn recovery-btn-primary"
                      onClick={() => exportUserData(recoveryResults.find(r => r.username === selectedUserForExport))}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <>
                          <div className="recovery-btn-spinner"></div>
                          Exporting...
                        </>
                      ) : (
                        '📥 Export Data'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export All Users Mode */}
          {recoveryMode === 'all' && (
            <div className="recovery-all-section">
              <h4>📦 Export All Users</h4>
              <div className="export-all-info">
                <p>Export all {recoveryResults.length} recovered users into a single file.</p>
                <ul>
                  <li>Excel: Creates separate sheets for each user</li>
                  <li>PDF: Combines all data with username prefixes</li>
                </ul>
              </div>
              <button 
                className="recovery-btn recovery-btn-primary recovery-btn-large"
                onClick={exportAllData}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <div className="recovery-btn-spinner"></div>
                    Exporting All...
                  </>
                ) : (
                  `📦 Export All Users (${recoveryResults.length})`
                )}
              </button>
            </div>
          )}

          {/* Export All Data Mode */}
          {recoveryMode === 'all-data' && (
            <div className="recovery-all-data-section">
              <h4>💾 Export All Data</h4>
              <div className="export-all-info">
                <p>Export ALL encrypted data found in this browser, regardless of user detection.</p>
                <div className="data-count-info">
                  <strong>Found {getEncryptedDataCount()} encrypted data items</strong>
                </div>
                <ul>
                  <li>Finds all encrypted localStorage keys</li>
                  <li>Attempts decryption with common usernames</li>
                  <li>Groups data by type (timeEntries, payPeriods, etc.)</li>
                  <li>Useful when user detection fails</li>
                  <li>Exports data in Excel/PDF format</li>
                </ul>
                {recoveryResults.length > 0 && (
                  <div className="alternative-option">
                    <p><strong>Alternative:</strong> {recoveryResults.length} valid users were found. Consider using "Export All Users" for better organization.</p>
                  </div>
                )}
              </div>
              <button 
                className="recovery-btn recovery-btn-warning recovery-btn-large"
                onClick={exportAllDataRegardless}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <div className="recovery-btn-spinner"></div>
                    Exporting All Data...
                  </>
                ) : (
                  '💾 Export All Data'
                )}
              </button>
            </div>
          )}

          {/* Export Format Selection (for specific and all modes) */}
          {(recoveryMode === 'specific' || recoveryMode === 'all' || recoveryMode === 'all-data') && (
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
          )}
        </>
      )}

      {/* Actions */}
      <div className="form-actions">
        {!scanComplete && (
          <button 
            type="button" 
            className="recovery-btn recovery-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        )}
        
        {scanComplete && (
          <>
            <button 
              type="button" 
              className="recovery-btn recovery-btn-secondary"
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
              className="recovery-btn recovery-btn-primary"
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
