import re

with open('f:/Peter/Practice/TimeTrackerApp-V0.2/src/components/Settings.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

state_code = """
  const [activeModal, setActiveModal] = useState(null);

  const renderModalShell = (id, icon, title, subtitle, contentJsx, showSave = false) => {
    if (activeModal !== id) return null;
    return (
      <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName='settings-spoke-modal'>
        <div className='sheet-handle' style={{ margin: '8px auto 16px', width: '40px', height: '4px', background: 'var(--text-tertiary)', borderRadius: '4px' }}></div>
        <div className='modal-header' style={{ position: 'relative', borderBottom: 'none', paddingBottom: '0' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', color: 'var(--text-primary)' }}><i className={icon}></i> {title}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>{subtitle}</p>
          <button className='text-btn' style={{ position: 'absolute', top: '0', right: '0', color: 'var(--accent-cyan)', fontWeight: '600', background: 'transparent', border: 'none', padding: '8px' }} onClick={() => setActiveModal(null)}>Done</button>
        </div>
        <div className='modal-body settings-bento-grid-layout' style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {contentJsx}
        </div>
        {showSave && (
          <div className='modal-footer' style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className='btn-secondary bento-modal-btn-outline' style={{ flex: 1 }} onClick={() => setActiveModal(null)}>Cancel</button>
            <button className='btn-primary bento-modal-btn-glow' style={{ flex: 2, color: 'var(--bg-primary)' }} onClick={() => { handleSave(); setActiveModal(null); }}>Save Settings</button>
          </div>
        )}
      </ModalShell>
    );
  };
"""

content = content.replace('const [showAddPeriod, setShowAddPeriod] = useState(false);', state_code + '\n  const [showAddPeriod, setShowAddPeriod] = useState(false);')

# Split at return (
parts = content.split('return (\n    <main className="settings-page">')
pre = parts[0]
post = parts[1]

# Extract the body parts manually. We know the layout of `post`
# We'll replace the `<div className="settings-panels-scroll">` up to `</main>` with our new hub and spoke.
# Let's find the sections using regex

main_match = re.search(r'(<div className="settings-panels-scroll">.*?</main>)', post, re.DOTALL)
old_main = main_match.group(1)

# Now we want to rip out the different cards from old_main to put inside the modals.
# Employee Information (starts at Profile card)
employee_match = re.search(r'(<!-- Profile Settings -->.*?)(?=<!-- Leave Settings -->)', old_main, re.DOTALL | re.IGNORECASE)
if not employee_match:
    # Maybe comments are different
    employee_match = re.search(r'(<div className="settings-bento-card col-span-3">.*?<div className="settings-bento-card-label">.*?Employee Type.*?)(?=<div className="settings-bento-card col-span-3">\s*<div className="settings-bento-card-label">.*?Leave Configuration)', old_main, re.DOTALL)
    leave_match = re.search(r'(<div className="settings-bento-card col-span-3">\s*<div className="settings-bento-card-label">.*?Leave Configuration.*?)(?=<div className="settings-bento-card col-span-3">\s*<div className="settings-bento-card-label">.*?Check-in Reminders)', old_main, re.DOTALL)
    reminders_match = re.search(r'(<div className="settings-bento-card col-span-3">\s*<div className="settings-bento-card-label">.*?Check-in Reminders.*?)(?=<div className="settings-bento-card col-span-3 pay-period-settings-section">)', old_main, re.DOTALL)
    periods_match = re.search(r'(<div className="settings-bento-card col-span-3 pay-period-settings-section">.*?)(?=<div className="settings-bento-card col-span-3">\s*<div className="settings-bento-card-label">.*?Export Data)', old_main, re.DOTALL)
    data_match = re.search(r'(<div className="settings-bento-card col-span-3">\s*<div className="settings-bento-card-label">.*?Export Data.*?)(?=<div className="settings-bento-card col-span-6 danger-zone)', old_main, re.DOTALL)
    danger_match = re.search(r'(<div className="settings-bento-card col-span-6 danger-zone.*?)(?=<div className="settings-bento-card col-span-6">)', old_main, re.DOTALL)
    system_match = re.search(r'(<div className="settings-bento-card col-span-6">.*?)(?=</div>\s*</div>\s*</div>\s*</main>)', old_main, re.DOTALL)

hub_menu = """
      <div className="settings-panels-scroll" style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <button className="settings-menu-item" onClick={() => setActiveModal('theme')}>
            <div className="settings-menu-left"><i className="fa-solid fa-palette"></i> Theme & Design</div>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          
          <button className="settings-menu-item" onClick={() => setActiveModal('employee')}>
            <div className="settings-menu-left"><i className="fa-solid fa-user"></i> Employee Information</div>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          
          <button className="settings-menu-item" onClick={() => setActiveModal('reminders')}>
            <div className="settings-menu-left"><i className="fa-solid fa-bell"></i> Check-in Reminders</div>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          
          <button className="settings-menu-item" onClick={() => setActiveModal('periods')}>
            <div className="settings-menu-left"><i className="fa-solid fa-calendar-days"></i> Pay Period Management</div>
            <i className="fa-solid fa-chevron-right"></i>
          </button>

          <button className="settings-menu-item" onClick={() => setActiveModal('data')}>
            <div className="settings-menu-left"><i className="fa-solid fa-database"></i> Data Management</div>
            <i className="fa-solid fa-chevron-right"></i>
          </button>

          <button className="settings-menu-item danger-item" onClick={() => setActiveModal('danger')}>
            <div className="settings-menu-left"><i className="fa-solid fa-triangle-exclamation"></i> Danger Zone</div>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {renderModalShell('theme', 'fa-solid fa-palette', 'Theme & Design', 'Switch between the modern Bento grid and the Legacy UI.', (
        <div className="settings-bento-card" style={{ padding: '24px' }}>
           <div className="settings-bento-card-label">🎨 UI Version</div>
           <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>Choose your preferred interface. This updates the entire layout of the app instantly.</p>
           <div style={{ display: 'flex', gap: '12px' }}>
             <button className={`btn ${userPreferences?.designVersion === 'legacy' ? 'btn-secondary' : 'btn-primary'}`} style={{ flex: 1, padding: '12px' }} onClick={() => updatePreferences({ designVersion: 'bento' })}>Bento (V2)</button>
             <button className={`btn ${userPreferences?.designVersion === 'legacy' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: '12px' }} onClick={() => updatePreferences({ designVersion: 'legacy' })}>Legacy (V1)</button>
           </div>
        </div>
      ), false)}
"""

if employee_match:
    hub_menu += """
      {renderModalShell('employee', 'fa-solid fa-user', 'Employee Information', 'Manage your profile, working hours, and leave balances.', (
        <>
          %s
          %s
        </>
      ), true)}
""" % (employee_match.group(1), leave_match.group(1))

if reminders_match:
    hub_menu += """
      {renderModalShell('reminders', 'fa-solid fa-bell', 'Check-in Reminders', 'Configure your automated check-in notifications.', (
        <>
          %s
        </>
      ), true)}
""" % (reminders_match.group(1))

if periods_match:
    hub_menu += """
      {renderModalShell('periods', 'fa-solid fa-calendar-days', 'Pay Period Management', 'Setup and manage your pay periods.', (
        <>
          %s
        </>
      ), false)}
""" % (periods_match.group(1))

if data_match:
    hub_menu += """
      {renderModalShell('data', 'fa-solid fa-database', 'Data Management', 'Export, backup, or optimize your tracking data.', (
        <>
          %s
          %s
        </>
      ), false)}
""" % (data_match.group(1), system_match.group(1))

if danger_match:
    hub_menu += """
      {renderModalShell('danger', 'fa-solid fa-triangle-exclamation', 'Danger Zone', 'Irreversible actions for your account and data.', (
        <>
          %s
        </>
      ), false)}
""" % (danger_match.group(1))


hub_menu += "\n    </main>"
new_post = post.replace(old_main, hub_menu)
final_content = pre + 'return (\n    <main className="settings-page">\n' + new_post

with open('f:/Peter/Practice/TimeTrackerApp-V0.2/src/components/Settings.jsx', 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Settings.jsx refactored successfully")
