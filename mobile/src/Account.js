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
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, font } from './theme';
import { SITE, SUPPORT_EMAIL, BUILD } from './config';
import { fetchAccount, deleteAccount, why } from './api';
import { signOut } from './supabase';
import { runSync } from './sync';
import * as store from './store';

const open = (url) => Linking.openURL(url).catch(() => {});

/* THE POLICY AND THE TERMS NEVER LEAVE THE APP.
 *
 * Tapping one used to hand the whole thing to Safari, and the page it landed
 * on offered a Back to the board button, which on a phone leads to a board
 * that cannot be used. So the writer was two taps from being outside Beatfall
 * with no way back in.
 *
 * This opens the same page in a sheet that sits on top of the app, with a Done
 * button, and `?app=1` tells the page to leave its own navigation off.
 *
 * The text is NOT copied into the app to achieve that. A privacy policy kept
 * in two places is a privacy policy that will eventually say two things, and
 * these are the two files in the whole product where that matters most. */
async function reading(url, c) {
  try {
    await WebBrowser.openBrowserAsync(url + (url.indexOf('?') < 0 ? '?' : '&') + 'app=1', {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: c.ground,
      controlsColor: c.blue,
      dismissButtonStyle: 'done',
      enableBarCollapsing: true,
    });
  } catch (e) {
    // No sheet available for some reason. Better outside the app than nowhere.
    open(url);
  }
}

export default function Account({ visible, onClose, scheme, email, onCleared }) {
  const c = palette(scheme);
  const s = sheet(c);
  const inset = useSafeAreaInsets();

  const [stage, setStage]   = useState('menu');    // 'menu' | 'delete'
  const [acct, setAcct]     = useState(null);
  const [tally, setTally]   = useState({ total: 0, waiting: 0 });
  const [gone, setGone]     = useState({ count: 0, at: 0 });
  const [problem, setProblem] = useState(null);   // reaching the server at all
  const [refused, setRefused] = useState(null);   // the delete itself came back no
  const [busy, setBusy]     = useState(false);
  const [typed, setTyped]   = useState('');

  const mine = (acct && acct.email) || email || '';

  const load = useCallback(async () => {
    try { setTally(await store.counts()); } catch (e) {}
    try {
      setGone({ count: await store.sentTally(), at: await store.lastSent() });
    } catch (e) {}
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
    setStage('menu'); setTyped(''); setRefused(null);
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
          /* And then say what happened. Sending in the background and leaving
             the same "3 notes have not been sent" on screen is the app doing
             the thing and hiding it. */
          { text: 'Send them first', onPress: async () => { await runSync(); load(); } },
          { text: 'Throw away and sign out', style: 'destructive', onPress: quit },
        ],
      );
      return;
    }
    quit();
  };

  const quit = async () => {
    setBusy(true);
    const left = await signOut();
    if (!left) {
      /* The wipe used to run either way, because signOut never reported a
         failure. The notes on this phone belong to the account that is signed
         in, so if the sign-out did not happen that account is still signed in
         and throwing its notes away buys nothing at all. Nothing is changed
         and the writer is told, which leaves them able to try again. */
      setBusy(false);
      Alert.alert("You're still signed in",
        "Beatfall couldn't sign you out just now, so nothing has been changed and "
        + 'your notes are still here. Try again when you have signal.');
      return;
    }
    // The notes and the cached shelf belong to the account that just left.
    try { await store.wipe(); } catch (e) {}
    setBusy(false);
    if (onCleared) onCleared();
  };

  const kill = async () => {
    if (busy) return;
    setBusy(true); setRefused(null);

    /* ONE CALL CAN FAIL AND MEAN "nothing happened". Only one.
     *
     * All four steps used to sit in a single try, so anything that threw AFTER
     * the server had already removed the account left the writer reading
     * "Nothing has been deleted" about an account that was gone. That is the
     * worst sentence this screen can say, because the only reasonable response
     * to it is to try again on an account that no longer exists.
     *
     * So the server call stands alone, and everything past it is tidying up
     * this phone: best effort, and never able to report a refusal.
     *
     * The server is careful about its half: if it could not reach Stripe, or
     * could not remove the account, it says which and nothing is deleted.
     * Whatever it said is what the writer needs to read, and it belongs on
     * THIS screen. It used to be written into the same field as "could not
     * reach the server", so a refused delete showed up under NOTES on the menu
     * behind it, attached to nothing. */
    try {
      await deleteAccount(mine);
    } catch (e) {
      setRefused((e && e.message) || 'That did not work. Nothing has been deleted.');
      setBusy(false);
      return;
    }

    // Past this line the account is gone and nothing below can change that.
    try { await store.wipe(); } catch (e) {}
    try { await signOut('local'); } catch (e) {}
    /* Apple asks that a writer be told when the deletion has finished, and it
       is the decent thing anyway: the screen behind this is about to become a
       sign-in page, which on its own reads like being logged out rather than
       like the thing you asked for having happened. */
    Alert.alert('Your account has been deleted',
      'Everything in it is gone. Thank you for trying Beatfall.');
    if (onCleared) onCleared();
  };

  const ready = typed.trim().toLowerCase() === String(mine).trim().toLowerCase();

  // ------------------------------------------------------------ the account
  const menu = (
    <ScrollView contentContainerStyle={[s.pad, { paddingBottom: inset.bottom + 40 }]}>
      {/* GROUPED, NOT STACKED.
          A flat run of blocks and rows leaves the reader to work out which
          lines belong together. Two cards under quiet headings does that work
          for them, and it is the one structural idea worth taking from every
          well-made settings screen. Sign out and delete stay OUTSIDE the
          cards, because they are not facts about you, they are things that
          happen to you. */}
      <Text style={s.group}>You</Text>
      <View style={s.card}>
        <View style={s.block}>
          <Text style={s.rail}>SIGNED IN AS</Text>
          <Text style={s.email} selectable>{mine || 'not signed in'}</Text>
        </View>

        <View style={s.inner} />

        <View style={s.block}>
          <Text style={s.rail}>NOTES</Text>
          <Text style={s.line}>{waitingWords(tally)}</Text>
          {/* Three states, not two. "Nothing waiting" and "we could not reach
              the server" look identical from the writer's chair unless the
              difference is said, and that difference is the whole question
              they opened this screen to ask. The rest of the time it says what
              has actually gone home, which is the reassurance a capture app
              owes somebody trusting it with ideas they cannot get back. */}
          <Text style={s.sub}>
            {problem === 'offline'
              ? 'No signal, so this is the last thing we knew.'
              : problem
                ? "Beatfall couldn't check with the server just now (" + problem + ")."
                : sentWords(gone)}
          </Text>
        </View>

        <View style={s.inner} />

        <View style={s.block}>
          <Text style={s.rail}>PLAN</Text>
          <Text style={s.line}>{planWords(acct)}</Text>
          {/* Facts only: what you are on, when it next changes, what is left
              to spend. No price and no button anywhere near it. */}
          {acct ? <Text style={s.sub}>{creditWords(acct)}</Text> : null}
        </View>
      </View>

      <Text style={s.group}>Beatfall</Text>
      <View style={s.card}>
        <Row c={c} label="Contact support" hint={SUPPORT_EMAIL}
          on={() => open('mailto:' + SUPPORT_EMAIL + '?subject=Beatfall%20on%20my%20phone')} />
        <Row c={c} label="Privacy policy"
          on={() => reading(SITE + '/privacy.html', c)} />
        <Row c={c} label="Terms" last
          on={() => reading(SITE + '/terms.html', c)} />
      </View>

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

      {refused ? <Text style={s.bad}>{refused}</Text> : null}

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

function Row({ c, label, hint, on, last }) {
  const s = sheet(c);
  return (
    <Pressable onPress={on}
      style={({ pressed }) => [s.row, last && s.rowLast, pressed && s.down]}
      accessibilityRole="button">
      <View style={s.grow}>
        <Text style={s.rowText}>{label}</Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={s.chev}>{'›'}</Text>
    </Pressable>
  );
}

/* THE PLAN, SAID PROPERLY.
 *
 * This line used to read "Beatfall." and stop, which is restraint taken so far
 * that it becomes silence. What somebody wants from a plan line is three
 * things: what am I on, when does it next change, and is anything about to run
 * out. All three are already in the answer the server sends; the screen simply
 * was not printing them. */
function planWords(a) {
  if (!a) return 'Checking…';
  if (a.unlimited) return 'No limits on this account.';
  if (a.trialing) {
    const d = daysTo(a.trial_ends_at);
    return d == null ? 'Free trial.'
      : d <= 0 ? 'Your free trial has ended.'
      : 'Free trial, ' + d + (d === 1 ? ' day' : ' days') + ' left.';
  }
  const name = a.plan_name || 'Beatfall';
  if (a.subscription_status === 'active') {
    const when = dayWords(a.current_period_end);
    if (a.cancel_at_period_end) return name + ', ending ' + (when || 'soon') + '.';
    return when ? name + ', renews ' + when + '.' : name + '.';
  }
  if (a.subscription_status === 'past_due') return name + ', payment did not go through.';
  return 'No plan at the moment.';
}

/* What is left to spend, and only when there is something to say. Banked
   credits are named separately because they behave differently: they do not
   expire at the end of the month, and a writer who bought them should be able
   to see that they are still there. */
function creditWords(a) {
  if (a.unlimited) return 'Plans and billing are handled at your desk.';
  const left = Number(a.credits_left);
  if (!isFinite(left)) return 'Plans and billing are handled at your desk.';
  const banked = Number(a.credits_banked) || 0;
  const month = isFinite(Number(a.credits_monthly_left))
    ? Number(a.credits_monthly_left) : left;
  const head = left === 0
    ? 'No credits left this month.'
    : left + (left === 1 ? ' credit' : ' credits') + ' left'
      + (banked > 0 ? ', ' + month + ' of them this month and ' + banked + ' bought' : '')
      + '.';
  return head + ' Placing notes is always free.';
}

/* Two counts and a clock, because "nothing waiting" on its own is ambiguous:
   it reads the same whether everything went home or nothing was ever caught. */
function waitingWords(t) {
  if (t.waiting > 0) {
    return t.waiting + (t.waiting === 1 ? ' note is' : ' notes are') + ' still on this phone.';
  }
  return 'Nothing waiting on this phone.';
}

function sentWords(g) {
  if (!g || !g.count) return 'Nothing has been sent from this phone yet.';
  const when = ago(g.at);
  return g.count + (g.count === 1 ? ' note' : ' notes') + ' sent from this phone'
    + (when ? ', the last one ' + when : '') + '.';
}

/* A date a person would say out loud. No year: a renewal is always inside
   twelve months and the year is noise. */
function dayWords(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
             'August', 'September', 'October', 'November', 'December'];
  return M[d.getMonth()] + ' ' + d.getDate();
}

function ago(ms) {
  if (!ms) return null;
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return m + ' minutes ago';
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'about an hour ago' : 'about ' + h + ' hours ago';
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : d + ' days ago';
}

function daysTo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!t) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

// Only ever shown to us, in a support email. The build matters as much as the
// version: twice now a bug has turned out to be a phone running yesterday's
// code, and a version number alone cannot tell those two apart.
function version() {
  let v = '?';
  try {
    // eslint-disable-next-line global-require
    const a = require('../app.json');
    v = (a && a.expo && a.expo.version) || '?';
  } catch (e) {}
  return 'v' + v + (BUILD ? ' \u00b7 build ' + BUILD : '');
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
  pad: { paddingHorizontal: 20, paddingTop: 4 },

  group: { fontFamily: font.sansSemi, fontSize: 11, letterSpacing: 0.4, color: c.ink3,
    marginTop: 22, marginBottom: 9, marginLeft: 2 },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.ruleSoft,
    borderRadius: radius.panel, overflow: 'hidden' },
  block: { paddingHorizontal: 15, paddingVertical: 15 },
  inner: { height: 1, backgroundColor: c.ruleSoft },

  rail: { fontFamily: font.sansSemi, fontSize: 9.5, letterSpacing: 1.4, color: c.ink4,
    marginBottom: 7 },
  railRed: { color: c.red },
  email: { fontFamily: font.mono, fontSize: 15, color: c.ink },
  line: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, color: c.ink },
  sub: { fontFamily: font.sans, fontSize: 12.5, lineHeight: 19, color: c.ink3, marginTop: 4 },
  hr: { height: 1, backgroundColor: c.ruleSoft, marginVertical: 20 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 15, paddingHorizontal: 15,
    borderBottomWidth: 1, borderColor: c.ruleSoft },
  rowLast: { borderBottomWidth: 0 },
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
