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
    const match = row => q._filters.every(([col, op, val]) => {
      const v = row[col];
      if (op === 'eq')  return v === val;
      if (op === 'gt')  return v > val;
      if (op === 'gte') return v >= val;
      if (op === 'lt')  return v < val;
      // `is` only ever asks about null in this codebase, and undefined is the
      // same absence as far as a stand-in row is concerned.
      if (op === 'is')  return val === null ? (v === null || v === undefined) : v === val;
      if (op === 'in')  return Array.isArray(val) && val.includes(v);
      return true;
    });
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
      update(p) { q._op = 'update'; q._patch = p; return api; },
      insert(r) { q._op = 'insert'; q._patch = r; return api; },
      upsert(r) { q._op = 'upsert'; q._patch = r; return api; },
      async single()      { const r = rows(); return {data: r[0] || null, error: r.length ? null : {message:'no rows'}}; },
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
      const r = rows();
      if (q._count) return { data: null, count: r.length, error: null };
      return single ? { data: r[0] || null, error: null } : { data: r, error: null };
    }
    return api;
  }

  return { from: table, state };
}
