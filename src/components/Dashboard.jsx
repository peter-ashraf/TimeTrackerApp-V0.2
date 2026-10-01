import React, { useState, useMemo } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import hapticFeedback from '../utils/hapticFeedback';
import ManualTimeModal from './ManualTimeModal';
import AddBreakModal from './AddBreakModal';
import AddDayModal from './AddDayModal';
import ViewHoursModal from './ViewHoursModal';
import VacationDetailsModal from './VacationDetailsModal';
import LeaveCalculator from './LeaveCalculator';
import DashboardSkeleton from './DashboardSkeleton';
import './bento-dashboard.css';

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
  const [showLeaveCalculator, setShowLeaveCalculator] = useState(false);
  const [calculatorDate, setCalculatorDate] = useState(null);
  const [vacationModalType, setVacationModalType] = useState(null);
  const [showOvertimeInHoursMinutes, setShowOvertimeInHoursMinutes] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); 
    return () => clearTimeout(timer);
  }, []);

  const currentPeriod = useMemo(() => {
    return getCurrentPeriod();
  }, [getCurrentPeriod]);

  const isCheckedIn = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find(e => e.date === today);
    if (!todayEntry || !todayEntry.intervals) return false;
    return todayEntry.intervals.some(interval => interval.in && !interval.out);
  }, [entries]);

  const leaveStats = useMemo(() => {
    const annualVacation = toFiniteNumber(leaveSettings?.annualVacation, 10);
    const sickDaysLimit = toFiniteNumber(leaveSettings?.sickDays, 7);
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

    return { vacationBalance, sickBalance };
  }, [entries, leaveSettings]);

  const { vacationBalance, sickBalance } = leaveStats;

  const overtimeDetails = useMemo(() => {
    if (!calculateOvertimeDetails || !currentPeriod) {
      return { totalHoursWorked: 0, totalExtraHours: 0, totalExtraHoursWithFactor: 0 };
    }
    const periodStart = currentPeriod.start_date || currentPeriod.start;
    const periodEnd = currentPeriod.end_date || currentPeriod.end;
    return calculateOvertimeDetails(entries, periodStart, periodEnd);
  }, [entries, currentPeriod, calculateOvertimeDetails]);

  const overtime = overtimeDetails.totalExtraHoursWithFactor;
  
  const salaryData = useMemo(() => {
    const salaryDivided = employee.salary / 3;
    const salaryTwoThird = salaryDivided * 2;
    const employeeHourCost = salaryTwoThird / employee.monthlyHours;
    const overtimeMoney = overtime * employeeHourCost;
    const totalSalary = employee.salary + overtimeMoney;
    return { overtimeMoney, totalSalary };
  }, [employee.salary, overtime]);

  const { totalSalary } = salaryData;
  
  const formatOvertime = (hoursDecimal) => {
    if (!showOvertimeInHoursMinutes) {
      return `${hoursDecimal.toFixed(2)}h`;
    }
    const isNegative = hoursDecimal < 0;
    const absHours = Math.abs(hoursDecimal);
    const hours = Math.floor(absHours);
    const minutes = (absHours - hours) * 60;
    const minutesStr = parseFloat(minutes.toFixed(1)).toString();
    const sign = isNegative ? '-' : '';
    return `${sign}${hours}h ${minutesStr}m`;
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="bento-main main-content">
      <div className="bento-header-section">
        <h1>{employee.name ? `Hi, ${employee.name.split(' ')[0]}` : 'Dashboard'}</h1>
        <p>{currentPeriod?.label || 'No Period'}</p>
      </div>

      <div className="bento-grid dashboard-grid">
        {/* Massive Hero Check-In Tile */}
        <div 
          className={`bento-tile tile-hero col-span-4 row-span-2 ${isCheckedIn ? 'active' : ''}`} 
          onClick={() => {
            if (!isCheckedIn) {
              hapticFeedback.checkIn();
              checkIn();
            }
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <i className={`fa-solid ${isCheckedIn ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
            <span>{isCheckedIn ? 'Tracking...' : 'Check In'}</span>
          </div>
        </div>

        {/* Overtime Tile */}
        <div 
          className="bento-tile col-span-2 row-span-1 mobile-square"
          onClick={() => {
            hapticFeedback.buttonClick();
            setShowOvertimeInHoursMinutes(!showOvertimeInHoursMinutes);
          }}
        >
          <span className="bento-label">Overtime</span>
          <span className={`bento-value ${overtime >= 0 ? 'text-green' : 'text-pink'}`}>
            {formatOvertime(overtime)}
          </span>
        </div>

        {/* Salary Tile */}
        <div className="bento-tile col-span-2 row-span-1 mobile-square">
          <span className="bento-label">Est. Salary</span>
          <span className="bento-value text-cyan" style={{ filter: hideSalary ? 'blur(10px)' : 'none', opacity: hideSalary ? 0.5 : 1 }}>
            {hideSalary ? '£0,000' : `£${totalSalary.toLocaleString()}`}
          </span>
          <button 
            className="bento-eye-btn" 
            onClick={(e) => {
              e.stopPropagation();
              hapticFeedback.toggleSwitch();
              setHideSalary(!hideSalary);
            }}
          >
            <i className={`fa-solid ${hideSalary ? 'fa-eye' : 'fa-eye-slash'}`}></i>
          </button>
        </div>

        {/* Leave Balances (Moved up for mobile layout) */}
        <div 
          className="bento-tile col-span-3 flex-row-between mobile-square" 
          onClick={() => { hapticFeedback.buttonClick(); setVacationModalType('vacation-taken'); }}
        >
          <div className="mobile-center-content">
            <span className="bento-label">Vacation</span>
            <span className="bento-value text-cyan">{vacationBalance.toFixed(1)}</span>
          </div>
          <i className="fa-solid fa-plane text-cyan" style={{ fontSize: '24px', opacity: 0.5 }}></i>
        </div>
        
        <div 
          className="bento-tile col-span-3 flex-row-between mobile-square" 
          onClick={() => { hapticFeedback.buttonClick(); setVacationModalType('sick-used'); }}
        >
          <div className="mobile-center-content">
            <span className="bento-label">Sick</span>
            <span className="bento-value text-cyan">{sickBalance.toFixed(1)}</span>
          </div>
          <i className="fa-solid fa-briefcase-medical text-cyan" style={{ fontSize: '24px', opacity: 0.5 }}></i>
        </div>

        {/* Manual In */}
        <div className="bento-tile tile-action tile-manual-in col-span-2" onClick={() => { hapticFeedback.buttonClick(); setShowManualIn(true); }}>
          <i className="fa-solid fa-clock"></i>
          <span>Manual In</span>
        </div>

        {/* Check Out (Stop Timer) Tile */}
        <div 
          className={`bento-tile tile-danger tile-stop-timer col-span-4 ${!isCheckedIn ? 'disabled' : ''}`}
          onClick={() => {
            if (isCheckedIn) {
              hapticFeedback.checkOut();
              checkOut();
            }
          }}
        >
          <i className="fa-solid fa-stop"></i>
          <span>Stop Timer</span>
        </div>

        {/* Manual Out */}
        <div className="bento-tile tile-action tile-manual-out col-span-2" onClick={() => { hapticFeedback.buttonClick(); setShowManualOut(true); }}>
          <i className="fa-regular fa-clock"></i>
          <span>Manual Out</span>
        </div>

        {/* Break Tile */}
        <div className="bento-tile tile-action tile-break col-span-2" onClick={() => { hapticFeedback.buttonClick(); setShowAddBreak(true); }}>
          <i className="fa-solid fa-mug-hot"></i>
          <span>Break</span>
        </div>

        {/* Insights Tile */}
        <div className="bento-tile tile-action tile-insights col-span-2" onClick={() => { hapticFeedback.buttonClick(); setShowViewHours(true); }}>
          <i className="fa-solid fa-chart-pie text-cyan"></i>
          <span>Insights</span>
        </div>

        {/* Bottom Actions */}
        <div className="bento-tile tile-action tile-add-day col-span-3 flex-row-between" onClick={() => { hapticFeedback.buttonClick(); setShowAddDay(true); }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Add Day</span>
          <i className="fa-solid fa-plus text-green"></i>
        </div>
        <div 
          className="bento-tile tile-action tile-calculator col-span-3 flex-row-between" 
          onClick={() => {
            hapticFeedback.buttonClick();
            const today = new Date().toISOString().split('T')[0];
            setCalculatorDate(today);
            setShowLeaveCalculator(true);
          }}
        >
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Calculator</span>
          <i className="fa-solid fa-calculator text-pink"></i>
        </div>
      </div>

      {/* Modals */}
      {showManualIn && <ManualTimeModal mode="checkIn" onClose={() => setShowManualIn(false)} />}
      {showManualOut && <ManualTimeModal mode="checkOut" onClose={() => setShowManualOut(false)} />}
      {showAddBreak && <AddBreakModal onClose={() => setShowAddBreak(false)} />}
      {showAddDay && <AddDayModal onClose={() => setShowAddDay(false)} />}
      {showViewHours && <ViewHoursModal onClose={() => setShowViewHours(false)} />}
      {showLeaveCalculator && (
        <LeaveCalculator 
          selectedDate={calculatorDate} 
          onClose={() => {
            setShowLeaveCalculator(false);
            setCalculatorDate(null);
          }} 
        />
      )}
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
