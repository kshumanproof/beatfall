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

import { palette, radius, font } from './theme';
import { fetchScripts } from './api';
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
    try {
      const fresh = await fetchScripts();
      setScripts(fresh);
      await store.setItem(CACHE, JSON.stringify(fresh));
    } catch (e) {
      if (e.status === 0) setProblem('offline');
      else if (e.status === 401) setProblem('signedout');
      else setProblem(e.message || 'failed');
    }
    setBusy(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { scripts, busy, problem, reload: load };
}

export default function ScriptSheet({ visible, onClose, onPick, current, scheme }) {
  const c = palette(scheme);
  const s = sheet(c);
  const { scripts, busy, problem, reload } = useScripts();

  const rows = scripts || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={s.card}>
        <View style={s.grab} />
        <Text style={s.h}>Which script?</Text>

        {problem === 'offline' && (
          <Text style={s.note}>
            No signal, so this is the list from the last time you were online. Notes
            still save either way.
          </Text>
        )}
        {problem && problem !== 'offline' && (
          <Text style={s.bad}>Couldn't load your scripts. Pull down to try again.</Text>
        )}

        {scripts === null && busy ? (
          <View style={s.wait}><ActivityIndicator color={c.blue} /></View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.id)}
            refreshing={busy}
            onRefresh={reload}
            contentContainerStyle={s.list}
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
                  <Text style={[s.name, on && s.nameOn]} numberOfLines={1}>{item.name}</Text>
                  {on && <Text style={s.tick}>Currently</Text>}
                </Pressable>
              );
            }}
          />
        )}

        <Pressable onPress={onClose} style={s.close} accessibilityRole="button">
          <Text style={s.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const sheet = (c) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20,16,10,.45)' },
  card: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '78%',
    backgroundColor: c.surface, borderTopLeftRadius: radius.panel * 2,
    borderTopRightRadius: radius.panel * 2, paddingHorizontal: 20, paddingBottom: 26,
    borderTopWidth: 1, borderColor: c.rule,
  },
  grab: {
    alignSelf: 'center', width: 38, height: 4, borderRadius: 2,
    backgroundColor: c.rule, marginTop: 10, marginBottom: 14,
  },
  h: { fontFamily: font.serif, fontSize: 21, color: c.ink, marginBottom: 4 },
  note: { fontFamily: font.sans, fontSize: 12.5, lineHeight: 19, color: c.ink3, marginTop: 6 },
  bad:  { fontFamily: font.sans, fontSize: 12.5, lineHeight: 19, color: c.red, marginTop: 6 },
  wait: { paddingVertical: 40 },
  list: { paddingTop: 12, gap: 8 },
  row: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.ruleSoft,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  rowOn: { borderColor: c.blue, backgroundColor: c.blueSoft },
  rowDown: { opacity: 0.7 },
  name: { flex: 1, fontFamily: font.sansMed, fontSize: 15, color: c.ink },
  nameOn: { color: c.blueInk },
  tick: { fontFamily: font.sans, fontSize: 11, color: c.blue },
  empty: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 21, color: c.ink3, paddingVertical: 10 },
  close: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20, marginTop: 6 },
  closeText: { fontFamily: font.sansMed, fontSize: 14, color: c.ink3 },
});
