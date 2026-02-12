// SESSION WARNING TEST HELPER
// Run this in browser console to test the session warning

function testSessionWarning() {
    console.log('🧪 TESTING SESSION WARNING...');
    
    // Get the current auth context
    const authContext = document.querySelector('#root')?._reactInternalInstance?.child?.memoizedState?.memoizedState;
    
    if (authContext && authContext.showSessionWarning !== undefined) {
        console.log('✅ Found showSessionWarning function, forcing it to true');
        authContext.setShowSessionWarning(true);
    } else {
        console.log('❌ Could not find showSessionWarning function');
        console.log('💡 Try refreshing the page and setting a 5-minute session timeout');
    }
}

// Auto-expose the function
window.testSessionWarning = testSessionWarning;

console.log('🧪 Session warning test helper loaded!');
console.log('💡 Run: testSessionWarning() to manually trigger the warning');

// Also provide a function to check current session state
window.checkSessionState = () => {
    const authContext = document.querySelector('#root')?._reactInternalInstance?.child?.memoizedState?.memoizedState;
    if (authContext) {
        console.log('📊 Current Session State:');
        console.log('  - User:', authContext.currentUser?.username);
        console.log('  - Session Timeout:', authContext.sessionTimeout, 'minutes');
        console.log('  - Show Warning:', authContext.showSessionWarning);
        console.log('  - Last Activity:', new Date(authContext.lastActivity).toLocaleTimeString());
    } else {
        console.log('❌ Could not access session state');
    }
};

console.log('💡 Run: checkSessionState() to see current session info');
