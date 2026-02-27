import { supabaseData } from './supabaseData';
import { getSimpleEncryptedItem, setSimpleEncryptedItem } from './simple-encryption';

export const dataMigration = {
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

      // Migrate employee data (salary)
      const salaryKey = `salary_${userId}`;
      const salary = getSimpleEncryptedItem(salaryKey, username);
      
      if (salary !== null && salary !== undefined) {
        try {
          await supabaseData.saveUserProfile(userId, {
            username: username,
            full_name: username,
            salary: salary
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

      // Save to localStorage
      const timeEntriesKey = `timeEntries_${userId}`;
      const payPeriodsKey = `payPeriods_${userId}`;
      const leaveSettingsKey = `leaveSettings_${userId}`;
      const salaryKey = `salary_${userId}`;
      
      setSimpleEncryptedItem(timeEntriesKey, timeEntries, username);
      setSimpleEncryptedItem(payPeriodsKey, payPeriods, username);
      setSimpleEncryptedItem(leaveSettingsKey, leaveSettings, username);
      setSimpleEncryptedItem(salaryKey, profile.salary || 0, username);
      
      
      return true;
    } catch (error) {
      
      return false;
    }
  }
};
