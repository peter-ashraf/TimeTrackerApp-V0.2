import React, { useState, useEffect } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ExportModal from './ExportModal';
import ImportModal from './ImportModal';

function Settings() {
  const {
    employee,
    leaveSettings,
    periods,
    currentPeriodId,
    hideSalary,
    updateEmployee,
    updateLeaveSettings,
    setCurrentPeriodId,
    setPeriods,
    clearCurrentDay,
    clearCurrentMonth,
    clearAllData
  } = useTimeTracker();

  // Employee form
  const [name, setName] = useState(employee.name);
  const [salary, setSalary] = useState(employee.salary);

  // Leave settings form
  const [annualVacation, setAnnualVacation] = useState(leaveSettings.annualVacation);
  const [sickDays, setSickDays] = useState(leaveSettings.sickDays);

  // Period management
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  // Accordion states
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  // ✅ NEW: Export/Import modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    setName(employee.name);
    setSalary(employee.salary);
  }, [employee]);

  useEffect(() => {
    setAnnualVacation(leaveSettings.annualVacation);
    setSickDays(leaveSettings.sickDays);
  }, [leaveSettings]);

  const handleSaveEmployee = (e) => {
    e.preventDefault();
    updateEmployee({ name, salary: parseFloat(salary) || 0 });
  };

  const handleSaveLeave = (e) => {
    e.preventDefault();
    updateLeaveSettings({
      annualVacation: parseFloat(annualVacation) || 0,
      sickDays: parseFloat(sickDays) || 0
    });
  };

  const categorizePeriods = () => {
    const today = new Date().toISOString().split('T')[0];
    
    const current = periods.find(p => p.id === currentPeriodId);
    
    const otherPeriods = periods.filter(p => p.id !== currentPeriodId);
    const upcoming = otherPeriods.filter(p => p.start > today);
    const previous = otherPeriods.filter(p => p.end < today);
    
    const other = otherPeriods.filter(p => p.start <= today && p.end >= today);
    
    return { current, upcoming, previous: [...previous, ...other] };
  };

  const { current, upcoming, previous } = categorizePeriods();

  const handleAddPeriod = (e) => {
    e.preventDefault();
    if (!newPeriodStart || !newPeriodEnd) {
      alert('Please fill start and end dates');
      return;
    }

    const startDate = new Date(newPeriodStart);
    const endDate = new Date(newPeriodEnd);
    
    const formatDate = (date) => {
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'short' });
      return `${day} ${month}`;
    };

    const autoLabel = `${formatDate(startDate)} - ${formatDate(endDate)} ${endDate.getFullYear()}`;

    const newPeriod = {
      id: 'period-' + Date.now(),
      label: autoLabel,
      start: newPeriodStart,
      end: newPeriodEnd
    };

    setPeriods([...periods, newPeriod]);
    setShowAddPeriod(false);
    setNewPeriodStart('');
    setNewPeriodEnd('');
    alert('Period added successfully!');
  };

  const handleDeletePeriod = (periodId) => {
    if (periods.length === 1) {
      alert('Cannot delete the last period!');
      return;
    }

    if (window.confirm('Are you sure you want to delete this period?')) {
      const newPeriods = periods.filter(p => p.id !== periodId);
      setPeriods(newPeriods);
      
      if (currentPeriodId === periodId) {
        setCurrentPeriodId(newPeriods[0].id);
      }
      
      alert('Period deleted!');
    }
  };

  return (
    <main className="main-content">
      <h1>Settings</h1>

      {/* Employee Information */}
      <section className="settings-section">
        <h2>Employee Information</h2>
        <form onSubmit={handleSaveEmployee}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Salary (L.E.)</label>
            <input
              type={hideSalary ? "password" : "number"}
              className="form-control"
              value={hideSalary ? '' : salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder={hideSalary ? "••••••" : "Enter your monthly salary"}
              disabled={hideSalary}
              style={{
                filter: hideSalary ? 'blur(5px)' : 'none',
                transition: 'filter 0.3s ease'
              }}
            />
            {hideSalary && (
              <small style={{color: '#FF9696', marginTop: '8px', display: 'block'}}>
                ⚠️ Salary is hidden. Unhide from Dashboard to edit.
              </small>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={hideSalary}>
            Save Employee Info
          </button>
        </form>
      </section>

      {/* Leave Settings */}
      <section className="settings-section">
        <h2>Leave Settings</h2>
        <form onSubmit={handleSaveLeave}>
          <div className="form-group">
            <label className="form-label">Annual Vacation Days</label>
            <input
              type="number"
              className="form-control"
              value={annualVacation}
              onChange={(e) => setAnnualVacation(e.target.value)}
              placeholder="Enter annual vacation days"
              min="0"
              step="0.5"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Sick Days</label>
            <input
              type="number"
              className="form-control"
              value={sickDays}
              onChange={(e) => setSickDays(e.target.value)}
              placeholder="Enter sick days"
              min="0"
              step="0.5"
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Save Leave Settings
          </button>
        </form>
      </section>

      {/* Pay Periods Management */}
      <section className="settings-section">
        
          <h3>Pay Period Management</h3>
          <p className="settings-description">
            Define custom pay periods for your timesheet. Periods must be continuous with no gaps or overlaps.
          </p>
          
          <div className="periods-list">
            {/* Previous Periods Accordion */}
            {previous.length > 0 && (
              <div className="period-section">
                <button
                  className="period-accordion-header"
                  onClick={() => setShowPrevious(!showPrevious)}
                >
                  <span className="accordion-icon">{showPrevious ? '▼' : '▶'}</span>
                  <span className="period-section-header-text">
                    ⏮️ PREVIOUS PERIODS ({previous.length})
                  </span>
                </button>
                
                {showPrevious && (
                  <div className="period-section-content accordion-content">
                    {previous.map(period => (
                      <div key={period.id} className="period-item">
                        <div className="period-info">
                          <span className="period-label">{period.label}</span>
                        </div>
                        <div className="period-actions">
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setCurrentPeriodId(period.id)}
                          >
                            Set as Current
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setNewPeriodStart(period.start);
                              setNewPeriodEnd(period.end);
                              setShowAddPeriod(true);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeletePeriod(period.id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Current Period Section */}
            {current && (
              <div className="period-section">
                <h4 className="period-section-header current-period-header">
                  📅 CURRENT PERIOD
                </h4>
                <div className="period-section-content">
                  <div className="period-item period-current">
                    <div className="period-info">
                      <span className="period-label">{current.label}</span>
                      <span className="period-badge">Current ✓</span>
                    </div>
                    <div className="period-actions">
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setNewPeriodStart(current.start);
                          setNewPeriodEnd(current.end);
                          setShowAddPeriod(true);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeletePeriod(current.id)}
                        disabled={periods.length === 1}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Periods Accordion */}
            {upcoming.length > 0 && (
              <div className="period-section">
                <button
                  className="period-accordion-header"
                  onClick={() => setShowUpcoming(!showUpcoming)}
                >
                  <span className="accordion-icon">{showUpcoming ? '▼' : '▶'}</span>
                  <span className="period-section-header-text">
                    ⏭️ UPCOMING PERIODS ({upcoming.length})
                  </span>
                </button>
                
                {showUpcoming && (
                  <div className="period-section-content accordion-content">
                    {upcoming.map(period => (
                      <div key={period.id} className="period-item">
                        <div className="period-info">
                          <span className="period-label">{period.label}</span>
                        </div>
                        <div className="period-actions">
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setCurrentPeriodId(period.id)}
                          >
                            Set as Current
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setNewPeriodStart(period.start);
                              setNewPeriodEnd(period.end);
                              setShowAddPeriod(true);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeletePeriod(period.id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="period-actions-bar">
            <button
              className="btn btn-primary"
              onClick={() => setShowAddPeriod(true)}
            >
              + Add Pay Period
            </button>
          </div>
        

        {/* Add Period Modal */}
        {showAddPeriod && (
          <div className="modal-overlay" onClick={() => setShowAddPeriod(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleAddPeriod}>
                <h3>Add New Pay Period</h3>
                <p className="settings-description">
                  Period label will be automatically generated from the dates
                </p>
                
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                    required
                  />
                </div>

                {newPeriodStart && newPeriodEnd && (
                  <div className="form-group">
                    <label className="form-label">Generated Label (Preview)</label>
                    <div className="period-preview">
                      {(() => {
                        const startDate = new Date(newPeriodStart);
                        const endDate = new Date(newPeriodEnd);
                        const formatDate = (date) => {
                          const day = date.getDate();
                          const month = date.toLocaleString('en-US', { month: 'short' });
                          return `${day} ${month}`;
                        };
                        return `${formatDate(startDate)} - ${formatDate(endDate)} ${endDate.getFullYear()}`;
                      })()}
                    </div>
                  </div>
                )}
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    Add Period
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddPeriod(false);
                      setNewPeriodStart('');
                      setNewPeriodEnd('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* ✅ NEW: Export/Import Data Section */}
      <section className="settings-section">
        
          <h2>📊 Data Management</h2>
          <p className="settings-description">
            Export your timesheet data to Excel or import data from a previous backup.
          </p>
          <div className="data-management-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setShowExportModal(true)}
            >
              📤 Export Data
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
            >
              📥 Import Data
            </button>
          </div>
        
      </section>

      {/* Danger Zone */}
      <section className="settings-section danger-zone">
        <h2>⚠️ Danger Zone</h2>
        <div className="danger-actions">
          <button className="btn btn-danger" onClick={clearCurrentDay}>
            Clear Today's Data
          </button>
          <button className="btn btn-danger" onClick={clearCurrentMonth}>
            Clear Current Period Data
          </button>
          <button className="btn btn-danger" onClick={clearAllData}>
            Delete All Data
          </button>
        </div>
      </section>

      {/* ✅ NEW: Export Modal Placeholder */}
        {showExportModal && (
          <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>📤 Export Data</h3>
              <p>Export modal will be implemented in Phase 2</p>
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Close
              </button>
            </div>
          </div>
        )}


        {/* ✅ Export Modal */}
        {showExportModal && (
          <ExportModal onClose={() => setShowExportModal(false)} />
        )}

      {/* ✅ NEW: Import Modal Placeholder */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📥 Import Data</h3>
            <p>Import modal will be implemented in Phase 3</p>
            <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

        {/* ✅ Import Modal */}
        {showImportModal && (
          <ImportModal onClose={() => setShowImportModal(false)} />
        )}
    </main>
  );
}

export default Settings;
