filepath = r"f:\Peter\Practice\TimeTrackerApp-V0.2\src\components\EditEntryModal.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Find the exact index of the start of the return block
import re
match = re.search(r"return \(\s*<>\s*<ModalShell", content)
if not match:
    print("Could not find start of return block!")
    exit(1)

first_half = content[:match.start()]

new_jsx = """return (
    <>
    <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="edit-entry-modal">
      <div className="modal-header">
        <h2>Edit Entry: {entry.date}</h2>
      </div>
      <div className="modal-body bento-modal-grid">
        
        {/* Entry Type */}
        <div className="bento-modal-card full-width">
          <div className="bento-modal-card-label">📁 Entry Type</div>
          <CustomSelect
            id="entry-type-select"
            name="type"
            value={editedEntry.type || 'Regular'}
            onChange={(e) => setEditedEntry({ ...editedEntry, type: e.target.value })}
            options={[
              { label: 'Regular', value: 'Regular' },
              { label: 'Vacation', value: 'Vacation' },
              { label: 'Sick Leave', value: 'Sick Leave' },
              { label: 'Holiday', value: 'Holiday' },
              { label: 'Leave', value: 'Leave' },
              { label: 'To Be Added', value: 'To Be Added' }
            ]}
            className="bento-modal-card-input"
          />
        </div>

        {editedEntry.type === 'Regular' && (
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">⏱️ Time Intervals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {editedEntry.intervals.map((interval, index) => {
                const isFirst = index === 0;
                const firstLabel = isFirst ? 'Check In' : 'Break End';
                const secondLabel = isFirst ? 'Check Out (or Break Start)' : 'Check Out';

                return (
                  <div key={index} style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* Check In */}
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>{firstLabel}</div>
                        <input
                          type="time"
                          step="1"
                          className="bento-modal-card-input"
                          value={isValidTime(interval.in) || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(interval.in) ? interval.in : ''}
                          onChange={(e) => handleTimePickerChange(index, 'in', e.target.value)}
                          style={{ margin: 0 }}
                        />
                      </div>

                      {/* Check Out */}
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>{secondLabel}</div>
                        <input
                          type="time"
                          step="1"
                          className="bento-modal-card-input"
                          value={isValidTime(interval.out) || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(interval.out) ? interval.out : ''}
                          onChange={(e) => handleTimePickerChange(index, 'out', e.target.value)}
                          style={{ margin: 0 }}
                        />
                      </div>
                    </div>
                    
                    {editedEntry.intervals.length > 1 && (
                      <button
                        onClick={() => removeInterval(index)}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px' }}
                        title="Remove interval"
                      >✕</button>
                    )}
                  </div>
                )
              })}
            </div>
            
            <button className="btn-secondary" onClick={addInterval} style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px dashed rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', width: '100%', fontWeight: 600 }}>
              + Add Break Interval
            </button>
          </div>
        )}

        {editedEntry.type !== 'Regular' && (
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">⏳ Duration</div>
            <CustomSelect
              id="entry-duration-select"
              name="duration"
              value={editedEntry.duration || 1}
              onChange={(e) => setEditedEntry({ ...editedEntry, duration: parseFloat(e.target.value) })}
              options={[
                { label: 'Half Day', value: 0.5 },
                { label: 'Full Day', value: 1 }
              ]}
              className="bento-modal-card-input"
            />
          </div>
        )}

        {/* Notes */}
        <div className="bento-modal-card full-width">
          <div className="bento-modal-card-label">📝 Notes</div>
          <textarea
            className="bento-modal-card-input"
            placeholder="Add notes..."
            rows="3"
            value={editedEntry.notes || ''}
            onChange={(e) => setEditedEntry({ ...editedEntry, notes: e.target.value })}
            style={{ resize: 'none' }}
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-secondary bento-modal-btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary bento-modal-btn-glow" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </ModalShell>
    <AlertModal
      isOpen={alertModal.isOpen}
      title={alertModal.title}
      message={alertModal.message}
      type={alertModal.type}
      onClose={closeAlertModal}
    />
    </>
  );
}

export default EditEntryModal;
"""

with open(filepath, "w", encoding="utf-8") as f:
    f.write(first_half + new_jsx)

print("Successfully replaced EditEntryModal using simple split.")
