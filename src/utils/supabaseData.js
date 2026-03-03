import { createClient } from '@supabase/supabase-js';
import { supabase } from '../context/SupabaseAuthContext';

// Create supabase client with cache busting
const CACHE_BUST = Date.now(); // Force browser to reload updated code



// Time Entries operations
export const supabaseData = {
  // Time Entries
  async getTimeEntries(userId, payPeriodId = null, usePagination = false, page = 1, pageSize = 50) {
    try {
      // Use optimized pagination for large datasets
      if (usePagination) {
        // For now, disable pagination and return all entries
        // TODO: Implement pagination logic directly here
        let query = supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', userId);

        // Filter by pay period if specified
        if (payPeriodId) {
          query = query.eq('pay_period_id', payPeriodId);
        }

        const { data, error } = await query.order('date', { ascending: false });

        if (error) throw error;

        // Convert snake_case from database to camelCase for frontend
        return {
          entries: (data || []).map(entry => ({
            id: entry.id,
            date: entry.date,
            intervals: entry.intervals,
            type: entry.type,
            duration: entry.duration,
            doubleHours: entry.double_hours,
            notes: entry.notes,
            hoursWorked: entry.hours_worked,
            extraHours: entry.extra_hours,
            extraHoursWithFactor: entry.extra_hours_with_factor,
            hoursSpentOutside: entry.hours_spent_outside,
            user_id: entry.user_id,
            created_at: entry.created_at,
            updated_at: entry.updated_at
          })),
          totalCount: data?.length || 0,
          currentPage: 1,
          totalPages: 1
        };
      }

      // Original method for backward compatibility
      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId);

      // Filter by pay period if specified
      if (payPeriodId) {
        query = query.eq('pay_period_id', payPeriodId);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      // Convert snake_case from database to camelCase for frontend
      return (data || []).map(entry => ({
        id: entry.id,
        date: entry.date,
        intervals: entry.intervals,
        type: entry.type,
        duration: entry.duration,
        doubleHours: entry.double_hours,
        notes: entry.notes,
        hoursWorked: entry.hours_worked,
        extraHours: entry.extra_hours,
        extraHoursWithFactor: entry.extra_hours_with_factor,
        hoursSpentOutside: entry.hours_spent_outside,
        user_id: entry.user_id,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      }));
    } catch (error) {

      return usePagination ? { entries: [], totalCount: 0, currentPage: 1, totalPages: 0 } : [];
    }
  },

  async saveTimeEntry(userId, entry) {
    try {
      // Calculate missing fields if not provided
      const calculateHoursWorked = (intervals, date) => {
        if (!intervals || intervals.length === 0) return 0;

        let totalSeconds = 0;
        intervals.forEach(interval => {
          if (interval.in && interval.out) {
            const inSeconds = timeToSeconds(interval.in);
            const outSeconds = timeToSeconds(interval.out);
            totalSeconds += Math.max(0, outSeconds - inSeconds);
          }
        });

        // Subtract break time (excluding first interval which is work)
        if (intervals.length > 1) {
          const breakIntervals = intervals.slice(1);
          breakIntervals.forEach(breakInterval => {
            if (breakInterval.in && breakInterval.out) {
              const breakInSeconds = timeToSeconds(breakInterval.in);
              const breakOutSeconds = timeToSeconds(breakInterval.out);
              totalSeconds -= Math.max(0, breakOutSeconds - breakInSeconds);
            }
          });
        }

        return secondsToHours(totalSeconds);
      };

      const calculateHoursSpentOutside = (intervals) => {
        if (!intervals || intervals.length <= 1) return 0;

        const breakIntervals = intervals.slice(1);
        const ALLOWED_START = 13 * 3600; // 13:00
        const ALLOWED_END = 13 * 3600 + 30 * 60; // 13:30

        let hoursSpentOutside = 0;
        breakIntervals.forEach(interval => {
          if (interval.in && interval.out) {
            const breakStartSeconds = timeToSeconds(interval.in);
            const breakEndSeconds = timeToSeconds(interval.out);
            const breakDuration = breakEndSeconds - breakStartSeconds;

            const isAllowedBreak = breakStartSeconds >= ALLOWED_START &&
              breakEndSeconds <= ALLOWED_END;

            if (!isAllowedBreak) {
              hoursSpentOutside += secondsToHours(breakDuration);
            }
          }
        });

        return hoursSpentOutside;
      };

      const timeToSeconds = (timeStr) => {
        if (!timeStr || timeStr.trim() === '') return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          return parts[0] * 3600 + parts[1] * 60;
        }
        return 0;
      };

      const secondsToHours = (seconds) => seconds / 3600;

      // Calculate fields if not already calculated
      const hoursWorked = entry.hoursWorked || calculateHoursWorked(entry.intervals, entry.date);
      const hoursSpentOutside = entry.hoursSpentOutside || calculateHoursSpentOutside(entry.intervals);

      // Calculate extra hours
      const dayOfWeek = new Date(entry.date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isSpecialDay = entry.type === 'Holiday' || entry.type === 'Vacation';
      const useDoubleFactor = isWeekend || isSpecialDay;

      const isHalfDaySpecial = (entry.duration === 0.5) &&
        (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');

      const isFullDaySpecial = (entry.duration === 1) &&
        (entry.type === 'Vacation' || entry.type === 'Sick Leave' || entry.type === 'To Be Added');

      let extraHours = 0;
      let extraHoursWithFactor = 0;

      if (isFullDaySpecial) {
        extraHours = 0;
        extraHoursWithFactor = 0;
      } else if (isHalfDaySpecial) {
        const halfDayBaseline = 4.5;
        extraHours = hoursWorked - halfDayBaseline;
        extraHoursWithFactor = extraHours > 0 ? extraHours * 1.5 : extraHours;
      } else if (entry.doubleHours) {
        extraHours = hoursWorked;
        extraHoursWithFactor = hoursWorked * 2;
      } else if (useDoubleFactor && entry.type !== 'Regular') {
        extraHours = hoursWorked;
        extraHoursWithFactor = hoursWorked * 2;
      } else {
        const standardHours = isWeekend ? 0 : 9;
        extraHours = hoursWorked - standardHours;
        const factor = useDoubleFactor ? 2 : 1.5;
        extraHoursWithFactor = extraHours > 0 ? extraHours * factor : extraHours;
      }

      // Convert camelCase to snake_case for database
      const dbData = {
        user_id: userId,
        date: entry.date,
        intervals: entry.intervals,
        type: entry.type,
        duration: entry.duration,
        double_hours: entry.doubleHours,
        notes: entry.notes,
        hours_worked: hoursWorked,
        extra_hours: extraHours,
        extra_hours_with_factor: extraHoursWithFactor,
        hours_spent_outside: hoursSpentOutside,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('time_entries')
        .upsert(dbData, {
          onConflict: 'user_id, date'
        });

      if (error) {
        // Retry once if it's a Navigator Lock Manager timeout
        if (error.message && error.message.includes('Navigator Lock Manager')) {

          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

          const retryData = await supabase
            .from('time_entries')
            .upsert(dbData, {
              onConflict: 'user_id, date'
            });

          if (retryData.error) throw retryData.error;
          return retryData.data;
        }
        throw error;
      }
      return data;
    } catch (error) {

      throw error;
    }
  },

  async deleteTimeEntry(userId, date) {
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);

      if (error) throw error;
      return true;
    } catch (error) {

      throw error;
    }
  },

  // Leave Settings
  async getLeaveSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('leave_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no settings exist, return defaults
        if (error.code === 'PGRST116') {
          return {
            annualVacation: 10,
            sickDays: 7,
            personalDays: 2,
            usedVacationDays: 0,
            usedSickDays: 0,
            usedPersonalDays: 0
          };
        }
        throw error;
      }

      // Convert snake_case from database to camelCase for frontend
      return {
        annualVacation: data.annual_vacation || data.annualVacation || 10,
        sickDays: data.sick_days || data.sickDays || 7,
        personalDays: data.personal_days || data.personalDays || 2,
        usedVacationDays: data.used_vacation_days || data.usedVacationDays || 0,
        usedSickDays: data.used_sick_days || data.usedSickDays || 0,
        usedPersonalDays: data.used_personal_days || data.usedPersonalDays || 0
      };
    } catch (error) {

      return {
        annualVacation: 10,
        sickDays: 7,
        personalDays: 2,
        usedVacationDays: 0,
        usedSickDays: 0,
        usedPersonalDays: 0
      };
    }
  },

  async saveLeaveSettings(userId, settings) {
    try {
      // Convert camelCase to snake_case for database
      const dbData = {
        annual_vacation: settings.annualVacation,
        sick_days: settings.sickDays,
        personal_days: settings.personalDays,
        used_vacation_days: settings.usedVacationDays,
        used_sick_days: settings.usedSickDays,
        used_personal_days: settings.usedPersonalDays,
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('leave_settings')
        .upsert(dbData, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return data;
    } catch (error) {

      throw error;
    }
  },

  // User Profile (for salary and other profile data)
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username, employee_type, daily_hours, monthly_hours, work_days_per_week')
        .eq('id', userId)
        .single();

      if (error) {

        return {
          full_name: '',
          username: '',
          employee_type: 'full-time',
          daily_hours: 9,
          monthly_hours: 187,
          work_days_per_week: 5
        };
      }
      return data;
    } catch (error) {

      return {
        full_name: '',
        username: '',
        employee_type: 'full-time',
        daily_hours: 9,
        monthly_hours: 187,
        work_days_per_week: 5
      };
    }
  },

  async saveUserProfile(userId, profile) {
    try {
      // Remove salary and username from profile data
      // salary: never syncs to cloud
      // username: must NEVER be changed by display name updates (only via dedicated username change flow)
      const { salary, username, ...safeProfile } = profile;

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...safeProfile,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {

      throw error;
    }
  },

  // Pay Periods (now user-specific)
  async getPayPeriods(userId) {
    try {
      const { data, error } = await supabase
        .from('pay_periods')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {

      return [];
    }
  },

  async getCurrentPayPeriod(userId) {
    try {
      const { data, error } = await supabase
        .from('pay_periods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_current', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No current period found, return null
          return null;
        }
        throw error;
      }
      return data;
    } catch (error) {

      return null;
    }
  },

  async setCurrentPayPeriod(userId, periodId) {
    try {


      // First, unset all current periods for this user
      const { error: unsetError } = await supabase
        .from('pay_periods')
        .update({ is_current: false })
        .eq('user_id', userId)
        .eq('is_current', true);

      if (unsetError) {

        throw unsetError;
      }



      // Then set the new current period
      const { data, error } = await supabase
        .from('pay_periods')
        .update({ is_current: true })
        .eq('user_id', userId)
        .eq('id', periodId)
        .select()
        .single();

      if (error) {

        throw error;
      }


      return data;
    } catch (error) {

      throw error;
    }
  },

  async autoSetCurrentPayPeriod(userId) {
    try {
      // Call the database function to auto-set current period if none exists
      const { data, error } = await supabase
        .rpc('auto_set_current_pay_period', { p_user_id: userId });

      if (error) throw error;
      return data;
    } catch (error) {

      throw error;
    }
  },

  async savePayPeriod(userId, period) {
    try {
      const dbData = {
        user_id: userId,
        label: period.label,
        start_date: period.start_date || period.startDate,
        end_date: period.end_date || period.endDate,
        is_active: period.is_active ?? false,
        // ← Only include is_current if explicitly set, don't default to false
        ...(period.is_current !== undefined && { is_current: period.is_current }),
        created_at: period.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const isValidUUID = (str) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (period.id && isValidUUID(period.id)) {
        dbData.id = period.id;
      }

      const { data, error } = await supabase
        .from('pay_periods')
        .upsert(dbData, {
          onConflict: 'user_id, start_date, end_date'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {

      throw error;
    }
  },

  async deletePayPeriod(userId, periodId) {
    try {
      const { error } = await supabase
        .from('pay_periods')
        .delete()
        .eq('user_id', userId)
        .eq('id', periodId);

      if (error) throw error;
      return true;
    } catch (error) {

      throw error;
    }
  },

  // Optimized dashboard stats
  async getDashboardStats(userId) {
    try {
      // Basic dashboard stats implementation
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculate basic stats
      const totalEntries = entries?.length || 0;
      const totalHours = entries?.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0) || 0;

      return {
        overall: {
          totalEntries,
          totalHours,
          averageHours: totalEntries > 0 ? totalHours / totalEntries : 0
        },
        currentMonth: {
          totalEntries,
          totalHours,
          averageHours: totalEntries > 0 ? totalHours / totalEntries : 0
        }
      };
    } catch (error) {

      return { overall: {}, currentMonth: {} };
    }
  }
};
