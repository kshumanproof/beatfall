// ============================================================================
// Which script this note belongs to.
//
// The phone's one job is the two seconds between having a thought and losing
// it, so this screen is built to be answered once and then ignored. It
// remembers what you picked last and opens on that; changing scripts is one
// tap, and nothing here ever stands between the writer and the Keep button.
//
// It works with no signal. The shelf is cached on disk the first time it
// loads, and a stale name is worth far more than a spinner in a car park.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, font } from './theme';
import { fetchScripts, why } from './api';
import * as store from './store';

const CACHE = 'scripts.cache';
const LAST  = 'scripts.last';

export async function rememberScript(p) {
  try { await store.setItem(LAST, JSON.stringify(p || null)); } catch (e) {}
}

export async function lastScript() {
  try {
    const raw = await store.getItem(LAST);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/* The shelf. Disk first so the list is on screen immediately and correct
   offline, then the network quietly replaces it if it can. */
export function useScripts() {
  const [scripts, setScripts] = useState(null);
  const [busy, setBusy]       = useState(false);
  const [problem, setProblem] = useState(null);

  const load = useCallback(async () => {
    try {
      const raw = await store.getItem(CACHE);
      if (raw) setScripts(JSON.parse(raw));
    } catch (e) {}
    setBusy(true); setProblem(null);
    /* try/finally, not try/catch alone. Anything that throws in here and gets
       past the catch leaves busy stuck true, and busy stuck true is a spinner
       that never stops: the writer is told to wait for something that already
       failed. The finally is the only reason this screen can always be
       recovered by pulling down. */
    try {
      let fresh = null;
      try {
        fresh = await fetchScripts();
      } catch (e) {
        setProblem(why ? why(e) : String((e && e.message) || 'failed'));
      }
      if (fresh) {
        setScripts(fresh);
        // Writing the cache is a convenience, not part of loading. It used to
        // sit inside the same try, so a storage hiccup put "couldn't load your
        // scripts" on top of a list that had loaded perfectly.
        try { await store.setItem(CACHE, JSON.stringify(fresh)); } catch (e) {}
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { scripts, busy, problem, reload: load };
}

/* The shelf is loaded ONCE, by the screen that owns it, and handed down. Two
   components each calling useScripts meant two requests on every open and two
   sets of state disagreeing about whether it had worked. */
export default function ScriptSheet({ visible, onClose, onPick, current, scheme, shelf }) {
  const c = palette(scheme);
  const s = sheet(c);
  const inset = useSafeAreaInsets();
  const { scripts, busy, problem, reload } = shelf;

  const rows = scripts || [];

  /* Full height, always. A sheet that grows with its contents is a different
     size every time it opens, so the writer's thumb has to find the list
     again on each use, and with two scripts on it there is nothing to pull
     against to refresh. One shape, one place, every time. */
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { paddingTop: inset.top }]}>
        <View style={s.bar}>
          <Text style={s.h}>Which script?</Text>
          <View style={s.grow} />
          <Pressable onPress={reload} disabled={busy} hitSlop={12}
            accessibilityRole="button" accessibilityLabel="Refresh the list">
            <Text style={[s.act, busy && s.actOff]}>{busy ? 'Refreshing' : 'Refresh'}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={s.act}>Done</Text>
          </Pressable>
        </View>

        {problem === 'offline' && rows.length > 0 && (
          <Text style={s.note}>
            No signal, so this is the list from last time. Notes save either way.
          </Text>
        )}
        {problem && rows.length === 0 && !busy && (
          <Text style={s.bad}>
            {problem === 'offline'
              ? "No signal, so your scripts can't be fetched yet. Try again when you're back on."
              : "Couldn't load your scripts: " + problem + '.'}
          </Text>
        )}

        {scripts === null && busy ? (
          <View style={s.wait}><ActivityIndicator color={c.blue} /></View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.id)}
            refreshing={busy}
            onRefresh={reload}
            style={s.grow}
            contentContainerStyle={[s.list, { paddingBottom: inset.bottom + 28 }]}
            ListEmptyComponent={
              <Text style={s.empty}>
                No scripts yet. Start one at your desk and it will be here next time
                you open this.
              </Text>
            }
            renderItem={({ item }) => {
              const on = current && String(current.id) === String(item.id);
              return (
                <Pressable
                  onPress={() => { onPick(item); onClose(); }}
                  style={({ pressed }) => [s.row, on && s.rowOn, pressed && s.rowDown]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!on }}
                >
                  {/* Caps, as the web app sets a project title. A script is a
                      title, not a sentence. */}
                  <Text style={[s.name, on && s.nameOn]} numberOfLines={2}>
                    {String(item.name || '').toUpperCase()}
                  </Text>
                  {on && <Text style={s.tick}>Currently</Text>}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const sheet = (c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.ground },
  grow: { flex: 1 },
  bar: {
    flexDirection: 'row', alignItems: 'baseline', gap: 16,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderColor: c.ruleSoft,
  },
  h: { fontFamily: font.serif, fontSize: 22, color: c.ink },
  act: { fontFamily: font.sansMed, fontSize: 14, color: c.blue },
  actOff: { color: c.ink4 },

  note: { fontFamily: font.sans, fontSize: 12.5, lineHeight: 19, color: c.ink3,
    paddingHorizontal: 20, paddingTop: 12 },
  bad:  { fontFamily: font.sans, fontSize: 13, lineHeight: 20, color: c.red,
    paddingHorizontal: 20, paddingTop: 14 },
  wait: { paddingVertical: 44 },

  list: { paddingHorizontal: 20, paddingTop: 14, gap: 8 },
  row: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.ruleSoft,
    borderRadius: radius.card, paddingHorizontal: 15, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  rowOn: { borderColor: c.blue, backgroundColor: c.blueSoft },
  rowDown: { opacity: 0.7 },
  name: { flex: 1, fontFamily: font.sansSemi, fontSize: 13.5, letterSpacing: 0.7,
    lineHeight: 19, color: c.ink },
  nameOn: { color: c.blueInk },
  tick: { fontFamily: font.sans, fontSize: 11, color: c.blue },
  empty: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 21, color: c.ink3,
    paddingVertical: 10 },
});
