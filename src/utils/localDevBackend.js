/**
 * Local dev backend — a tiny in-browser stand-in for the Supabase client.
 *
 * Active ONLY when running the Vite dev server in `localdev` mode
 * (`npm run dev:local`). See `isLocalDevMode` below and `supabaseClient.js`.
 *
 * Everything lives in localStorage under the `__localdev_*` keys, so no
 * request ever leaves the browser and real Supabase data cannot be touched
 * or mixed with test data. Reset it with `resetLocalDevData()` (also exposed
 * as `window.__resetLocalDev()` in the console).
 */

// import.meta.env.DEV is statically false in production builds, so bundlers
// drop this module's usage from `supabaseClient.js` entirely.
export const isLocalDevMode =
  import.meta.env.DEV && import.meta.env.MODE === 'localdev';

export const LOCAL_DEV_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'devuser',
  email: 'devuser@local.test',
  password: 'devpass123',
  fullName: 'Local Dev User',
};

const DB_KEY = '__localdev_db__';
const SESSION_KEY = '__localdev_session__';
const PASSWORD_KEY = '__localdev_password__';

const UNIQUE_KEYS = {
  profiles: [['username']],
  time_entries: [['user_id', 'date']],
  leave_settings: [['user_id']],
  reminder_preferences: [['user_id']],
  reminder_logs: [['user_id', 'date']],
};

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const makeError = (message, code) => ({ message, code, details: null, hint: null });

// ---------------------------------------------------------------- seed + db

const buildSeed = () => {
  const now = new Date();
  const nowIso = now.toISOString();
  const uid = LOCAL_DEV_USER.id;

  // Pay period: 25th of last month -> 24th of this month (or this -> next)
  const startMonth = now.getDate() >= 25 ? now.getMonth() : now.getMonth() - 1;
  const start = new Date(now.getFullYear(), startMonth, 25);
  const end = new Date(now.getFullYear(), startMonth + 1, 24);

  // A few past weekdays of sample entries inside the pay period
  const entries = [];
  for (let back = 1; back <= 10; back += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const dow = d.getDay();
    if (dow === 0 || dow === 6 || d < start) continue; // Sat/Sun weekend, matching Timesheet.jsx
    entries.push({
      id: uuid(),
      user_id: uid,
      date: isoDate(d),
      type: 'Regular',
      // App model: first interval = whole working day, later intervals = breaks.
      // Every other day also has a short break outside the paid window (13:00-13:30).
      intervals: [
        { in: '08:30:00', out: back % 3 === 0 ? '18:30:00' : '17:30:00' },
        { in: '13:00:00', out: '13:30:00' },
        ...(back % 2 === 0 ? [{ in: '15:30:00', out: '15:50:00' }] : []),
      ],
      duration: null,
      double_hours: false,
      notes: '',
      hours_worked: null,
      extra_hours: null,
      extra_hours_with_factor: null,
      hours_spent_outside: null,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  return {
    profiles: [
      {
        id: uid,
        username: LOCAL_DEV_USER.username,
        email: LOCAL_DEV_USER.email,
        full_name: LOCAL_DEV_USER.fullName,
        employee_type: 'Full-Time',
        daily_hours: 8,
        monthly_hours: 187,
        work_days_per_week: 5,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ],
    time_entries: entries,
    pay_periods: [
      {
        id: uuid(),
        user_id: uid,
        label: 'Local Dev Period',
        start_date: isoDate(start),
        end_date: isoDate(end),
        is_active: true,
        is_current: true,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ],
    leave_settings: [
      {
        id: uuid(),
        user_id: uid,
        annual_vacation: 20,
        sick_days: 10,
        personal_days: 2,
        used_vacation_days: 0,
        used_sick_days: 0,
        used_personal_days: 0,
        updated_at: nowIso,
      },
    ],
    reminder_preferences: [],
    reminder_logs: [],
    push_subscriptions: [],
    migration_log: [],
  };
};

const loadDb = () => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to a fresh seed
  }
  const seed = buildSeed();
  saveDb(seed);
  return seed;
};

function saveDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('[LocalDev] Could not persist local dev database:', e);
  }
}

export const resetLocalDevData = () => {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PASSWORD_KEY);
  console.info('[LocalDev] Local dev data reset. Reload the page to re-seed.');
};

// -------------------------------------------------------------- query builder

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

class LocalQuery {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.payload = null;
    this.upsertOptions = {};
    this.filters = [];
    this.orders = [];
    this.limitCount = null;
    this.singleMode = null; // 'single' | 'maybeSingle'
    this.returning = true; // select() is the default op
  }

  select() {
    // After a mutation, select() just asks for the affected rows back.
    this.returning = true;
    return this;
  }
  insert(payload) { this.op = 'insert'; this.payload = payload; this.returning = false; return this; }
  update(payload) { this.op = 'update'; this.payload = payload; this.returning = false; return this; }
  upsert(payload, options = {}) { this.op = 'upsert'; this.payload = payload; this.upsertOptions = options; this.returning = false; return this; }
  delete() { this.op = 'delete'; this.returning = false; return this; }

  eq(col, val) { this.filters.push((r) => r[col] === val); return this; }
  neq(col, val) { this.filters.push((r) => r[col] !== val); return this; }
  gt(col, val) { this.filters.push((r) => r[col] > val); return this; }
  gte(col, val) { this.filters.push((r) => r[col] >= val); return this; }
  lt(col, val) { this.filters.push((r) => r[col] < val); return this; }
  lte(col, val) { this.filters.push((r) => r[col] <= val); return this; }
  in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this; }
  is(col, val) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  match(obj) {
    Object.entries(obj).forEach(([k, v]) => this.filters.push((r) => r[k] === v));
    return this;
  }
  order(col, { ascending = true } = {}) { this.orders.push({ col, ascending }); return this; }
  limit(n) { this.limitCount = n; return this; }
  abortSignal() { return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }

  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this.execute())
      .then(resolve, reject);
  }

  matches(row) {
    return this.filters.every((f) => f(row));
  }

  finish(rows) {
    let out = rows;
    if (this.orders.length) {
      out = [...out].sort((a, b) => {
        for (const { col, ascending } of this.orders) {
          const c = compare(a[col], b[col]);
          if (c !== 0) return ascending ? c : -c;
        }
        return 0;
      });
    }
    if (this.limitCount != null) out = out.slice(0, this.limitCount);
    out = clone(out);

    if (this.singleMode === 'single') {
      if (out.length !== 1) {
        return { data: null, error: makeError('JSON object requested, multiple (or no) rows returned', 'PGRST116') };
      }
      return { data: out[0], error: null };
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, error: null };
  }

  findConflict(rows, candidate, keyGroups) {
    return rows.find((row) =>
      keyGroups.some((cols) => cols.every((c) => row[c] != null && row[c] === candidate[c])),
    );
  }

  execute() {
    const db = loadDb();
    const rows = db[this.table] || (db[this.table] = []);
    const uniques = UNIQUE_KEYS[this.table] || [];
    const nowIso = new Date().toISOString();

    if (this.op === 'select') {
      return this.finish(rows.filter((r) => this.matches(r)));
    }

    if (this.op === 'delete') {
      const kept = rows.filter((r) => !this.matches(r));
      const removed = rows.filter((r) => this.matches(r));
      db[this.table] = kept;
      saveDb(db);
      return this.returning ? this.finish(removed) : { data: null, error: null };
    }

    if (this.op === 'update') {
      const touched = [];
      rows.forEach((row) => {
        if (this.matches(row)) {
          Object.assign(row, clone(this.payload));
          if (!this.payload.updated_at) row.updated_at = nowIso;
          touched.push(row);
        }
      });
      saveDb(db);
      return this.returning ? this.finish(touched) : { data: null, error: null };
    }

    // insert / upsert
    const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
    const result = [];
    for (const item of incoming) {
      const candidate = clone(item);
      let keyGroups = uniques;
      if (this.op === 'upsert' && this.upsertOptions.onConflict) {
        keyGroups = [this.upsertOptions.onConflict.split(',').map((c) => c.trim())];
      }
      const existing = this.findConflict(rows, candidate, keyGroups);

      if (existing && this.op === 'insert') {
        return { data: null, error: makeError('duplicate key value violates unique constraint', '23505') };
      }
      if (existing) {
        Object.assign(existing, candidate);
        result.push(existing);
      } else {
        const row = { id: uuid(), created_at: nowIso, updated_at: nowIso, ...candidate };
        rows.push(row);
        result.push(row);
      }
    }
    saveDb(db);
    return this.returning ? this.finish(result) : { data: null, error: null };
  }
}

// ------------------------------------------------------------------- auth

export const createLocalDevClient = () => {
  const listeners = new Set();

  const getPassword = () => localStorage.getItem(PASSWORD_KEY) || LOCAL_DEV_USER.password;

  const buildUser = (profile) => ({
    id: profile.id,
    email: profile.email,
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: { username: profile.username, full_name: profile.full_name },
    app_metadata: { provider: 'localdev' },
  });

  const buildSession = (user) => ({
    access_token: 'localdev-access-token',
    refresh_token: 'localdev-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  });

  const readSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const emit = (event, session) => {
    // Real Supabase calls listeners asynchronously; mimic that.
    setTimeout(() => listeners.forEach((cb) => cb(event, session)), 0);
  };

  const auth = {
    async signInWithPassword({ email, password }) {
      const profile = loadDb().profiles.find((p) => p.email === email);
      if (!profile || password !== getPassword()) {
        return {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' },
        };
      }
      const user = buildUser(profile);
      const session = buildSession(user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      emit('SIGNED_IN', session);
      return { data: { user, session }, error: null };
    },

    async getSession() {
      return { data: { session: readSession() }, error: null };
    },
    async getUser() {
      const session = readSession();
      return { data: { user: session?.user ?? null }, error: null };
    },
    async getSessions() {
      const session = readSession();
      return { data: { sessions: session ? [session] : [] }, error: null };
    },
    async refreshSession() {
      const session = readSession();
      return { data: { session, user: session?.user ?? null }, error: null };
    },
    async setSession() {
      const session = readSession();
      return { data: { session, user: session?.user ?? null }, error: null };
    },

    onAuthStateChange(callback) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },

    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      emit('SIGNED_OUT', null);
      return { error: null };
    },

    async signUp() {
      return {
        data: { user: null, session: null },
        error: { message: 'Sign-up is disabled in local dev mode. Use the seeded dev user.', status: 400 },
      };
    },

    async updateUser({ password } = {}) {
      if (password) localStorage.setItem(PASSWORD_KEY, password);
      const session = readSession();
      return { data: { user: session?.user ?? null }, error: null };
    },

    async resetPasswordForEmail() {
      console.info('[LocalDev] Password reset emails are not sent in local dev mode.');
      return { data: {}, error: null };
    },
  };

  const rpc = async (fn, args = {}) => {
    if (fn === 'check_username_availability') {
      const taken = loadDb().profiles.some((p) => p.username === args.username_to_check);
      return { data: !taken, error: null };
    }
    if (fn === 'get_login_email') {
      const profile = loadDb().profiles.find((p) => p.username === args.username_in);
      return { data: profile?.email ?? null, error: null };
    }
    return { data: null, error: makeError(`RPC "${fn}" is not available in local dev mode`, 'PGRST202') };
  };

  const makeChannel = () => {
    const channel = {
      on: () => channel,
      subscribe: (cb) => {
        cb?.('SUBSCRIBED');
        return channel;
      },
      unsubscribe: async () => 'ok',
    };
    return channel;
  };

  return {
    auth,
    rpc,
    from: (table) => new LocalQuery(table),
    channel: makeChannel,
    removeChannel: async () => 'ok',
    functions: {
      invoke: async (name) => ({
        data: null,
        error: { message: `Edge function "${name}" is not available in local dev mode` },
      }),
    },
  };
};

/**
 * Hard safety net: in local dev mode, refuse any request that looks like it is
 * aimed at Supabase (the app has a few raw `fetch` calls besides the client).
 */
export const installLocalDevFetchGuard = () => {
  const realFetch = window.fetch.bind(window);
  const realHost = (() => {
    try {
      return new URL(import.meta.env.VITE_SUPABASE_URL).host;
    } catch {
      return null;
    }
  })();

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const hitsSupabase =
      (realHost && url.includes(realHost)) ||
      url.includes('.supabase.co') ||
      /\/(rest|auth|realtime|functions)\/v1\//.test(url);
    if (hitsSupabase) {
      console.warn('[LocalDev] Blocked network request to Supabase:', url);
      return Promise.reject(new TypeError('Failed to fetch (blocked: local dev mode)'));
    }
    return realFetch(input, init);
  };
};

if (isLocalDevMode) {
  window.__resetLocalDev = resetLocalDevData;
}
