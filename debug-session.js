// Debug script to test session persistence
// Run this in browser console after logging in

function debugSession() {
    console.log('=== SESSION DEBUG ===');
    
    // Check current user
    const currentUser = localStorage.getItem('currentUser');
    console.log('Current user in localStorage:', currentUser);
    
    if (currentUser) {
        try {
            // Try to parse username from encrypted data
            const allKeys = Object.keys(localStorage);
            const userKeys = allKeys.filter(key => key.includes('_') && key !== 'users');
            
            let username = null;
            for (const key of userKeys) {
                const parts = key.split('_');
                if (parts.length >= 2) {
                    username = parts[parts.length - 1];
                    break;
                }
            }
            
            if (username) {
                console.log('Detected username:', username);
                
                // Check session settings
                const sessionSettings = localStorage.getItem(`sessionSettings_${username}`);
                console.log('Session settings:', sessionSettings);
                
                // Check last activity
                const lastActivity = localStorage.getItem(`lastActivity_${username}`);
                console.log('Last activity:', lastActivity);
                
                if (lastActivity) {
                    const now = Date.now();
                    const inactiveTime = now - parseInt(lastActivity, 10);
                    const inactiveMinutes = Math.floor(inactiveTime / (1000 * 60));
                    console.log(`Inactive for: ${inactiveMinutes} minutes`);
                    
                    if (sessionSettings) {
                        try {
                            // This is a simplified check - in real app it's decrypted
                            const timeoutMatch = sessionSettings.match(/timeout["?:\s*]?\s*(\d+)/);
                            const timeout = timeoutMatch ? parseInt(timeoutMatch[1]) : 30;
                            console.log(`Session timeout: ${timeout} minutes`);
                            
                            if (timeout > 0 && inactiveMinutes > timeout) {
                                console.log('❌ SESSION SHOULD BE EXPIRED');
                            } else {
                                console.log('✅ SESSION SHOULD BE VALID');
                            }
                        } catch (e) {
                            console.log('Could not parse session settings');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Debug error:', error);
        }
    } else {
        console.log('No user found in localStorage');
    }
    
    console.log('=== END DEBUG ===');
}

// Auto-run debug
debugSession();

// Also run after 5 seconds to see if anything changes
setTimeout(debugSession, 5000);

console.log('Debug script loaded. Run debugSession() manually to check session status.');
