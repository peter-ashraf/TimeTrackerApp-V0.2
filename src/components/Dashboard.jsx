import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import ManualTimeModal from './ManualTimeModal';
import AddBreakModal from './AddBreakModal';
import AddDayModal from './AddDayModal';
import ViewHoursModal from './ViewHoursModal';
import VacationDetailsModal from './VacationDetailsModal';

function Dashboard() {
  const {
    employee,
    leaveSettings,
    entries,
    hideSalary,
    setHideSalary,
    checkIn,
    checkOut,
    getCurrentPeriod,
    calculateOvertimeDetails
  } = useTimeTracker();

  const [showManualIn, setShowManualIn] = useState(false);
  const [showManualOut, setShowManualOut] = useState(false);
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [showAddDay, setShowAddDay] = useState(false);
  const [showViewHours, setShowViewHours] = useState(false);
  const [vacationModalType, setVacationModalType] = useState(null);

  const currentPeriod = getCurrentPeriod();

  // Calculate vacation stats
  const periodEntries = entries.filter(e => {
    if (!currentPeriod) return false;
    return e.date >= currentPeriod.start && e.date <= currentPeriod.end;
  });

  const vacationTaken = periodEntries
    .filter(e => e.type === 'Vacation')
    .reduce((sum, e) => sum + (e.duration || 1), 0);

  const toBeAdded = periodEntries
    .filter(e => e.type === 'To Be Added')
    .reduce((sum, e) => sum + (e.duration || 1), 0);

  const sickUsed = periodEntries
    .filter(e => e.type === 'Sick Leave')
    .reduce((sum, e) => sum + (e.duration || 1), 0);

  const vacationBalance = leaveSettings.annualVacation - vacationTaken + toBeAdded;
  const sickBalance = leaveSettings.sickDays - sickUsed;

  // Calculate overtime
  const overtimeDetails = calculateOvertimeDetails 
    ? calculateOvertimeDetails(entries, currentPeriod?.start, currentPeriod?.end)
    : { totalHoursWorked: 0, totalExtraHours: 0, totalExtraHoursWithFactor: 0 };
  
  const overtime = overtimeDetails.totalExtraHoursWithFactor;
  
  // Salary calculation (2/3 of salary)
  const salaryDivided = employee.salary / 3;
  const salaryTwoThird = salaryDivided * 2;
  const employeeHourCost = salaryTwoThird / 187.5;
  const overtimeMoney = overtime * employeeHourCost;
  const totalSalary = employee.salary + overtimeMoney;

  return (
    <main className="main-content">
      <h1>Dashboard</h1>

      {/* Employee Info Card */}
      <div className="employee-card">
        <div className="employee-name-container">
          <div className="hide-salary-section">
            <button 
              className="btn-icon" 
              title="Toggle salary visibility"
              onClick={() => setHideSalary(!hideSalary)}
            >
              <i className={`fa-solid ${hideSalary ? 'fa-eye' : 'fa-eye-slash'}`}></i>
            </button>
            <h2>{employee.name || 'Enter Employee Name in Settings Tab...'}</h2>
          </div>
        </div>

        <p>
          Month: <span className="current-next-month"><strong>{currentPeriod?.label || 'No Period'}</strong></span>
        </p>

        <div className="overtime-section">
          <p>
            Overtime: <span className="overtime-hours-amount" style={{color: overtime >= 0 ? '#80FF00' : '#FF9696'}}>
              <strong>{overtime.toFixed(2)}h</strong>
            </span>
          </p>
          <p>
            Overtime into Money: 
            <span 
              className="overtime-money-amount" 
              style={{
                color: overtimeMoney >= 0 ? '#80FF00' : '#FF9696',
                filter: hideSalary ? 'blur(8px)' : 'none',
                transition: 'filter 0.3s ease'
              }}
            >
              <strong>{hideSalary ? '******' : ` ${overtimeMoney.toFixed(2)} L.E.`}</strong>
            </span>
          </p>
        </div>

        <div className="salary-section">
          <p>
            Base Salary: 
            <span 
              className="salary-amount"
              style={{
                filter: hideSalary ? 'blur(8px)' : 'none',
                transition: 'filter 0.3s ease'
              }}
            >
              {hideSalary ? '******' : ` ${employee.salary.toLocaleString()} L.E.`}
            </span>
          </p>
          <p>
            Total Salary: 
            <span 
              className="salary-amount"
              style={{
                filter: hideSalary ? 'blur(8px)' : 'none',
                transition: 'filter 0.3s ease'
              }}
            >
              {hideSalary ? '******' : ` ${totalSalary.toLocaleString()} L.E.`}
            </span>
          </p>
        </div>
      </div>

      {/* Manual Time Actions */}
      <div className="manual-time-actions">
        <button 
          className="btn btn-secondary manual-check-in-btn"
          onClick={() => setShowManualIn(true)}
        >
          Manual In
        </button>
        <button 
          className="btn btn-secondary manual-check-out-btn"
          onClick={() => setShowManualOut(true)}
        >
          Manual Out
        </button>
        <button 
          className="btn btn-secondary add-break-btn"
          onClick={() => setShowAddBreak(true)}
        >
          Add Break
        </button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="btn btn-primary" onClick={checkIn}>Check In</button>
        <button className="btn btn-primary" onClick={checkOut}>Check Out</button>
        <button className="btn btn-secondary" onClick={() => setShowAddDay(true)}>Add Day</button>
        <button className="btn btn-outline" onClick={() => setShowViewHours(true)}>View Hours</button>
      </div>

      {/* Vacation Cards */}
      <div className="vacation-cards">
        {/* Vacation Card */}
        <div className="vacation-card-redesigned">
          <div className="vacation-top-section">
            <div className="vacation-stat">
              <span className="stat-label">Official Balance</span>
              <span className="stat-value">{leaveSettings.annualVacation}</span>
            </div>
            <div 
              className="vacation-stat clickable-stat"
              onClick={() => setVacationModalType('vacation-taken')}
              style={{cursor: 'pointer'}}
              title="Click to view details"
            >
              <span className="stat-label">Taken Days</span>
              <span className="stat-value" style={{color: '#FF9696'}}>{vacationTaken}</span>
            </div>
            <div 
              className="vacation-stat clickable-stat"
              onClick={() => setVacationModalType('vacation-to-be-added')}
              style={{cursor: 'pointer'}}
              title="Click to view details"
            >
              <span className="stat-label">To Be Added</span>
              <span className="stat-value" style={{color: '#80FF00'}}>{toBeAdded}</span>
            </div>
          </div>
          <div className="vacation-bottom-section">
            <span className="balance-label">Current Available Balance</span>
            <span className="balance-value">{vacationBalance.toFixed(1)}</span>
          </div>
        </div>

        {/* Sick Days Card */}
        <div className="vacation-card-redesigned">
          <div className="vacation-top-section double-stat">
            <div className="vacation-stat">
              <span className="stat-label">Sick Days Balance</span>
              <span className="stat-value">{leaveSettings.sickDays}</span>
            </div>
            <div 
              className="vacation-stat clickable-stat"
              onClick={() => setVacationModalType('sick-used')}
              style={{cursor: 'pointer'}}
              title="Click to view details"
            >
              <span className="stat-label">Days Used</span>
              <span className="stat-value" style={{color: '#FF9696'}}>{sickUsed}</span>
            </div>
          </div>
          <div className="vacation-bottom-section">
            <span className="balance-label">Current Available Balance</span>
            <span className="balance-value">{sickBalance.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showManualIn && <ManualTimeModal mode="checkIn" onClose={() => setShowManualIn(false)} />}
      {showManualOut && <ManualTimeModal mode="checkOut" onClose={() => setShowManualOut(false)} />}
      {showAddBreak && <AddBreakModal onClose={() => setShowAddBreak(false)} />}
      {showAddDay && <AddDayModal onClose={() => setShowAddDay(false)} />}
      {showViewHours && <ViewHoursModal onClose={() => setShowViewHours(false)} />}
      {vacationModalType && (
        <VacationDetailsModal 
          type={vacationModalType} 
          onClose={() => setVacationModalType(null)} 
        />
      )}
    </main>
  );
}

export default Dashboard;
