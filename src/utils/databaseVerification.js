// Database Migration Verification Script
// This script tests the database structure and constraint enforcement

import { createClient } from '@supabase/supabase-js';

// Configuration - replace with your actual Supabase credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

class DatabaseMigrationVerifier {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    this.testResults = [];
  }

  // Test helper methods
  async runTest(testName, testFunction) {
    try {
      const result = await testFunction();
      this.testResults.push({
        test: testName,
        status: 'PASS',
        result,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (error) {
      this.testResults.push({
        test: testName,
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Test 1: Verify profiles table exists
  async testProfilesTableExists() {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      throw new Error(`Profiles table not accessible: ${error.message}`);
    }

    return { tableExists: true };
  }

  // Test 2: Verify username unique constraint exists
  async testUsernameUniqueConstraint() {
    // This would require admin access to check constraints
    // For now, we'll test it by trying to insert duplicate usernames
    const testUsername = `test_user_${Date.now()}`;
    
    // Insert first user
    const { data: firstUser, error: firstError } = await this.supabase
      .from('profiles')
      .insert({
        username: testUsername,
        email: `test1_${testUsername}@example.com`,
        id: `test1_${testUsername}`
      })
      .select()
      .single();

    if (firstError) {
      throw new Error(`Failed to insert test user: ${firstError.message}`);
    }

    // Try to insert duplicate username
    const { data: duplicateUser, error: duplicateError } = await this.supabase
      .from('profiles')
      .insert({
        username: testUsername,
        email: `test2_${testUsername}@example.com`,
        id: `test2_${testUsername}`
      })
      .select()
      .single();

    // Clean up test data
    await this.supabase
      .from('profiles')
      .delete()
      .eq('username', testUsername);

    if (!duplicateError || !duplicateError.message.includes('unique')) {
      throw new Error('Username unique constraint is not enforced');
    }

    return { constraintEnforced: true };
  }

  // Test 3: Verify no null usernames exist
  async testNoNullUsernames() {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id')
      .is('username', null);

    if (error) {
      throw new Error(`Failed to check for null usernames: ${error.message}`);
    }

    if (data.length > 0) {
      throw new Error(`Found ${data.length} profiles with null usernames`);
    }

    return { nullUsernameCount: 0 };
  }

  // Test 4: Verify username format validation
  async testUsernameFormat() {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('username')
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch usernames: ${error.message}`);
    }

    const invalidUsernames = data.filter(profile => 
      !profile.username || 
      profile.username.length < 3 || 
      profile.username.length > 50 ||
      !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(profile.username)
    );

    if (invalidUsernames.length > 0) {
      throw new Error(`Found ${invalidUsernames.length} usernames with invalid format`);
    }

    return { validUsernameCount: data.length };
  }

  // Test 5: Verify email field exists and is valid
  async testEmailField() {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('email')
      .limit(10);

    if (error) {
      throw new Error(`Failed to check email field: ${error.message}`);
    }

    const invalidEmails = data.filter(profile => 
      !profile.email || 
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
    );

    if (invalidEmails.length > 0) {
      throw new Error(`Found ${invalidEmails.length} profiles with invalid email addresses`);
    }

    return { validEmailCount: data.length };
  }

  // Test 6: Verify username lookup performance
  async testUsernameLookupPerformance() {
    const startTime = Date.now();
    
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email')
      .eq('username', 'test')
      .limit(1);

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (error) {
      throw new Error(`Username lookup failed: ${error.message}`);
    }

    if (duration > 1000) { // 1 second threshold
      throw new Error(`Username lookup too slow: ${duration}ms`);
    }

    return { lookupDuration: duration, indexUsed: duration < 100 };
  }

  // Test 7: Verify migration log table
  async testMigrationLog() {
    const { data, error } = await this.supabase
      .from('migration_log')
      .select('*')
      .eq('migration_name', 'add_username_unique_constraint')
      .single();

    if (error) {
      throw new Error(`Migration log not accessible: ${error.message}`);
    }

    if (!data) {
      throw new Error('Migration log entry not found');
    }

    return { migrationLogExists: true, status: data.status };
  }

  // Run all verification tests
  async runAllTests() {
    const tests = [
      ['Profiles Table Exists', () => this.testProfilesTableExists()],
      ['Username Unique Constraint', () => this.testUsernameUniqueConstraint()],
      ['No Null Usernames', () => this.testNoNullUsernames()],
      ['Username Format Validation', () => this.testUsernameFormat()],
      ['Email Field Validation', () => this.testEmailField()],
      ['Username Lookup Performance', () => this.testUsernameLookupPerformance()],
      ['Migration Log Table', () => this.testMigrationLog()]
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const [testName, testFunction] of tests) {
      const passed = await this.runTest(testName, testFunction);
      if (passed) passedTests++;
    }

    // Generate report
    this.generateReport(passedTests, totalTests);
    
    return passedTests === totalTests;
  }
}

// Export for use in other files
export { DatabaseMigrationVerifier };

// Run verification if this script is executed directly
if (typeof window === 'undefined' && require.main === module) {
  const verifier = new DatabaseMigrationVerifier();
  verifier.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      process.exit(1);
    });
}
