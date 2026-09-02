// ============================================================================
// The capture screen. It has one job and it must do it in two seconds:
// the app opens, the cursor is already blinking, you type, you tap Keep.
//
// Everything else on this screen is subordinate to that. No project picker,
// no tags, no structure, no board. Choosing where a note belongs is thinking,
// and thinking is the thing you do not have time for when the idea arrives.
// The writer sorts at a desk; the phone only has to not lose anything.
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, LayoutAnimation, Platform,
  Pressable, StyleSheet, Text, TextInput, UIManager, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { palette, radius, font } from './theme';
import { SYNC_ENABLED } from './config';
import * as store from './store';

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
// flagging once it has had a fair chance to go and hasn't — then it is news.
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
  const field = useRef(null);

  const refresh = useCallback(async () => {
    const [list, counts] = await Promise.all([store.list(), store.counts()]);
    setRows(list);
    setTally(counts);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // The whole contract of this app, in one function: write to disk, and only
  // then tell the writer it is kept. If the insert throws, say so loudly and
  // do NOT clear the field — the words on screen are the last copy.
  const keep = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await store.add(text);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      settle();
      setDraft('');
      await refresh();
      field.current?.focus();
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
        <Text style={s.mark}>beat<Text style={s.markBlue}>fall</Text></Text>
        <View style={s.grow} />
        <Tally c={c} tally={tally} />
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
          <Text style={s.hint} numberOfLines={1}>
            {ready
              ? 'Kept on this phone the moment you tap.'
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
      <View style={s.railHead}>
        <Text style={s.rail}>ON THIS PHONE</Text>
        <View style={s.hair} />
        {rows.length > 0 && <Text style={s.railHint}>hold to delete</Text>}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
                {stuck(item) && <Text style={s.pend}>· waiting to sync</Text>}
              </View>
            </View>
          </Pressable>
        )}
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
  mark: { fontFamily: font.serif, fontSize: 21, color: c.ink, letterSpacing: -0.3 },
  markBlue: { color: c.blue },
  grow: { flex: 1 },

  tally: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  tallyN: { fontFamily: font.sansSemi, fontSize: 14, color: c.ink2 },
  tallyW: { fontFamily: font.sans, fontSize: 12, color: c.ink3 },
  tallyGold: { fontFamily: font.sans, fontSize: 12, color: c.gold },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.goldHair, alignSelf: 'center' },

  pad: { paddingHorizontal: 20 },
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
