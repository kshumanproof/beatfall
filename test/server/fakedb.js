/* A stand-in for the Supabase client, faithful to the shapes the code uses:
   the chained builder, {data, error} rather than throwing, maybeSingle()
   returning {data:null,error:null} when nothing matched. It holds one profiles
   row and a usage table so the credit paths can actually be run. */
export function makeDb(profile, opts = {}) {
  const state = { profile: {...profile}, usage: [...(opts.usage || [])], events: [], writes: 0 };
  // Any other table the test wants to seed: projects, and so on.
  Object.keys(opts).forEach(k => { if (Array.isArray(opts[k]) && !(k in state)) state[k] = [...opts[k]]; });

  function table(name) {
    const q = { _name: name, _filters: [], _patch: null, _op: 'select', _count: false };
    const match = row => q._filters.every(([col, op, val, negate]) => {
      const v = row[col];
      if (negate) return !one(v, op, val);
      return one(v, op, val);
    });
    const one = (v, op, val) => {
      if (op === 'eq')  return v === val;
      if (op === 'gt')  return v > val;
      if (op === 'gte') return v >= val;
      if (op === 'lt')  return v < val;
      // `is` only ever asks about null in this codebase, and undefined is the
      // same absence as far as a stand-in row is concerned.
      if (op === 'is')  return val === null ? (v === null || v === undefined) : v === val;
      if (op === 'in')  return Array.isArray(val) && val.includes(v);
      return true;
    };
    // A test that seeds a whole profiles table wants that table; everything
    // else is the single-account case and gets the one row.
    const rows = () => (name === 'profiles'
      ? (Array.isArray(state.profiles) ? state.profiles : [state.profile])
      : state[name] || []).filter(match);

    const api = {
      select(_c, o) { if (o && o.count) q._count = true; return api; },
      eq(c, v)  { q._filters.push([c, 'eq', v]);  return api; },
      gt(c, v)  { q._filters.push([c, 'gt', v]);  return api; },
      gte(c, v) { q._filters.push([c, 'gte', v]); return api; },
      lt(c, v)  { q._filters.push([c, 'lt', v]);  return api; },
      or()      { return api; },
      order()   { return api; },
      limit()   { return api; },
      is(c, v)  { q._filters.push([c, 'is', v]);  return api; },
      in(c, v)  { q._filters.push([c, 'in', v]);   return api; },
      /* PostgREST's not(), which the cleanup job uses to find accounts that are
         NOT live and whose period end is NOT null. The list form arrives as the
         literal string "(active,trialing,past_due)", the way the query string
         carries it, so it is unwrapped here rather than at the call site. */
      not(c, op, v) {
        const val = op === 'in' && typeof v === 'string'
          ? String(v).replace(/^\(|\)$/g, '').split(',') : v;
        q._filters.push([c, op, val, true]);
        return api;
      },
      delete()  { q._op = 'delete'; return api; },
      update(p) { q._op = 'update'; q._patch = p; return api; },
      insert(r) { q._op = 'insert'; q._patch = r; return api; },
      upsert(r) { q._op = 'upsert'; q._patch = r; return api; },
      /* `single()` has to run the operation, not just read the table.
         It used to return rows() directly, which meant any write ending in
         .single() did NOTHING here and answered with the row as it was before.
         Two shipped calls end that way, `api/session.js` claiming a browser and
         `api/projects.js` creating a project, so both were invisible to this
         suite: the write never happened and the test read the old value back
         and believed it. PostgREST errors when .single() matches no row, so
         that part is kept. */
      async single() {
        const r = await finish(true);
        if (r.error) return r;
        const row = Array.isArray(r.data) ? (r.data[0] ?? null) : (r.data ?? null);
        return row ? { data: row, error: null }
                   : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
      },
      async maybeSingle() { return finish(true); },
      then(res, rej) { return finish(false).then(res, rej); }
    };

    async function finish(single) {
      if (opts.failEvery && ++state.writes % opts.failEvery === 0)
        return { data: null, error: { message: 'connection reset' } };

      /* Upsert by primary key. The real table keys captures on the phone's own
         id and work_days on (user_id, day); both are the "send it twice and
         nothing doubles" promise, so the stand-in has to keep it too. */
      if (q._op === 'upsert') {
        state[name] = state[name] || [];
        const list = Array.isArray(q._patch) ? q._patch : [q._patch];
        const keyOf = row => name === 'work_days'
          ? String(row.user_id) + '|' + String(row.day) : String(row.id);
        list.forEach(row => {
          const i = state[name].findIndex(r => keyOf(r) === keyOf(row));
          if (i >= 0) state[name][i] = { ...state[name][i], ...row };
          else state[name].push({ created_at: new Date().toISOString(), ...row });
        });
        return { data: list, error: null };
      }

      /* Everything except profiles is a real table with real rows in it. The
         update branch used to write q._patch onto state.profile whatever table
         it had been called on, which is fine while profiles is the only table
         anything updates and silently wrong the moment one is not. */
      if (q._op === 'update' && name !== 'profiles') {
        const hit = rows();
        hit.forEach(r => Object.assign(r, q._patch));
        return { data: hit.map(r => ({ ...r })), error: null };
      }

      if (q._op === 'update') {
        const hit = rows();
        if (!hit.length) return { data: null, error: null };   // condition did not match
        // somebody else can move the row between the read and the write
        if (opts.raceOnce && !state.raced) { state.raced = true; 
          state.profile.credits_used = (state.profile.credits_used || 0) + 1;
          return { data: null, error: null };
        }
        Object.assign(state.profile, q._patch);
        return single ? { data: {...state.profile}, error: null }
                      : { data: [{...state.profile}], error: null };
      }
      if (q._op === 'insert') {
        if (name === 'events' && opts.duplicateEvent) return { data: null, error: {code: '23505', message: 'duplicate key'} };
        state[name] = state[name] || [];
        // The real table defaults created_at; without it every time filter misses.
        state[name].push({ created_at: new Date().toISOString(), ...q._patch });
        return { data: [q._patch], error: null };
      }
      /* A real delete, because Vision's whole promise rests on one: a file
         with no row is unfindable forever, so the suite has to be able to see
         that the rows really went. */
      if (q._op === 'delete') {
        const doomed = rows();
        state[name] = (state[name] || []).filter(r => !doomed.includes(r));
        return { data: doomed, error: null };
      }
      const r = rows();
      if (q._count) return { data: null, count: r.length, error: null };
      return single ? { data: r[0] || null, error: null } : { data: r, error: null };
    }
    return api;
  }

  /* The admin side of Supabase, which is one call: removing the auth user.
     Recorded rather than performed, so a suite can tell "the endpoint asked
     for the account to be deleted" apart from "the endpoint fell over before
     it got there", and can make the delete fail on purpose. */
  const auth = {
    admin: {
      deleteUser: async (id) => {
        state.deletedUsers = state.deletedUsers || [];
        state.deletedUsers.push(id);
        return state.deleteFails
          ? { error: { message: 'nope' } }
          : { error: null };
      },
    },
  };

  return { from: table, auth, state };
}
