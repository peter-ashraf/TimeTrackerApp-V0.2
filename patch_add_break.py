import re

filepath = r"f:\Peter\Practice\TimeTrackerApp-V0.2\src\components\AddBreakModal.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = r"return \(\s*<>\s*<ModalShell onClose=\{onClose\} closeOnOverlay=\{false\} contentClassName=\"add-break-modal\">"

new_jsx = """return (
    <>
      <ModalShell onClose={onClose} closeOnOverlay={false} contentClassName="add-break-modal" title="Add Break">
        <div className="modal-header">
          <h2>Add Break</h2>
        </div>
        <div className="modal-body bento-modal-grid">
          
          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📅 Date</div>
            <input
              type="date"
              className="bento-modal-card-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="bento-modal-card">
            <div className="bento-modal-card-label">☕ Break Start</div>
            <input
              type="time"
              className="bento-modal-card-input"
              value={breakStart}
              onChange={(e) => setBreakStart(e.target.value)}
            />
          </div>

          <div className="bento-modal-card">
            <div className="bento-modal-card-label">✅ Break End</div>
            <input
              type="time"
              className="bento-modal-card-input"
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
            />
          </div>

          <div className="bento-modal-card full-width">
            <div className="bento-modal-card-label">📝 Notes</div>
            <input
              type="text"
              className="bento-modal-card-input"
              placeholder="e.g. Lunch"
              value={breakNotes}
              onChange={(e) => setBreakNotes(e.target.value)}
            />
          </div>
          
        </div>
        <div className="modal-footer">
          <button className="btn-secondary bento-modal-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary bento-modal-btn-glow" onClick={handleSave}>
            Save Break
          </button>
        </div>
      </ModalShell>
      {alertModal.isOpen && (
        <AlertModal
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        />
      )}
    </>
  );"""

pattern = re.compile(r"return \(\s*<>\s*<ModalShell onClose=\{onClose\} closeOnOverlay=\{false\} contentClassName=\"add-break-modal\">.*?</>\s*\);", re.DOTALL)

if pattern.search(content):
    new_content = pattern.sub(new_jsx, content)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully replaced AddBreakModal JSX.")
else:
    print("Could not find the target pattern in AddBreakModal.jsx")
