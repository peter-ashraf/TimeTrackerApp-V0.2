import { supabaseData } from './supabaseData';
import { getSimpleEncryptedItem, setSimpleEncryptedItem } from './simple-encryption';

export const dataMigration = {
  // Migrate employee type fields for existing users
  async migrateEmployeeTypeFields(userId, username) {
    try {
      
      // Get current user profile to check if migration is needed
      const profile = await supabaseData.getUserProfile(userId);
      
      // Check if employee type fields need migration
      if (!profile.employee_type || !profile.daily_hours || !profile.monthly_hours || !profile.work_days_per_week) {
        // Set default values for existing users (full-time defaults)
        await supabaseData.saveUserProfile(userId, {
          username: profile.username || username,
          full_name: profile.full_name || username,
          employee_type: 'full-time',
          daily_hours: 9,
          monthly_hours: 187,
          work_days_per_week: 5
        });
        
        return true; // Migration performed
      }
      
      return false; // No migration needed
    } catch (error) {
      
      throw error;
    }
  },

  // Migrate localStorage data to Supabase for a specific user
  async migrateUserData(userId, username) {
    try {
      
      
      const migrationResults = {
        timeEntries: { success: 0, failed: 0 },
        payPeriods: { success: 0, failed: 0 },
        leaveSettings: { success: false, failed: false },
        employeeData: { success: false, failed: false }
      };

      // Migrate time entries
      const timeEntriesKey = `timeEntries_${userId}`;
      const timeEntries = getSimpleEncryptedItem(timeEntriesKey, username) || [];
      
      for (const entry of timeEntries) {
        try {
          await supabaseData.saveTimeEntry(userId, entry);
          migrationResults.timeEntries.success++;
        } catch (error) {
          
          migrationResults.timeEntries.failed++;
        }
      }

      // Migrate pay periods
      const payPeriodsKey = `payPeriods_${userId}`;
      const payPeriods = getSimpleEncryptedItem(payPeriodsKey, username) || [];
      
      for (const period of payPeriods) {
        try {
          await supabaseData.savePayPeriod(userId, period);
          migrationResults.payPeriods.success++;
        } catch (error) {
          
          migrationResults.payPeriods.failed++;
        }
      }

      // Migrate leave settings
      const leaveSettingsKey = `leaveSettings_${userId}`;
      const leaveSettings = getSimpleEncryptedItem(leaveSettingsKey, username);
      
      if (leaveSettings) {
        try {
          await supabaseData.saveLeaveSettings(userId, leaveSettings);
          migrationResults.leaveSettings.success = true;
        } catch (error) {
          
          migrationResults.leaveSettings.failed = true;
        }
      }

      // Migrate employee data (name only - salary stays local)
      const salaryKey = `salary_${userId}`;
      const salary = getSimpleEncryptedItem(salaryKey, username);
      
      // Keep salary in localStorage only, don't migrate to database
      // Salary is sensitive data and should remain client-side
      
      if (salary !== null && salary !== undefined) {
        // Only migrate non-sensitive profile data
        try {
          await supabaseData.saveUserProfile(userId, {
            username: username,
            full_name: username
            // Salary intentionally excluded - stays in localStorage only
          });
          migrationResults.employeeData.success = true;
        } catch (error) {
          
          migrationResults.employeeData.failed = true;
        }
      }

      
      
      // Mark migration as complete
      const migrationKey = `migration_complete_${userId}`;
      setSimpleEncryptedItem(migrationKey, true, username);
      
      return migrationResults;
    } catch (error) {
      
      throw error;
    }
  },

  // Check if migration is needed for a user
  isMigrationNeeded(userId, username) {
    const migrationKey = `migration_complete_${userId}`;
    const isComplete = getSimpleEncryptedItem(migrationKey, username);
    
    // Check if there's any localStorage data to migrate
    const timeEntriesKey = `timeEntries_${userId}`;
    const payPeriodsKey = `payPeriods_${userId}`;
    const leaveSettingsKey = `leaveSettings_${userId}`;
    const salaryKey = `salary_${userId}`;
    
    const hasTimeEntries = getSimpleEncryptedItem(timeEntriesKey, username)?.length > 0;
    const hasPayPeriods = getSimpleEncryptedItem(payPeriodsKey, username)?.length > 0;
    const hasLeaveSettings = !!getSimpleEncryptedItem(leaveSettingsKey, username);
    const hasSalary = getSimpleEncryptedItem(salaryKey, username) !== null && 
                     getSimpleEncryptedItem(salaryKey, username) !== undefined;
    
    return !isComplete && (hasTimeEntries || hasPayPeriods || hasLeaveSettings || hasSalary);
  },

  // Backup Supabase data to localStorage
  async backupToLocalStorage(userId, username) {
    try {
      
      
      // Get data from Supabase
      const [timeEntries, payPeriods, leaveSettings, profile] = await Promise.all([
        supabaseData.getTimeEntries(userId),
        supabaseData.getPayPeriods(userId),
        supabaseData.getLeaveSettings(userId),
        supabaseData.getUserProfile(userId)
      ]);

      // Save to localStorage (salary stays local, not retrieved from database)
      const timeEntriesKey = `timeEntries_${userId}`;
      const payPeriodsKey = `payPeriods_${userId}`;
      const leaveSettingsKey = `leaveSettings_${userId}`;
      const salaryKey = `salary_${userId}`;
      
      setSimpleEncryptedItem(timeEntriesKey, timeEntries, username);
      setSimpleEncryptedItem(payPeriodsKey, payPeriods, username);
      setSimpleEncryptedItem(leaveSettingsKey, leaveSettings, username);
      // Salary remains in localStorage, not synced with database
      
      
      return true;
    } catch (error) {
      
      return false;
    }
  }
};
