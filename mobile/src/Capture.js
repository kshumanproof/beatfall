// ============================================================================
// The capture screen. It has one job and it must do it in two seconds:
// the app opens, the cursor is already blinking, you type, you tap Keep.
//
// Everything else on this screen is subordinate to that. No tags, no
// structure, no board. There is one script picker, and it is answered once and
// then remembered, because deciding where a note belongs is thinking and
// thinking is what you do not have time for when the idea arrives. Everything
// else is sorted at a desk; the phone only has to not lose anything.
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, LayoutAnimation, Platform,
  Pressable, StyleSheet, Text, TextInput, UIManager, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { palette, radius, font } from './theme';
import { Lockup } from './Mark';
import { SYNC_ENABLED } from './config';
import * as store from './store';
import ScriptSheet, { lastScript, rememberScript, useScripts } from './Scripts';
import { runSync, watchForeground } from './sync';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const settle = () =>
  LayoutAnimation.configureNext(
    LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );

// ------------------------------------------------------------------- time --
function when(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = new Date(ms);
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Every note is unsynced for the first moment of its life, and saying so on
// every card turns the normal case into an alarm. A note is only worth
// flagging once it has had a fair chance to go and hasn't, then it is news.
const STUCK_AFTER = 3 * 60 * 1000;
const stuck = (row) =>
  SYNC_ENABLED && !row.synced_at && Date.now() - row.created_at > STUCK_AFTER;

// ------------------------------------------------------------------ screen --
export default function Capture() {
  const scheme = useColorScheme();
  const c = palette(scheme);
  const inset = useSafeAreaInsets();
  const s = sheet(c);

  const [draft, setDraft] = useState('');
  const [rows, setRows] = useState([]);
  const [tally, setTally] = useState({ total: 0, waiting: 0 });
  const [saving, setSaving] = useState(false);
  /* Which script the next note goes to. Chosen once and then left alone: it
     survives a force-quit because it lives in the same SQLite file the notes
     do, and it is never a question the writer has to answer before typing. */
  const [script, setScript] = useState(null);
  const [picking, setPicking] = useState(false);
  const shelf = useScripts();
  const scripts = shelf.scripts;
  const field = useRef(null);

  const refresh = useCallback(async () => {
    const [list, counts] = await Promise.all([store.list(), store.counts()]);
    setRows(list);
    setTally(counts);
  }, []);

  /* Pull down on the list to sync by hand.
   *
   * Deliberately NOT a Send button. A Send button says notes might not go
   * unless you press it, which is the one thing this app must never imply:
   * they always go, and they are safe before they do. This is the same pull
   * that means "check again" everywhere else, and it does both halves of the
   * errand at once, sends what is waiting and clears what the desk has
   * already sorted. */
  const [pulling, setPulling] = useState(false);
  const pull = useCallback(async () => {
    setPulling(true);
    try { await runSync(); } catch (e) {}
    await refresh();
    setPulling(false);
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  /* Sync runs when there is a reason to, never on a timer. Launch, and coming
     back to the foreground. Each run repaints the list afterwards so the
     "waiting" marks are honest rather than one run out of date. */
  useEffect(() => {
    if (!SYNC_ENABLED) return undefined;
    let gone = false;
    const go = () => runSync().then(() => { if (!gone) refresh(); });
    go();
    const stop = watchForeground();
    return () => { gone = true; stop(); };
  }, [refresh]);

  /* Open on whatever was used last. Failing that, on the only script there is,
     because picking from a list of one is a question with no information in
     it. `chose` is what stops that guess from overriding a writer who has
     deliberately picked Not filed: an empty choice they made is not the same
     as no choice at all. */
  const [chose, setChose] = useState(null);   // null while we are still reading
  useEffect(() => {
    let gone = false;
    lastScript().then((r) => {
      if (gone) return;
      setChose(!!r.chosen);
      if (r.project) setScript(r.project);
    });
    return () => { gone = true; };
  }, []);
  useEffect(() => {
    if (chose === false && !script && scripts && scripts.length === 1) choose(scripts[0]);
  }, [scripts, script, chose]);

  const choose = (p) => {
    const slim = p ? { id: p.id, name: p.name } : null;
    setScript(slim);
    setChose(true);
    rememberScript(slim);
  };

  // The whole contract of this app, in one function: write to disk, and only
  // then tell the writer it is kept. If the insert throws, say so loudly and
  // do NOT clear the field: the words on screen are the last copy.
  const keep = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await store.add(text, script);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      settle();
      setDraft('');
      await refresh();
      field.current?.focus();
      /* Not awaited, and that is the point: the note is already on disk and
         the screen has already said so. Sending it home is somebody else's
         errand and must never sit between the writer and the next thought. */
      if (SYNC_ENABLED) runSync().then(refresh).catch(() => {});
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        "That didn't save",
        "Your phone wouldn't write the note to storage, so it's still in the box above. " +
        "Copy it somewhere safe before you close the app.",
      );
    } finally {
      setSaving(false);
    }
  };

  const scrub = (row) => {
    Alert.alert(
      'Throw this note away?',
      row.body.length > 90 ? row.body.slice(0, 90) + '…' : row.body,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Throw away', style: 'destructive',
          onPress: async () => { await store.remove(row.id); settle(); refresh(); },
        },
      ],
    );
  };

  const ready = draft.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[s.screen, { paddingTop: inset.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* -------------------------------------------------------- header -- */}
      <View style={s.head}>
        <Lockup scheme={scheme} size={26} />
        <View style={s.grow} />
        <Tally c={c} tally={tally} />
      </View>

      {/* Where the next note is going. One line, always visible, one tap to
          change. It sits above the box rather than below it so it is read
          before the writer types, not discovered after. */}
      <View style={s.pad}>
        <Pressable
          onPress={() => setPicking(true)}
          style={({ pressed }) => [s.script, pressed && s.scriptDown]}
          accessibilityRole="button"
          accessibilityLabel={script ? `Filing under ${script.name}. Change script.` : 'Choose a script'}
        >
          <Text style={s.scriptRail}>TO</Text>
          <Text style={[s.scriptName, !script && s.scriptNone]} numberOfLines={1}>
            {script ? String(script.name).toUpperCase() : 'No script yet'}
          </Text>
          <Text style={s.scriptGo}>Change</Text>
        </Pressable>
      </View>

      {/* ------------------------------------------------------- capture -- */}
      <View style={s.pad}>
        <View style={s.box}>
          <TextInput
            ref={field}
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="What just occurred to you?"
            placeholderTextColor={c.ink4}
            multiline
            autoFocus
            autoCorrect
            autoCapitalize="sentences"
            textAlignVertical="top"
            selectionColor={c.blue}
            scrollEnabled
          />
        </View>

        <View style={s.actions}>
          <Text style={s.hint} numberOfLines={2}>
            {ready
              ? 'Kept the moment you tap.'
              : SYNC_ENABLED ? 'It syncs later. Type now.' : 'Type now, sort later.'}
          </Text>
          <Pressable
            onPress={keep}
            disabled={!ready || saving}
            style={({ pressed }) => [
              s.keep,
              !ready && s.keepOff,
              pressed && ready && s.keepDown,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Keep this note"
          >
            <Text style={[s.keepText, !ready && s.keepTextOff]}>Keep</Text>
          </Pressable>
        </View>
      </View>

      {/* -------------------------------------------------------- recent -- */}
      {/* Send appears ONLY when something is genuinely waiting. A button that
          sits there permanently would say notes need sending, and they do not:
          they go on their own, and they are safe on this phone before they do.
          When it appears it means something is still here, which is worth
          seeing. No confirmation behind it, because pressing Send already
          answered that question. */}
      <View style={s.railHead}>
        <Text style={s.rail}>ON THIS PHONE</Text>
        <View style={s.hair} />
        {SYNC_ENABLED && tally.waiting > 0 ? (
          <Pressable onPress={pull} disabled={pulling} hitSlop={10}
            style={({ pressed }) => [s.send, pressed && s.scriptDown]}
            accessibilityRole="button"
            accessibilityLabel={`Send ${tally.waiting} waiting notes now`}>
            <Text style={s.sendText}>
              {pulling ? 'Sending' : tally.waiting + ' waiting \u00b7 Send'}
            </Text>
          </Pressable>
        ) : rows.length > 0 ? (
          <Text style={s.railHint}>hold to delete</Text>
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={pulling}
        onRefresh={SYNC_ENABLED ? pull : undefined}
        contentContainerStyle={[s.list, { paddingBottom: inset.bottom + 28 }]}
        ListEmptyComponent={
          <Text style={s.empty}>
            Nothing captured yet. Whatever you type up there lands here and stays
            here, signal or no signal.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => scrub(item)} delayLongPress={350}>
            <View style={s.card}>
              <Text style={s.body}>{item.body}</Text>
              <View style={s.foot}>
                <Text style={s.stamp}>{when(item.created_at)}</Text>
                {item.project_name
                  ? <Text style={s.stamp} numberOfLines={1}>· {String(item.project_name).toUpperCase()}</Text>
                  : <Text style={s.pend}>· no script</Text>}
                {stuck(item) && <Text style={s.pend}>· waiting to sync</Text>}
              </View>
            </View>
          </Pressable>
        )}
      />

      <ScriptSheet
        visible={picking}
        scheme={scheme}
        shelf={shelf}
        current={script}
        onPick={choose}
        onClose={() => setPicking(false)}
      />
    </KeyboardAvoidingView>
  );
}

// --------------------------------------------------------------- the tally --
// Never state by colour alone: the dot always sits beside a word.
function Tally({ c, tally }) {
  const s = sheet(c);
  if (!tally.total) return null;
  return (
    <View style={s.tally}>
      <Text style={s.tallyN}>{tally.total}</Text>
      <Text style={s.tallyW}>{tally.total === 1 ? 'note' : 'notes'}</Text>
      {SYNC_ENABLED && tally.waiting > 0 && (
        <>
          <View style={s.dot} />
          <Text style={s.tallyGold}>{tally.waiting} waiting</Text>
        </>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ styles --
const sheet = (c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.ground },

  head: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  grow: { flex: 1 },

  tally: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  tallyN: { fontFamily: font.sansSemi, fontSize: 14, color: c.ink2 },
  tallyW: { fontFamily: font.sans, fontSize: 12, color: c.ink3 },
  tallyGold: { fontFamily: font.sans, fontSize: 12, color: c.gold },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.goldHair, alignSelf: 'center' },

  pad: { paddingHorizontal: 20 },
  script: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.ruleSoft,
    borderRadius: radius.ctl,
  },
  scriptDown: { opacity: 0.7 },
  scriptRail: { fontFamily: font.sansSemi, fontSize: 9.5, letterSpacing: 1.4, color: c.ink4 },
  scriptName: { flex: 1, fontFamily: font.sansSemi, fontSize: 12.5, letterSpacing: 0.7, color: c.ink },
  scriptNone: { color: c.gold },
  scriptGo: { fontFamily: font.sansMed, fontSize: 12.5, color: c.blue },
  box: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.rule,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 132, maxHeight: 260,
  },
  input: {
    fontFamily: font.mono, fontSize: 15.5, lineHeight: 24, color: c.ink,
    flex: 1, padding: 0, margin: 0,
  },

  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  hint: { flex: 1, fontFamily: font.sans, fontSize: 11.5, color: c.ink3 },
  keep: {
    backgroundColor: c.blue, borderRadius: radius.ctl,
    paddingHorizontal: 26, minHeight: 44, justifyContent: 'center',
  },
  keepOff: { backgroundColor: c.ruleSoft },
  keepDown: { backgroundColor: c.blueInk },
  keepText: { fontFamily: font.sansSemi, fontSize: 14.5, color: c.onBlue },
  keepTextOff: { color: c.ink4 },

  railHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 26, marginBottom: 12 },
  rail: { fontFamily: font.sansSemi, fontSize: 9.5, letterSpacing: 1.4, color: c.ink4 },
  railHint: { fontFamily: font.sans, fontSize: 10.5, color: c.ink4 },
  send: { backgroundColor: c.blueSoft, borderWidth: 1, borderColor: c.blue,
    borderRadius: radius.ctl, paddingHorizontal: 11, paddingVertical: 6 },
  sendText: { fontFamily: font.sansSemi, fontSize: 11.5, color: c.blueInk },
  hair: { flex: 1, height: 1, backgroundColor: c.ruleSoft },

  list: { paddingHorizontal: 20, gap: 10 },
  card: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.ruleSoft,
    borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12,
  },
  body: { fontFamily: font.mono, fontSize: 14, lineHeight: 22, color: c.ink },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  stamp: { fontFamily: font.sans, fontSize: 11, color: c.ink4 },
  pend: { fontFamily: font.sans, fontSize: 11, color: c.gold },

  empty: {
    fontFamily: font.sans, fontSize: 13.5, lineHeight: 21, color: c.ink3,
    paddingVertical: 6,
  },
});
