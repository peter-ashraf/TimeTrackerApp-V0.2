import re

filepath = r"f:\Peter\Practice\TimeTrackerApp-V0.2\src\components\LeaveCalculator.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# We want to replace the `return (` block.
# Let's find the start of the return block:
start_marker = r"return \(\s*<ModalShell isOpen=\{true\} onClose=\{onClose\} title=\"Leave Time Calculator\">\s*<div className=\"modal-header\"><h2>Leave Calculator</h2></div>\s*<div className=\"modal-body leave-calculator\">"

new_jsx = """return (
    <ModalShell isOpen={true} onClose={onClose} title="Leave Calculator">
      <div className="modal-header">
        <h2>{calcMode === 'forward' ? 'Calculate Leave Time' : 'Calculate Overtime Target'}</h2>
      </div>
      
      <div className="modal-body bento-modal-grid leave-calculator">
        {/* Date Selection */}
        <div className="bento-modal-card">
          <div className="bento-modal-card-label">📅 Selected Date</div>
          <div className="bento-modal-huge-value" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>
            {selectedDate}
          </div>
        </div>

        {/* Required Duration */}
        <div className="bento-modal-card">
          <div className="bento-modal-card-label">⏱ Required Duration</div>
          <div className="bento-modal-huge-value" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>
            {formatMinutesAsHours(requiredDailyMinutes)}
            <small>{employee.employeeType === 'part-time' ? 'Part-time' : 'Full-time'}</small>
          </div>
        </div>

        {/* Check-in Time */}
        <div className="bento-modal-card">
          <div className="bento-modal-card-label">🕒 Check-in Time</div>
          {hasExistingCheckIn ? (
            <div className="bento-modal-huge-value" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, opacity: 0.6 }}>
              {loadedCheckIn}
              <small>Loaded from record</small>
            </div>
          ) : (
            <input
              type="time"
              className="bento-modal-card-input"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              step="1"
            />
          )}
          {!hasExistingCheckIn && !checkInTime && <div style={{ color: 'var(--color-warning)', fontSize: '0.8rem', marginTop: '4px' }}>⚠️ Required</div>}
        </div>

        {/* Planned Break Start */}
        <div className="bento-modal-card">
          <div className="bento-modal-card-label">☕ Planned Break Start</div>
          <input
            type="time"
            className="bento-modal-card-input"
            value={plannedBreakStartTime}
            onChange={(e) => setPlannedBreakStartTime(e.target.value)}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Paid breaks: {formatTime12Hour(minutesToTime(allowedBreakStartMins).substring(0,5))} - {formatTime12Hour(minutesToTime(allowedBreakEndMins).substring(0,5))}
          </div>
        </div>

        {/* Expected Break Duration */}
        <div className="bento-modal-card full-width">
          <div className="bento-modal-card-label">⏳ Expected Break Duration (mins)</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="number"
              className="bento-modal-card-input"
              value={userBreakMinutes === 0 ? '' : userBreakMinutes}
              onChange={(e) => setUserBreakMinutes(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
              min="0" step="5" placeholder="e.g., 60"
            />
            {loadedBreakMinutes > 0 && userBreakMinutes !== loadedBreakMinutes && (
              <button className="btn-secondary" onClick={() => setUserBreakMinutes(loadedBreakMinutes)} style={{ borderRadius: '12px', padding: '0 16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', whiteSpace: 'nowrap' }}>
                Use Logged ({loadedBreakMinutes}m)
              </button>
            )}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="bento-modal-card full-width">
          <div className="bento-modal-card-label">⚙️ Calculation Mode</div>
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '16px' }}>
            <button 
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: calcMode === 'forward' ? 'rgba(255,255,255,0.1)' : 'transparent', color: calcMode === 'forward' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s' }}
              onClick={() => setCalcMode('forward')}
            >
              Forward (Target Leave Time)
            </button>
            <button 
              style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: calcMode === 'reverse' ? 'rgba(255,255,255,0.1)' : 'transparent', color: calcMode === 'reverse' ? 'white' : 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s' }}
              onClick={() => setCalcMode('reverse')}
            >
              Reverse (Target Overtime)
            </button>
          </div>
        </div>

        {/* Minimum Required Leave Time */}
        {fulfillmentLeaveTime && (
          <div className="bento-modal-card full-width" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
            <div className="bento-modal-card-label" style={{ color: 'var(--color-success)' }}>✅ Minimum Fulfillment Leave Time</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="bento-modal-huge-value" style={{ margin: 0, textShadow: 'none' }}>
                {formatTime12Hour(fulfillmentLeaveTime)}
              </div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Leaves exactly at<br/>{formatMinutesAsHours(requiredDailyMinutes)}
              </div>
            </div>
          </div>
        )}

        {calcMode === 'forward' ? (
          <>
            <div className="bento-modal-card full-width">
              <div className="bento-modal-card-label">🎯 Expected Leave Time</div>
              <input
                type="time"
                className="bento-modal-card-input"
                value={leaveTime}
                onChange={(e) => setLeaveTime(e.target.value)}
                step="1"
              />
            </div>
          </>
        ) : (
          <>
            <div className="bento-modal-card">
              <div className="bento-modal-card-label">🎯 Target Daily Overtime (hrs)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  className="bento-modal-card-input"
                  value={overtimeAmount}
                  onChange={(e) => setOvertimeAmount(e.target.value)}
                  step="0.25" min="0" placeholder="e.g., 1.5"
                />
                <button
                  className="btn-secondary"
                  onClick={() => setOvertimeAmount((currentTotalOvertimeMinutes / 60).toFixed(2))}
                  style={{ borderRadius: '12px', padding: '0 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', whiteSpace: 'nowrap', marginBottom: '8px' }}
                >
                  Max
                </button>
              </div>
            </div>
            <div className="bento-modal-card">
              <div className="bento-modal-card-label">📊 Overtime Logic</div>
              <select className="bento-modal-card-input" value={overtimeMode} onChange={(e) => setOvertimeMode(e.target.value)}>
                <option value="spend">Add to Required</option>
                <option value="keep">Total Target</option>
              </select>
            </div>
          </>
        )}

        {validationError && (
          <div className="bento-modal-card full-width" style={{ border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <div style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{validationError}</div>
          </div>
        )}

        {projectedWorkedMinutes > 0 && (
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📈 Calculation Results</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Projected Work Time</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatMinutesAsHours(projectedWorkedMinutes)}</div>
              </div>
              
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Daily Balance</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: dailyBalanceMinutes >= 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {formatMinutesAsHours(dailyBalanceMinutes)}
                </div>
              </div>

              {calcMode === 'forward' && (
                <>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Total Overtime Change</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: projectedTotalOvertimeMinutes >= currentTotalOvertimeMinutes ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {projectedTotalOvertimeMinutes > currentTotalOvertimeMinutes ? '+' : ''}
                      {formatMinutesAsHours(projectedTotalOvertimeMinutes - currentTotalOvertimeMinutes, true)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>New Total Overtime</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: projectedTotalOvertimeMinutes >= 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {formatMinutesAsHours(projectedTotalOvertimeMinutes, true)}
                    </div>
                  </div>
                </>
              )}
              
              {calcMode === 'reverse' && leaveTime && (
                <div style={{ gridColumn: '1 / -1', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--color-success)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Leave Time</div>
                  <div className="bento-modal-huge-value" style={{ margin: 0 }}>{leaveTime}</div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      <div className="modal-footer">
        <button className="btn-secondary bento-modal-btn-outline" onClick={onClose}>
          Cancel
        </button>
        {((calcMode === 'forward' && leaveTime) || (calcMode === 'reverse' && leaveTime)) && !validationError && (
          <button className="btn-primary bento-modal-btn-glow" onClick={handleSave}>
            Use Calculated Time
          </button>
        )}
      </div>
    </ModalShell>
  );"""

# Replace from `return (` to the end of the file
pattern = re.compile(r"return \(\s*<ModalShell isOpen=\{true\} onClose=\{onClose\} title=\"Leave Time Calculator\">.*?</ModalShell>\s*\);\s*};\s*export default LeaveCalculator;", re.DOTALL)

if pattern.search(content):
    new_content = pattern.sub(new_jsx + "\n};\n\nexport default LeaveCalculator;", content)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully replaced LeaveCalculator JSX.")
else:
    print("Could not find the target pattern in LeaveCalculator.jsx")
