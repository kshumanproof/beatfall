// ============================================================================
// Your account, on the phone.
//
// This screen is deliberately thin. Beatfall's account lives at a desk: plans,
// billing, boards, export, all of it. What belongs here is the handful of
// things a person standing in a car park might actually need, plus the two the
// app stores require of anybody who lets you make an account at all.
//
// WHAT IS HERE AND WHY, because the temptation to grow this screen will come
// back and every line of it should have to justify itself:
//
//   The email you are signed in as. First, and unmissable. For a capture app
//   the worst possible failure is catching a fortnight of notes into the wrong
//   account, and the only defence against it is showing which one you are in.
//
//   What is on the phone and what has gone home. A capture tool has to answer
//   "is my note actually safe" without being asked twice.
//
//   Your plan, as a fact. Not a price, not a button. A companion app to a
//   subscription bought on the web is allowed to say what you have; the moment
//   it invites you to buy something it becomes a different kind of app in the
//   reviewer's eyes, and we need nothing from that trade.
//
//   Where everything else is, said out loud, with one link.
//
//   Support, privacy, terms. The first two are required to be reachable from
//   inside the app.
//
//   Sign out, and delete the account. Deletion is required to be here, has to
//   remove the whole account rather than deactivate it, and has to be no
//   harder here than on the website.
//
// WHAT IS NOT HERE: a profile. No display name, no photo. This is a
// single-player app and nobody ever sees you in it. Also no theme switch, no
// notification settings that would quietly disagree with the desk, and nothing
// that leads to a payment.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, font } from './theme';
import { SITE, SUPPORT_EMAIL } from './config';
import { fetchAccount, deleteAccount, why } from './api';
import { signOut } from './supabase';
import { runSync } from './sync';
import * as store from './store';

const open = (url) => Linking.openURL(url).catch(() => {});

export default function Account({ visible, onClose, scheme, email, onCleared }) {
  const c = palette(scheme);
  const s = sheet(c);
  const inset = useSafeAreaInsets();

  const [stage, setStage]   = useState('menu');    // 'menu' | 'delete'
  const [acct, setAcct]     = useState(null);
  const [tally, setTally]   = useState({ total: 0, waiting: 0 });
  const [problem, setProblem] = useState(null);
  const [busy, setBusy]     = useState(false);
  const [typed, setTyped]   = useState('');

  const mine = (acct && acct.email) || email || '';

  const load = useCallback(async () => {
    try { setTally(await store.counts()); } catch (e) {}
    try {
      setAcct(await fetchAccount());
      setProblem(null);
    } catch (e) {
      // Not fatal. The email comes from the session on this device, so the
      // screen is still true and useful with no signal; only the plan line
      // and the freshest counts are missing.
      setProblem(why(e));
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setStage('menu'); setTyped('');
    load();
  }, [visible, load]);

  /* Signing out with notes still on the phone is the one genuinely dangerous
     thing on this screen. They cannot be sent once the session is gone, and
     leaving them behind for whoever signs in next would file one writer's
     notes into another writer's scripts. So it is said plainly and the writer
     picks, rather than the app choosing for them either way. */
  const leave = async () => {
    const t = await store.counts();
    if (t.waiting > 0) {
      Alert.alert(
        t.waiting === 1 ? 'One note has not been sent' : t.waiting + ' notes have not been sent',
        'They can only go to the account you are signed in to. Sign out now and they are '
        + 'thrown away.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send them first', onPress: async () => { await runSync(); } },
          { text: 'Throw away and sign out', style: 'destructive', onPress: quit },
        ],
      );
      return;
    }
    quit();
  };

  const quit = async () => {
    setBusy(true);
    try {
      await signOut();
      // The notes and the cached shelf belong to the account that just left.
      await store.wipe();
    } catch (e) {}
    setBusy(false);
    if (onCleared) onCleared();
  };

  const kill = async () => {
    if (busy) return;
    setBusy(true); setProblem(null);
    try {
      await deleteAccount(mine);
      await store.wipe();
      try { await signOut(); } catch (e) {}
      if (onCleared) onCleared();
    } catch (e) {
      /* The server is careful about this: if it could not reach Stripe, or
         could not remove the account, it says which half happened and nothing
         is deleted. Whatever it said is what the writer needs to read. */
      setProblem((e && e.message) || 'That did not work. Nothing has been deleted.');
      setBusy(false);
    }
  };

  const ready = typed.trim().toLowerCase() === String(mine).trim().toLowerCase();

  // ------------------------------------------------------------ the account
  const menu = (
    <ScrollView contentContainerStyle={[s.pad, { paddingBottom: inset.bottom + 40 }]}>
      <Text style={s.rail}>SIGNED IN AS</Text>
      <Text style={s.email} selectable>{mine || 'not signed in'}</Text>

      <View style={s.hr} />

      <Text style={s.rail}>NOTES</Text>
      <Text style={s.line}>
        {tally.waiting > 0
          ? tally.waiting + (tally.waiting === 1 ? ' note is' : ' notes are') + ' still on this phone.'
          : 'Nothing waiting on this phone.'}
      </Text>
      {/* Three states, not two. "Nothing waiting" and "we cannot reach the
          server" look identical from the writer's chair unless the difference
          is said, and that difference is the whole question they are asking. */}
      <Text style={s.sub}>
        {problem === 'offline'
          ? 'No signal, so this is the last thing we knew.'
          : problem
            ? "Beatfall couldn't check with the server just now (" + problem + ")."
            : 'Everything else is at your desk.'}
      </Text>

      <View style={s.hr} />

      <Text style={s.rail}>PLAN</Text>
      <Text style={s.line}>{planWords(acct)}</Text>
      {/* No price and no button, on purpose. See the note at the top. */}
      <Text style={s.sub}>Plans and billing are handled at your desk.</Text>

      <View style={s.hr} />

      <Row c={c} label="Open Beatfall at your desk" hint={host(SITE)}
        on={() => open(SITE)} />
      <Row c={c} label="Contact support" hint={SUPPORT_EMAIL}
        on={() => open('mailto:' + SUPPORT_EMAIL + '?subject=Beatfall%20on%20my%20phone')} />
      <Row c={c} label="Privacy policy" on={() => open(SITE + '/privacy.html')} />
      <Row c={c} label="Terms" on={() => open(SITE + '/terms.html')} />

      <Pressable onPress={leave} disabled={busy}
        style={({ pressed }) => [s.out, pressed && s.down]} accessibilityRole="button">
        <Text style={s.outText}>{busy ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>

      {/* Its own block, at the bottom, in red, away from everything a person
          presses by accident. */}
      <View style={s.danger}>
        <Text style={[s.rail, s.railRed]}>DELETE ACCOUNT</Text>
        <Text style={s.sub}>
          Everything, everywhere. Not just this phone.
        </Text>
        <Pressable onPress={() => { setProblem(null); setStage('delete'); }}
          style={({ pressed }) => [s.killBtn, pressed && s.down]} accessibilityRole="button">
          <Text style={s.killText}>Delete my account</Text>
        </Pressable>
      </View>

      <Text style={s.build}>Beatfall {version()}</Text>
    </ScrollView>
  );

  // ----------------------------------------------------------- and the end
  const end = (
    <ScrollView contentContainerStyle={[s.pad, { paddingBottom: inset.bottom + 40 }]}>
      <Text style={s.h2}>This cannot be undone.</Text>
      <Text style={s.para}>Deleting your account removes:</Text>
      <Text style={s.bullet}>Every script and every board.</Text>
      <Text style={s.bullet}>Every note, on the web and on this phone.</Text>
      <Text style={s.bullet}>Your sign in, so the same email starts fresh next time.</Text>
      {acct && acct.subscription_status === 'active' ? (
        <Text style={s.bullet}>Your subscription, which is cancelled as part of this.</Text>
      ) : null}
      <Text style={s.para}>
        Nothing is kept and nothing can be recovered. If you only want your work out of
        Beatfall, download it at your desk first.
      </Text>

      <Text style={s.rail}>TYPE YOUR EMAIL TO CONFIRM</Text>
      <View style={s.box}>
        <TextInput
          style={s.input}
          value={typed}
          onChangeText={(v) => { setTyped(v); setProblem(null); }}
          placeholder={mine}
          placeholderTextColor={c.ink4}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={c.blue}
          editable={!busy}
        />
      </View>

      {problem ? <Text style={s.bad}>{problem}</Text> : null}

      <Pressable onPress={kill} disabled={!ready || busy}
        style={({ pressed }) => [s.killBtn, s.killBig, (!ready || busy) && s.killOff,
                                 pressed && ready && s.down]}
        accessibilityRole="button">
        {busy ? <ActivityIndicator color={c.onBlue} />
              : <Text style={[s.killText, s.killBigText, !ready && s.killTextOff]}>
                  Delete my account
                </Text>}
      </Pressable>

      <Pressable onPress={() => setStage('menu')} disabled={busy}
        style={({ pressed }) => [s.out, pressed && s.down]} accessibilityRole="button">
        <Text style={s.outText}>Keep my account</Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { paddingTop: inset.top }]}>
        <View style={s.bar}>
          <Text style={s.h}>{stage === 'delete' ? 'Delete account' : 'Account'}</Text>
          <View style={s.grow} />
          <Pressable onPress={stage === 'delete' ? () => setStage('menu') : onClose}
            hitSlop={12} accessibilityRole="button">
            <Text style={s.act}>{stage === 'delete' ? 'Back' : 'Done'}</Text>
          </Pressable>
        </View>
        {stage === 'delete' ? end : menu}
      </View>
    </Modal>
  );
}

function Row({ c, label, hint, on }) {
  const s = sheet(c);
  return (
    <Pressable onPress={on} style={({ pressed }) => [s.row, pressed && s.down]}
      accessibilityRole="button">
      <View style={s.grow}>
        <Text style={s.rowText}>{label}</Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={s.chev}>{'›'}</Text>
    </Pressable>
  );
}

/* Said as a fact, in the fewest words that are true. A trial is a trial, a
   subscription is a subscription, and an account we could not reach says so
   rather than guessing. */
function planWords(a) {
  if (!a) return 'Checking…';
  if (a.unlimited) return 'No limits on this account.';
  if (a.trialing) {
    const d = daysTo(a.trial_ends_at);
    return d == null ? 'Free trial.'
      : d <= 0 ? 'Your free trial has ended.'
      : 'Free trial, ' + d + (d === 1 ? ' day' : ' days') + ' left.';
  }
  if (a.subscription_status === 'active') {
    return (a.plan_name || 'Beatfall') + (a.cancel_at_period_end ? ', ending soon.' : '.');
  }
  return 'No plan at the moment.';
}

function daysTo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!t) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

// Only ever shown to us, in a support email. It is here so that a writer can
// read us the number rather than describe the symptom twice.
function version() {
  try {
    // eslint-disable-next-line global-require
    const a = require('../app.json');
    return 'v' + ((a && a.expo && a.expo.version) || '?');
  } catch (e) { return ''; }
}

const host = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

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
  pad: { paddingHorizontal: 20, paddingTop: 18 },

  rail: { fontFamily: font.sansSemi, fontSize: 9.5, letterSpacing: 1.4, color: c.ink4,
    marginBottom: 7 },
  railRed: { color: c.red },
  email: { fontFamily: font.mono, fontSize: 15, color: c.ink },
  line: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, color: c.ink },
  sub: { fontFamily: font.sans, fontSize: 12.5, lineHeight: 19, color: c.ink3, marginTop: 4 },
  hr: { height: 1, backgroundColor: c.ruleSoft, marginVertical: 20 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15,
    borderBottomWidth: 1, borderColor: c.ruleSoft },
  rowText: { fontFamily: font.sansMed, fontSize: 14.5, color: c.ink },
  rowHint: { fontFamily: font.sans, fontSize: 12, color: c.ink4, marginTop: 2 },
  chev: { fontFamily: font.sans, fontSize: 20, color: c.ink4 },

  out: { marginTop: 22, minHeight: 50, borderRadius: radius.ctl, borderWidth: 1,
    borderColor: c.rule, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  outText: { fontFamily: font.sansSemi, fontSize: 14.5, color: c.ink },

  danger: { marginTop: 34, borderTopWidth: 1, borderColor: c.rule, paddingTop: 20 },
  killBtn: { marginTop: 12, minHeight: 48, borderRadius: radius.ctl, borderWidth: 1,
    borderColor: c.red, alignItems: 'center', justifyContent: 'center' },
  killText: { fontFamily: font.sansSemi, fontSize: 14.5, color: c.red },
  killBig: { backgroundColor: c.red, borderColor: c.red, minHeight: 52 },
  killBigText: { color: '#FFFFFF' },
  killOff: { backgroundColor: c.ruleSoft, borderColor: c.rule },
  killTextOff: { color: c.ink4 },

  h2: { fontFamily: font.serif, fontSize: 23, color: c.ink, marginBottom: 12 },
  para: { fontFamily: font.sans, fontSize: 14, lineHeight: 22, color: c.ink2, marginVertical: 10 },
  bullet: { fontFamily: font.sans, fontSize: 14, lineHeight: 22, color: c.ink,
    paddingLeft: 14, marginTop: 4 },
  box: { backgroundColor: c.card, borderWidth: 1, borderColor: c.rule, borderRadius: radius.card,
    paddingHorizontal: 14, minHeight: 52, justifyContent: 'center', marginTop: 2 },
  input: { fontFamily: font.mono, fontSize: 15, color: c.ink, padding: 0, margin: 0 },
  bad: { fontFamily: font.sans, fontSize: 13, lineHeight: 20, color: c.red, marginTop: 12 },

  down: { opacity: 0.7 },
  build: { fontFamily: font.sans, fontSize: 11, color: c.ink4, marginTop: 30,
    textAlign: 'center' },
});
