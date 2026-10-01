filepath = r"f:\Peter\Practice\TimeTrackerApp-V0.2\src\components\ManualTimeModal.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re
match = re.search(r"return \(\s*<>\s*<ModalShell", content)
if not match:
    print("Could not find start of return block!")
    exit(1)

first_half = content[:match.start()]

new_jsx = """return (
    <>
      <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="manual-time-modal">
        <div className="modal-header">
          <h2>{mode === 'checkIn' ? 'Manual Check In' : 'Manual Check Out'}</h2>
        </div>
        <div className="modal-body bento-modal-grid">
          
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📅 Apply For</div>
            <CustomSelect
              id="apply-mode-select"
              name="applyMode"
              value={applyMode}
              onChange={(e) => setApplyMode(e.target.value)}
              options={[
                { label: `Today (${formatDate(new Date())})`, value: 'today' },
                { label: 'Specific date', value: 'date' }
              ]}
              className="bento-modal-card-input"
            />
          </div>

          {applyMode === 'date' && (
            <div className="bento-modal-card full-width">
              <div className="bento-modal-card-label">🗓️ Select Date</div>
              <input
                type="date"
                className="bento-modal-card-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">⏱️ Time (HH:MM:SS)</div>
            <input
              type="time"
              step="1"
              className="bento-modal-card-input"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              style={{ fontSize: '1.25rem', padding: '20px' }}
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary bento-modal-btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary bento-modal-btn-glow" onClick={handleSave}>Save Time</button>
        </div>
      </ModalShell>
    </>
  );
}

export default ManualTimeModal;
"""

with open(filepath, "w", encoding="utf-8") as f:
    f.write(first_half + new_jsx)

print("Successfully replaced ManualTimeModal JSX.")
