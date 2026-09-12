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
  ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, font } from './theme';
import { fetchScripts, why } from './api';
import * as store from './store';

const CACHE = store.SHELF;
const LAST  = store.LAST;
const CHOSE = 'scripts.chose';

/* Every note now leaves this phone under a title, so there is no longer an
   unfiled state to record. What is remembered is which script was used last,
   so the picker opens where the writer left it. */
export async function rememberScript(p) {
  try {
    await store.setItem(LAST, JSON.stringify(p || null));
    await store.setItem(CHOSE, '1');
  } catch (e) {}
}

export async function lastScript() {
  try {
    const raw = await store.getItem(LAST);
    return { chosen: !!(await store.getItem(CHOSE)), project: raw ? JSON.parse(raw) : null };
  } catch (e) { return { chosen: false, project: null }; }
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
        /* Working titles are not on the server yet, so a fresh list would
           erase them and take the writer's chosen title with it. They ride
           along until Send turns them into real scripts. */
        setScripts((prev) => {
          const mine = (prev || []).filter((p) => p.local
            && !fresh.some((f) => String(f.name || '').trim().toLowerCase()
                                 === String(p.name || '').trim().toLowerCase()));
          const next = [...fresh, ...mine];
          try { store.setItem(CACHE, JSON.stringify(next)); } catch (e) {}
          return next;
        });
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

  /* A script started on the phone joins the list at once rather than after a
     round trip, so the picker does not blink empty while the server catches up. */
  const add = useCallback((p) => {
    setScripts(prev => {
      // `local` rides along or the working title loses the one thing that
      // marks it as not yet at the desk.
      const next = [...(prev || []), {id: p.id, name: p.name, structure: p.structure,
                                      local: !!p.local}];
      store.setItem(CACHE, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { scripts, busy, problem, reload: load, add };
}

/* The shelf is loaded ONCE, by the screen that owns it, and handed down. Two
   components each calling useScripts meant two requests on every open and two
   sets of state disagreeing about whether it had worked. */
export default function ScriptSheet({ visible, onClose, onPick, current, scheme, shelf }) {
  const c = palette(scheme);
  const s = sheet(c);
  const inset = useSafeAreaInsets();
  const { scripts, busy, problem, reload, add } = shelf;

  const [naming, setNaming] = useState(false);
  const [name, setName]     = useState('');
  const [making, setMaking] = useState(false);

  const rows = scripts || [];

  /* Starting a script from the phone asks for a name and nothing else. A
     structure is a desk decision, the app's default is a sound one, and
     Beatfall switches structures without losing a beat, so making somebody
     choose one in a car park buys nothing. */
  const start = () => {
    const clean = name.trim();
    if (!clean || making) return;
    /* NOT a server call. It used to be, and it failed in the one place this
       app is for: standing outside somewhere with one bar, which is also the
       moment a new idea arrives. So the title is real on this phone at once,
       and becomes a real script when the notes are sent, which is the first
       moment a connection was needed anyway. */
    const p = { id: store.LOCAL + Date.now().toString(36), name: clean, local: true };
    add(p);
    onPick(p);
    setNaming(false);
    setName('');
    onClose();
  };

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
          <Pressable onPress={() => setNaming(v => !v)} hitSlop={12}
            accessibilityRole="button" accessibilityLabel="Start a new script">
            <Text style={s.act}>{naming ? 'Cancel' : 'New'}</Text>
          </Pressable>
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

        {naming && (
          <View style={s.namer}>
            <TextInput
              style={s.nameIn}
              value={name}
              onChangeText={setName}
              placeholder="Working title"
              placeholderTextColor={c.ink4}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={start}
              editable={!making}
            />
            <Pressable onPress={start} disabled={!name.trim() || making}
              style={({ pressed }) => [s.mk, (!name.trim() || making) && s.mkOff, pressed && s.rowDown]}
              accessibilityRole="button">
              <Text style={[s.mkText, (!name.trim() || making) && s.mkTextOff]}>
                {making ? 'Starting' : 'Use it'}
              </Text>
            </Pressable>
          </View>
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
            /* Unfiled used to be an option here, and it cost more than it
               saved. Two notes for two different stories, both unfiled,
               arrive at the desk as one pile with no way to tell them apart,
               and the writer is asked to untangle at midnight what they knew
               perfectly well at dinner. A working title takes one line to
               type and can be changed at the desk any time. */
            ListHeaderComponent={
              <Pressable
                onPress={() => setNaming(true)}
                style={({ pressed }) => [s.row, s.rowNone, pressed && s.rowDown]}
                accessibilityRole="button"
                accessibilityLabel="No title yet. Type a working title."
              >
                <Text style={[s.name, s.nameNone]}>NO TITLE YET</Text>
                <Text style={s.tick}>Name it</Text>
              </Pressable>
            }
            ListEmptyComponent={
              <Text style={s.empty}>
                Nothing here yet. Press No title yet, or New up there, and give it a
                working title. You can rename it at your desk.
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
                  {/* Said plainly rather than hidden: this one is not on the
                      desk yet, and it will be the moment you send. */}
                  {!on && item.local && <Text style={s.soon}>Not sent yet</Text>}
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
  rowNone: { borderStyle: 'dashed', marginBottom: 8 },
  nameNone: { color: c.ink3 },
  namer: { flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 14 },
  nameIn: { flex: 1, fontFamily: font.sans, fontSize: 15, color: c.ink,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.rule,
    borderRadius: radius.ctl, paddingHorizontal: 13, minHeight: 46 },
  mk: { backgroundColor: c.blue, borderRadius: radius.ctl, paddingHorizontal: 18,
    minHeight: 46, justifyContent: 'center' },
  mkOff: { backgroundColor: c.ruleSoft },
  mkText: { fontFamily: font.sansSemi, fontSize: 14, color: c.onBlue },
  mkTextOff: { color: c.ink4 },
  rowDown: { opacity: 0.7 },
  name: { flex: 1, fontFamily: font.sansSemi, fontSize: 13.5, letterSpacing: 0.7,
    lineHeight: 19, color: c.ink },
  nameOn: { color: c.blueInk },
  tick: { fontFamily: font.sans, fontSize: 11, color: c.blue },
  soon: { fontFamily: font.sans, fontSize: 11, color: c.ink4 },
  empty: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 21, color: c.ink3,
    paddingVertical: 10 },
});
