import re

with open('f:/Peter/Practice/TimeTrackerApp-V0.2/src/components/Settings.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add activeModal to state
if 'const [activeModal, setActiveModal] = useState(null);' not in content:
    state_code = """
  const [activeModal, setActiveModal] = useState(null);
"""
    content = content.replace('const [showAddPeriod, setShowAddPeriod] = useState(false);', state_code + '\n  const [showAddPeriod, setShowAddPeriod] = useState(false);')

if 'userPreferences, updatePreferences' not in content:
    content = content.replace('const { reminderSettings, setReminderSettings } = useUserPreferences();', 
                              'const { reminderSettings, setReminderSettings, userPreferences, updatePreferences } = useUserPreferences();')

parts = content.split('return (\n    <main className="settings-page">')
pre = parts[0]
post = parts[1]

grid_parts = post.split('<div className="settings-bento-grid-layout">')
pre_grid = grid_parts[0]
post_grid = grid_parts[1]

chunks = re.split(r'(?=\s*<div className="settings-bento-card)', post_grid)

last_chunk = chunks[-1]
# Find where the modals begin or where </main> is
closing_match = re.search(r'(\s*</div>\s*</div>\s*(?:\{.*?\})*\s*</main>.*)', last_chunk, re.DOTALL)
if closing_match:
    closing_tags = closing_match.group(1)
    last_card = last_chunk[:closing_match.start()]
    chunks[-1] = last_card
else:
    main_match = re.search(r'(\s*</div>\s*</div>\s*(?:\{.*?\})*\s*</main>.*)', last_chunk, re.DOTALL)
    if main_match:
        closing_tags = main_match.group(1)
        last_card = last_chunk[:main_match.start()]
        chunks[-1] = last_card
    else:
        main_idx = last_chunk.rfind('</main>')
        div2 = last_chunk.rfind('</div>', 0, main_idx)
        div1 = last_chunk.rfind('</div>', 0, div2)
        closing_tags = last_chunk[div1:]
        chunks[-1] = last_chunk[:div1]

# REMOVE the two orphaned </div> tags from closing_tags!
# closing_tags currently looks like: `      </div>\n      </div>\n\n      {/* Export Modal */}`
# We will just strip the first two `</div>` occurrences.
closing_tags = re.sub(r'^\s*</div>\s*</div>', '', closing_tags)

card_chunks = [c for c in chunks if c.strip()]

employee_cards = []
reminders_cards = []
periods_cards = []
data_cards = []
danger_cards = []

def clean_card(c):
    # Remove all <h2> tags
    return re.sub(r'<h2.*?>.*?</h2>', '', c)

for card in card_chunks:
    if '👤 Employee Information' in card or 'UNIFIED EMPLOYEE' in card:
        employee_cards.append(clean_card(card))
    elif '⏰ Check-in Reminders' in card or '📳 Haptic Feedback' in card:
        reminders_cards.append(clean_card(card))
    elif 'pay-period-settings-section' in card:
        periods_cards.append(clean_card(card))
    elif '📊 Data Management' in card or 'Sync Status' in card or 'App Version' in card or '🔧 Diagnostics' in card:
        data_cards.append(clean_card(card))
    elif 'danger-zone' in card:
        # Special handling for Danger Zone: it's not a generic card if we don't want it to be, but we clean H2
        danger_cards.append(clean_card(card))

new_return = """
  return (
    <main className="settings-page" style={{ background: 'var(--bg-primary)' }}>
      <div className="settings-header" style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>⚙️ Settings</h1>
        <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>Manage your preferences, data, and account</p>
      </div>

      {activeModal === null && (
        <div className="settings-panels-scroll" style={{ padding: '0 20px 24px' }}>
          <div className="settings-bento-grid-layout" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <button type="button" className="settings-menu-item" onClick={() => setActiveModal('theme')}>
              <div className="settings-menu-left"><i className="fa-solid fa-palette"></i> <span>Theme & Design</span></div>
              <i className="fa-solid fa-chevron-right chevron-icon"></i>
            </button>

            <button type="button" className="settings-menu-item" onClick={() => setActiveModal('employee')}>
              <div className="settings-menu-left"><i className="fa-solid fa-user"></i> <span>Employee Information</span></div>
              <i className="fa-solid fa-chevron-right chevron-icon"></i>
            </button>
            
            <button type="button" className="settings-menu-item" onClick={() => setActiveModal('reminders')}>
              <div className="settings-menu-left"><i className="fa-solid fa-bell"></i> <span>Check-in Reminders</span></div>
              <i className="fa-solid fa-chevron-right chevron-icon"></i>
            </button>
            
            <button type="button" className="settings-menu-item" onClick={() => setActiveModal('periods')}>
              <div className="settings-menu-left"><i className="fa-solid fa-calendar-days"></i> <span>Pay Period Management</span></div>
              <i className="fa-solid fa-chevron-right chevron-icon"></i>
            </button>

            <button type="button" className="settings-menu-item" onClick={() => setActiveModal('data')}>
              <div className="settings-menu-left"><i className="fa-solid fa-database"></i> <span>Data Management</span></div>
              <i className="fa-solid fa-chevron-right chevron-icon"></i>
            </button>

            <button type="button" className="settings-menu-item danger-item" onClick={() => setActiveModal('danger')}>
              <div className="settings-menu-left"><i className="fa-solid fa-triangle-exclamation"></i> <span>Danger Zone</span></div>
              <i className="fa-solid fa-chevron-right chevron-icon"></i>
            </button>

          </div>
        </div>
      )}

      {/* Theme Modal */}
      {activeModal === 'theme' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="modal-header" style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}><i className="fa-solid fa-palette"></i> Theme & Design</h2>
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)' }}>Switch between the modern Bento grid and the Legacy UI.</p>
               </div>
               <button type="button" className="text-btn" style={{ color: 'var(--accent-cyan)', fontWeight: '600', background: 'transparent', border: 'none', padding: '8px', cursor: 'pointer' }} onClick={() => setActiveModal(null)}>Done</button>
            </div>
          </div>
          <div className="modal-body settings-bento-grid-layout" style={{ padding: '24px', overflowY: 'auto' }}>
            <div className="settings-bento-card" style={{ gridColumn: '1 / -1' }}>
              <div className="settings-bento-card-label">🎨 UI Version</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>Choose your preferred interface. This updates the entire layout of the app instantly.</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className={`btn ${userPreferences?.designVersion === 'legacy' ? 'btn-secondary' : 'btn-primary'}`} style={{ flex: 1, padding: '12px' }} onClick={() => updatePreferences({ designVersion: 'bento' })}>Bento (V2)</button>
                <button type="button" className={`btn ${userPreferences?.designVersion === 'legacy' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: '12px' }} onClick={() => updatePreferences({ designVersion: 'legacy' })}>Legacy (V1)</button>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
"""

def generate_modal(id, icon, title, subtitle, cards, show_save):
    joined_cards = "".join(cards)
    
    footer = ""
    if show_save:
        footer = """
          <div className="modal-footer" style={{ padding: '16px 24px 24px', display: 'flex', gap: '12px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-secondary)', marginTop: 'auto' }}>
            <button type="button" className="btn-secondary bento-modal-btn-outline" style={{ flex: 1 }} onClick={() => setActiveModal(null)}>Cancel</button>
            <button type="button" className="btn-primary bento-modal-btn-glow" style={{ flex: 2 }} onClick={(e) => { handleSaveAll(e); setActiveModal(null); }}>Save Settings</button>
          </div>
"""

    return """
      {activeModal === '%s' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="modal-header" style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}><i className="%s"></i> %s</h2>
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)' }}>%s</p>
               </div>
               <button type="button" className="text-btn" style={{ color: 'var(--accent-cyan)', fontWeight: '600', background: 'transparent', border: 'none', padding: '8px', cursor: 'pointer' }} onClick={() => setActiveModal(null)}>Done</button>
            </div>
          </div>
          <div className="modal-body settings-bento-grid-layout" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            %s
          </div>
          %s
        </ModalShell>
      )}
""" % (id, icon, title, subtitle, joined_cards, footer)

new_return += generate_modal('employee', 'fa-solid fa-user', 'Employee Information', 'Manage your profile, working hours, and leave balances.', employee_cards, True)
new_return += generate_modal('reminders', 'fa-solid fa-bell', 'Check-in Reminders', 'Configure your automated check-in notifications.', reminders_cards, True)
new_return += generate_modal('periods', 'fa-solid fa-calendar-days', 'Pay Period Management', 'Setup and manage your pay periods.', periods_cards, False)
new_return += generate_modal('data', 'fa-solid fa-database', 'Data Management', 'Export, backup, or optimize your tracking data.', data_cards, False)
new_return += generate_modal('danger', 'fa-solid fa-triangle-exclamation', 'Danger Zone', 'Irreversible actions for your account and data.', danger_cards, False)

new_return += closing_tags

final_content = pre + new_return
with open('f:/Peter/Practice/TimeTrackerApp-V0.2/src/components/Settings.jsx', 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Settings.jsx patch V6 applied successfully!")
