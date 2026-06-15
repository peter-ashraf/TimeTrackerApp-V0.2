import React, { useState, useMemo } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import hapticFeedback from '../utils/hapticFeedback';
import ManualTimeModal from './ManualTimeModal';
import AddBreakModal from './AddBreakModal';
import AddDayModal from './AddDayModal';
import ViewHoursModal from './ViewHoursModal';
import VacationDetailsModal from './VacationDetailsModal';
import DashboardSkeleton from './DashboardSkeleton';

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

  // Temporary delay to test skeleton loading
  const [isLoading, setIsLoading] = useState(true); // Set to true to show skeleton initially
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // 2 seconds
    
    return () => clearTimeout(timer);
  }, []);

  const currentPeriod = useMemo(() => {
    return getCurrentPeriod();
  }, [getCurrentPeriod]);

  // Calculate vacation stats
  const periodEntries = useMemo(() => {
    if (!currentPeriod) return [];
    
    const periodStart = currentPeriod.start_date || currentPeriod.start;
    const periodEnd = currentPeriod.end_date || currentPeriod.end;
    
    return entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= new Date(periodStart) && entryDate <= new Date(periodEnd);
    });
  }, [entries, currentPeriod]);

  // Check if user is already checked in
  const isCheckedIn = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find(e => e.date === today);
    
    if (!todayEntry || !todayEntry.intervals) return false;
    
    return todayEntry.intervals.some(interval => interval.in && !interval.out);
  }, [entries]);


  // ✅ Memoize leave statistics (YEAR-BASED)
  const leaveStats = useMemo(() => {
    const annualVacation = toFiniteNumber(leaveSettings?.annualVacation, 10);
    const sickDaysLimit = toFiniteNumber(leaveSettings?.sickDays, 7);

    // Filter all entries for the current year
    const currentYear = new Date().getFullYear();
    const yearlyEntries = entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate.getFullYear() === currentYear;
    });

    const vacationTaken = yearlyEntries
      .filter(e => e.type === 'Vacation')
      .reduce((sum, e) => sum + (e.duration || 1), 0);

    const toBeAdded = yearlyEntries
      .filter(e => e.type === 'To Be Added')
      .reduce((sum, e) => sum + (e.duration || 1), 0);

    const sickUsed = yearlyEntries
      .filter(e => e.type === 'Sick Leave')
      .reduce((sum, e) => sum + (e.duration || 1), 0);

    const vacationBalance = annualVacation - vacationTaken + toBeAdded;
    const sickBalance = sickDaysLimit - sickUsed;

    return {
      annualVacation,
      sickDaysLimit,
      vacationTaken,
      toBeAdded,
      sickUsed,
      vacationBalance,
      sickBalance
    };
  }, [entries, leaveSettings]);

  // Destructure for use in JSX
  const {
    annualVacation,
    sickDaysLimit,
    vacationTaken,
    toBeAdded,
    sickUsed,
    vacationBalance,
    sickBalance,
  } = leaveStats;

  // Calculate overtime
  const overtimeDetails = useMemo(() => {
    if (!calculateOvertimeDetails || !currentPeriod) {
      return { totalHoursWorked: 0, totalExtraHours: 0, totalExtraHoursWithFactor: 0 };
    }
    
    const periodStart = currentPeriod.start_date || currentPeriod.start;
    const periodEnd = currentPeriod.end_date || currentPeriod.end;
    
    return calculateOvertimeDetails(entries, periodStart, periodEnd);
  }, [entries, currentPeriod, calculateOvertimeDetails]);

  const overtime = overtimeDetails.totalExtraHoursWithFactor;
  
  // Salary calculation (2/3 of salary)
  const salaryData = useMemo(() => {
    const salaryDivided = employee.salary / 3;
    const salaryTwoThird = salaryDivided * 2;
    const employeeHourCost = salaryTwoThird / employee.monthlyHours;
    const overtimeMoney = overtime * employeeHourCost;
    const totalSalary = employee.salary + overtimeMoney;

    return { overtimeMoney, totalSalary };
  }, [employee.salary, overtime]);

  const { overtimeMoney, totalSalary } = salaryData;
  
  if (isLoading) {
    return <DashboardSkeleton />;
  }

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
              onClick={() => {
                hapticFeedback.toggleSwitch();
                setHideSalary(!hideSalary);
              }}
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
          onClick={() => {
            hapticFeedback.buttonClick();
            setShowManualIn(true);
          }}
        >
          Manual In
        </button>
        <button 
          className="btn btn-secondary manual-check-out-btn"
          onClick={() => {
            hapticFeedback.buttonClick();
            setShowManualOut(true);
          }}
        >
          Manual Out
        </button>
        <button 
          className="btn btn-secondary add-break-btn"
          onClick={() => {
            hapticFeedback.buttonClick();
            setShowAddBreak(true);
          }}
        >
          Add Break
        </button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className={`btn btn-primary ${isCheckedIn ? 'disabled' : ''}`}
          onClick={() => {
            if (!isCheckedIn) {
              hapticFeedback.checkIn();
              checkIn();
            }
          }}
          disabled={isCheckedIn}
        >Check In</button>
        <button 
          className={`btn btn-primary ${!isCheckedIn ? 'btn-disabled' : ''}`}
          onClick={() => {
            hapticFeedback.checkOut();
            checkOut();
          }}
          disabled={!isCheckedIn}
          title={!isCheckedIn ? 'You must check in first' : 'Check out'}
        >Check Out</button>
        <button className="btn btn-secondary" onClick={() => {
          hapticFeedback.buttonClick();
          setShowAddDay(true);
        }}>Add Day</button>
        <button className="btn btn-outline" onClick={() => {
          hapticFeedback.buttonClick();
          setShowViewHours(true);
        }}>View Hours</button>
      </div>

      {/* Vacation Cards */}
      <div className="vacation-cards">
        {/* Vacation Card */}
        <div className="vacation-card-redesigned">
          <div className="vacation-top-section">
            <div className="vacation-stat">
              <span className="stat-label">Official Balance</span>
              <span className="stat-value">{annualVacation}</span>
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
              <span className="stat-value">{sickDaysLimit}</span>
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
