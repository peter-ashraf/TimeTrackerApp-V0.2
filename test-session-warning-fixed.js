// SESSION WARNING TEST - FIXED VERSION
// Run this to test the fixed session warning

function testFixedSessionWarning() {
    console.log('🧪 TESTING FIXED SESSION WARNING...');
    
    // Test 1: Check if immediateWarningShown flag exists
    const authContext = document.querySelector('#root')?._reactInternalInstance?.child?.memoizedState?.memoizedState;
    
    if (authContext) {
        console.log('✅ Auth context found');
        console.log('  - immediateWarningShown:', authContext.immediateWarningShown);
        console.log('  - showSessionWarning:', authContext.showSessionWarning);
        console.log('  - sessionTimeout:', authContext.sessionTimeout);
        
        // Test 2: Manually trigger warning for 5-minute session
        if (authContext.sessionTimeout === 5) {
            console.log('🎯 Session is 5 minutes - warning should appear immediately');
            console.log('💡 If warning is glitching, the fix should prevent infinite loops');
        }
        
        // Test 3: Check if clearAllTimers function exists
        if (typeof authContext.clearAllTimers === 'function') {
            console.log('✅ clearAllTimers function exists');
        } else {
            console.log('❌ clearAllTimers function missing');
        }
        
    } else {
        console.log('❌ Auth context not found');
    }
}

// Auto-expose the function
window.testFixedSessionWarning = testFixedSessionWarning;

console.log('🔧 Fixed session warning test loaded!');
console.log('💡 Run: testFixedSessionWarning() to test the fixes');

// Also provide a function to reset the warning state
window.resetSessionWarning = () => {
    const authContext = document.querySelector('#root')?._reactInternalInstance?.child?.memoizedState?.memoizedState;
    if (authContext && typeof authContext.setShowSessionWarning === 'function') {
        authContext.setShowSessionWarning(false);
        console.log('🔄 Session warning reset');
    }
};

console.log('💡 Run: resetSessionWarning() to manually hide the warning');
