import re

filepath = r"f:\Peter\Practice\TimeTrackerApp-V0.2\src\components\AddDayModal.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

new_jsx = """return (
    <>
      <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="add-day-modal">
        <div className="modal-header">
          <h2>Request Time Off / Add Day</h2>
        </div>
        <div className="modal-body bento-modal-grid">
          
          {/* Day Type Selection */}
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">🏖️ Day Type</div>
            <CustomSelect
              id="add-day-type-select"
              name="dayType"
              value={dayType}
              onChange={(e) => setDayType(e.target.value)}
              options={[
                { label: 'Vacation Full Day', value: 'Vacation Full Day' },
                { label: 'Vacation Half Day', value: 'Vacation Half Day' },
                { label: 'Sick Leave Full Day', value: 'Sick Leave Full Day' },
                { label: 'Sick Leave Half Day', value: 'Sick Leave Half Day' },
                { label: 'Holiday Full Day', value: 'Holiday Full Day' },
                { label: 'Leave Full Day', value: 'Leave Full Day' },
                { label: 'To Be Added Full Day', value: 'To Be Added Full Day' }
              ]}
              className="bento-modal-card-input"
            />
          </div>

          {/* Calendar Selection */}
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📅 Select Dates</div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
              <Calendar
                className="add-day-calendar bento-calendar"
                onClickDay={handleDateToggle}
                tileClassName={tileClassName}
                tileDisabled={tileDisabled}
              />
            </div>
            
            <div className="bento-modal-card-label">🎯 Selected Dates ({selectedDates.length})</div>
            <div className="selected-dates-summary" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedDates.length > 0 ? (
                selectedDates.map((date) => (
                  <button
                    type="button"
                    key={date}
                    className="selected-date-chip"
                    onClick={() => setSelectedDates((currentDates) => currentDates.filter((selectedDate) => selectedDate !== date))}
                    title={`Remove ${date}`}
                    style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '16px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {date} ✕
                  </button>
                ))
              ) : (
                <span className="selected-dates-empty" style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No dates selected</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📝 Notes (optional)</div>
            <textarea
              className="bento-modal-card-input"
              placeholder="Add notes..."
              rows="3"
              value={dayNotes}
              onChange={(e) => setDayNotes(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary bento-modal-btn-outline" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="btn-primary bento-modal-btn-glow" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Adding...' : `Add ${selectedDates.length === 1 ? 'Day' : 'Days'}`}
          </button>
        </div>
      </ModalShell>

      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ isOpen: false, message: '', type: 'info' })}
      />
    </>
  );"""

pattern = re.compile(r"return \(\s*<>\s*<ModalShell onClose=\{onClose\} closeOnOverlay=\{false\} contentClassName=\"add-day-modal\">.*?</>\s*\);", re.DOTALL)

if pattern.search(content):
    new_content = pattern.sub(new_jsx, content)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully replaced AddDayModal JSX.")
else:
    print("Could not find the target pattern in AddDayModal.jsx")
