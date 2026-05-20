// Import the shared supabase client to avoid multiple instances
import { supabaseClient } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseData = {
  async getTimeEntries(userId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const { data, error } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        if (error.code === '401' || error.status === 401) {
          throw new Error('Unauthorized - session expired');
        }
        throw error;
      }
      return data || [];
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async saveTimeEntry(userId, entry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const body = {
        user_id: userId,
        date: entry.date,
        intervals: entry.intervals,
        type: entry.type || 'Regular',
        duration: entry.duration,
        double_hours: entry.doubleHours,
        notes: entry.notes,
        hours_worked: entry.hoursWorked,
        extra_hours: entry.extraHours,
        extra_hours_with_factor: entry.extraHoursWithFactor,
        hours_spent_outside: entry.hoursSpentOutside,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseClient
        .from('time_entries')
        .upsert(body, {
          onConflict: 'user_id,date',
          ignoreDuplicates: false
        })
        .select()
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        console.error('[Save] Error:', error);
        if (error.code === '401' || error.status === 401 || error.code === '403') {
          return null;
        }
        throw error;
      }

      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[Save] Error:', error);

      if (error.name === 'AbortError' || error.message?.includes('timed out')) {
        return null;
      }
      throw error;
    }
  },

  async deleteTimeEntry({ id, userId, date }) {
    if (!id) {
      console.warn('[Delete] Entry id missing locally, resolving from server for date:', date);
      return { success: false, deletedFrom: 'none', reason: 'missing_id' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const { error } = await supabaseClient
        .from('time_entries')
        .delete()
        .eq('id', id)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        console.error('[Delete] Error:', error);
        if (error.code === '404' || error.code === 'PGRST116') {
          return { success: true, deletedFrom: 'supabase' };
        }
        if (error.code === '401' || error.status === 401) {
          return { success: false, deletedFrom: 'none', reason: 'unauthorized' };
        }
        return { success: false, deletedFrom: 'none', reason: 'http_error' };
      }

      return { success: true, deletedFrom: 'supabase' };

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[Delete] Error:', error);

      if (error.name === 'AbortError') {
        return { success: false, deletedFrom: 'none', reason: 'timeout_or_permission' };
      }

      return { success: false, deletedFrom: 'none', reason: 'fetch_error' };
    }
  },

  async getUserProfile(userId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .abortSignal(controller.signal);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '406' || error.code === '404') {
          return null;
        }
        if (error.code === '401' || error.status === 401) {
          throw new Error('Unauthorized - session expired');
        }
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async saveUserProfile(userId, profileData) {
    try {
      let username = profileData.username;
      let email = profileData.email;

      if (!username || !email) {
        try {
          const { data: existingProfile } = await supabaseClient
            .from('profiles')
            .select('username, email')
            .eq('id', userId)
            .single();

          username = username || existingProfile?.username || userId;
          email = email || existingProfile?.email || `${userId}@example.com`;
        } catch (e) {
          username = username || userId;
          email = email || `${userId}@example.com`;
        }
      }

      const { data, error } = await supabaseClient
        .from('profiles')
        .upsert({
          id: userId,
          username,
          email,
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving user profile:', error);
      if (error.code === 'PGRST205' || error.code === '23502' || error.code === '23514') {
        return null;
      }
      throw error;
    }
  },

  async getLeaveSettings(userId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const { data, error } = await supabaseClient
        .from('leave_settings')
        .select('*')
        .eq('user_id', userId)
        .single()
        .abortSignal(controller.signal);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '406' || error.code === '404') {
          return null;
        }
        if (error.code === '401' || error.status === 401) {
          throw new Error('Unauthorized - session expired');
        }
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async saveLeaveSettings(userId, leaveSettings) {
    try {
      const { data, error } = await supabaseClient
        .from('leave_settings')
        .upsert({
          user_id: userId,
          ...leaveSettings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving leave settings:', error);
      if (error.code === 'PGRST205' || error.code === '23505') {
        return null;
      }
      throw error;
    }
  },

  async getPayPeriods(userId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const { data, error } = await supabaseClient
        .from('pay_periods')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false })
        .abortSignal(controller.signal);

      if (error) {
        if (error.code === '401' || error.status === 401) {
          throw new Error('Unauthorized - session expired');
        }
        throw error;
      }
      return data || [];
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async savePayPeriod(userId, period) {
    try {
      if (period.id && !period.id.startsWith('period-')) {
        const { data: updateData, error: updateError } = await supabaseClient
          .from('pay_periods')
          .update({
            label: period.label || period.name,
            start_date: period.startDate || period.start_date,
            end_date: period.endDate || period.end_date,
            is_active: period.is_active ?? false,
            is_current: period.is_current ?? false,
            updated_at: new Date().toISOString()
          })
          .eq('id', period.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }
        return updateData;
      }

      const { data: insertData, error: insertError } = await supabaseClient
        .from('pay_periods')
        .insert({
          user_id: userId,
          start_date: period.startDate || period.start_date,
          end_date: period.endDate || period.end_date,
          label: period.label || period.name,
          is_active: period.is_active ?? false,
          is_current: period.is_current ?? false,
          created_at: period.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!insertError) {
        return insertData;
      }

      if (insertError.code === '23505' || insertError.code === 'PGRST116') {
        const { data: existingData } = await supabaseClient
          .from('pay_periods')
          .select('id')
          .eq('user_id', userId)
          .eq('start_date', period.startDate || period.start_date)
          .eq('end_date', period.endDate || period.end_date)
          .single();

        if (existingData) {
          const { data: updateData, error: updateError } = await supabaseClient
            .from('pay_periods')
            .update({
              label: period.label || period.name,
              start_date: period.startDate || period.start_date,
              end_date: period.endDate || period.end_date,
              is_active: period.is_active ?? false,
              is_current: period.is_current ?? false,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingData.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return updateData;
        }
      }

      throw insertError;
    } catch (error) {
      console.error('Error saving pay period:', error);
      if (error.code === 'PGRST205' || error.code === '23502' || error.code === 'PGRST204' || error.code === '21000' || error.code === '23505') {
        return null;
      }
      throw error;
    }
  },

  async getCurrentPayPeriod(userId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const { data, error } = await supabaseClient
        .from('pay_periods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_current', true)
        .single()
        .abortSignal(controller.signal);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '406' || error.code === '404') {
          return null;
        }
        if (error.code === '401' || error.status === 401) {
          throw new Error('Unauthorized - session expired');
        }
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async setCurrentPayPeriod(userId, periodId) {
    try {
      await supabaseClient
        .from('pay_periods')
        .update({ is_current: false })
        .eq('user_id', userId)
        .eq('is_current', true);

      const { data, error } = await supabaseClient
        .from('pay_periods')
        .update({ is_current: true })
        .eq('user_id', userId)
        .eq('id', periodId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error setting current pay period:', error);
      if (error.code === 'PGRST205') {
        return null;
      }
      throw error;
    }
  }
};
