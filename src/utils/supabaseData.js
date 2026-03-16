// Import the shared supabase client to avoid multiple instances
import { supabaseClient } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseData = {
  async getTimeEntries(userId) {
    let token = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.access_token) { token = parsed.access_token; break; }
        }
      }
    } catch (e) {}
    if (!token) throw new Error('No auth token available');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/time_entries?user_id=eq.${userId}&order=date.desc`,
        {
          signal: controller.signal,
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() || [];
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async saveTimeEntry(userId, entry) {
    let token = null;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
        }
      }
    } catch (e) {
      console.error('[Save] Failed to read auth token from localStorage:', e);
    }

    if (!token) {
      console.error('[Save] No auth token available');
      return null;
    }

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

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/time_entries?on_conflict=user_id,date`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Save] Request failed:', response.status, errorText);
        if (response.status === 401 || response.status === 403) {
          return null;
        }
        throw new Error(`Save failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data;

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[Save] Error:', error);

      if (
        error.name === 'AbortError' ||
        error.message?.includes('timed out') ||
        error.message?.includes('Save failed: 5')
      ) {
        return null;
      }
      throw error;
    }
  },

  async deleteTimeEntry({ id, userId, date }) {
    let token = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
        }
      }
    } catch (e) {
      console.error('[Delete] Failed to read auth token from localStorage:', e);
    }

    if (!token) {
      console.error('[Delete] No auth token available');
      return { success: false, deletedFrom: 'none', reason: 'no_auth_token' };
    }

    if (!id) {
      console.warn('[Delete] Entry id missing locally, resolving from server for date:', date);
      return { success: false, deletedFrom: 'none', reason: 'missing_id' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/time_entries?id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok || response.status === 204) {
        return { success: true, deletedFrom: 'supabase' };
      }

      if (response.status === 404) {
        return { success: true, deletedFrom: 'supabase' };
      }

      const errorText = await response.text();
      console.error('[Delete] Request failed:', response.status, errorText);
      return { success: false, deletedFrom: 'none', reason: 'http_error' };

    } catch (error) {
      console.error('[Delete] Error:', error);

      if (error.name === 'AbortError') {
        return { success: false, deletedFrom: 'none', reason: 'timeout_or_permission' };
      }

      return { success: false, deletedFrom: 'none', reason: 'fetch_error' };
    }
  },

  async getUserProfile(userId) {
    let token = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.access_token) { token = parsed.access_token; break; }
        }
      }
    } catch (e) {}
    if (!token) throw new Error('No auth token available');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&limit=1`,
        {
          signal: controller.signal,
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pgrst.object+json'
          }
        }
      );
      if (response.status === 406 || response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
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
    let token = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.access_token) { token = parsed.access_token; break; }
        }
      }
    } catch (e) {}
    if (!token) throw new Error('No auth token available');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/leave_settings?user_id=eq.${userId}&limit=1`,
        {
          signal: controller.signal,
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pgrst.object+json'
          }
        }
      );
      if (response.status === 406 || response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
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
    let token = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.access_token) { token = parsed.access_token; break; }
        }
      }
    } catch (e) {}
    if (!token) throw new Error('No auth token available');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/pay_periods?user_id=eq.${userId}&order=start_date.desc`,
        {
          signal: controller.signal,
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() || [];
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
    let token = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.access_token) { token = parsed.access_token; break; }
        }
      }
    } catch (e) {}
    if (!token) throw new Error('No auth token available');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/pay_periods?user_id=eq.${userId}&is_current=eq.true&limit=1`,
        {
          signal: controller.signal,
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pgrst.object+json'
          }
        }
      );
      if (response.status === 406 || response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data?.id || null;
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
