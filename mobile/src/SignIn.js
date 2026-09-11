// ============================================================================
// Signing in, on a phone.
//
// Two states in one screen: ask for the address, then ask for the code that
// arrives. Never a link. A link has to leave the mail app and find its way
// back into this one, and which mail app somebody uses decides whether that
// works, which is not a thing a sign-in should depend on.
//
// Nothing here mentions plans, prices or upgrading, and nothing links out to
// buy anything. That is deliberate and it is not a style choice: Apple rejects
// a companion app that points at an external purchase. The subscription is a
// desk decision anyway.
// ============================================================================
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, font } from './theme';
import { Lockup } from './Mark';
import { requestCode, submitCode } from './supabase';

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export default function SignIn() {
  const scheme = useColorScheme();
  const c = palette(scheme);
  const s = sheet(c);
  const inset = useSafeAreaInsets();

  const [stage, setStage] = useState('email');   // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const codeField = useRef(null);

  const send = async () => {
    if (!looksLikeEmail(email) || busy) return;
    setBusy(true); setProblem(null);
    try {
      await requestCode(email);
      setStage('code');
      setTimeout(() => codeField.current && codeField.current.focus(), 250);
    } catch (e) {
      setProblem(say(e));
    }
    setBusy(false);
  };

  const verify = async () => {
    if (code.replace(/\D/g, '').length < 6 || busy) return;
    setBusy(true); setProblem(null);
    try {
      // No navigation on success. App.js is listening to the session and
      // swaps the screen out from under this one, which is the same thing
      // happening in one place instead of two.
      await submitCode(email, code);
    } catch (e) {
      setProblem(say(e));
      setBusy(false);
    }
  };

  /* Supabase's own wording is written for developers reading a console. A
     writer standing outside a restaurant gets told what happened and what to
     do about it. */
  const say = (e) => {
    const raw = String((e && e.message) || '').toLowerCase();
    if (raw.includes('expired') || raw.includes('invalid')) {
      return "That code didn't work. It may have expired, or a digit is off. Ask for a new one.";
    }
    if (raw.includes('rate') || raw.includes('too many') || raw.includes('seconds')) {
      return 'Too many tries just now. Give it a minute and ask again.';
    }
    if (raw.includes('network') || raw.includes('reach') || raw.includes('fetch')) {
      return "Beatfall couldn't reach the server. Check your signal and try again.";
    }
    return (e && e.message) || 'Something went wrong. Try again.';
  };

  const emailReady = looksLikeEmail(email);
  const codeReady = code.replace(/\D/g, '').length === 6;

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.pad, { paddingTop: inset.top + 44, paddingBottom: inset.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Lockup scheme={scheme} size={34} />
        <Text style={s.tag}>Where your story falls into place.</Text>

        {stage === 'email' ? (
          <>
            <Text style={s.h1}>Catch it before it goes.</Text>
            <Text style={s.lede}>
              This is the phone half of Beatfall. Say the line you just thought of,
              pick the script it belongs to, and it is on your board when you sit down.
            </Text>

            <Text style={s.label}>EMAIL</Text>
            <View style={s.box}>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setProblem(null); }}
                placeholder="you@example.com"
                placeholderTextColor={c.ink4}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                selectionColor={c.blue}
                returnKeyType="go"
                onSubmitEditing={send}
                editable={!busy}
              />
            </View>

            <Problem c={c} text={problem} />

            <Go c={c} on={send} ready={emailReady} busy={busy} label="Email me a code" />
            <Text style={s.fine}>
              No password. The same box works whether you have an account or not.
            </Text>
          </>
        ) : (
          <>
            <Text style={s.h1}>Check your email.</Text>
            <Text style={s.lede}>
              A six digit code is on its way to <Text style={s.strong}>{email.trim()}</Text>.
              It lasts an hour.
            </Text>

            <Text style={s.label}>CODE</Text>
            <View style={s.box}>
              <TextInput
                ref={codeField}
                style={[s.input, s.codeInput]}
                value={code}
                onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setProblem(null); }}
                placeholder="000000"
                placeholderTextColor={c.ink4}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                selectionColor={c.blue}
                maxLength={6}
                editable={!busy}
              />
            </View>

            <Problem c={c} text={problem} />

            <Go c={c} on={verify} ready={codeReady} busy={busy} label="Sign me in" />

            <View style={s.backRow}>
              <Pressable onPress={() => { setStage('email'); setCode(''); setProblem(null); }} hitSlop={10}>
                <Text style={s.linky}>Use a different email</Text>
              </Pressable>
              <Text style={s.dot}>·</Text>
              <Pressable onPress={send} hitSlop={10} disabled={busy}>
                <Text style={s.linky}>Send it again</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Problem({ c, text }) {
  if (!text) return null;
  const s = sheet(c);
  return <Text style={s.problem}>{text}</Text>;
}

function Go({ c, on, ready, busy, label }) {
  const s = sheet(c);
  return (
    <Pressable
      onPress={on}
      disabled={!ready || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.go, !ready && s.goOff, pressed && ready && s.goDown]}
    >
      {busy
        ? <ActivityIndicator color={ready ? c.onBlue : c.ink4} />
        : <Text style={[s.goText, !ready && s.goTextOff]}>{label}</Text>}
    </Pressable>
  );
}

const sheet = (c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.ground },
  pad: { paddingHorizontal: 24 },

  tag: { fontFamily: font.serif, fontSize: 15, fontStyle: 'italic', color: c.ink3, marginTop: 6 },

  h1: { fontFamily: font.serif, fontSize: 25, color: c.ink, letterSpacing: -0.35,
    lineHeight: 31, marginTop: 40 },
  lede: { fontFamily: font.sans, fontSize: 14, lineHeight: 22, color: c.ink2, marginTop: 10 },
  strong: { fontFamily: font.sansSemi, color: c.ink },

  label: { fontFamily: font.sansSemi, fontSize: 9.5, letterSpacing: 1.4, color: c.ink4,
    marginTop: 32, marginBottom: 8 },
  box: { backgroundColor: c.card, borderWidth: 1, borderColor: c.rule, borderRadius: radius.card,
    paddingHorizontal: 14, minHeight: 52, justifyContent: 'center' },
  input: { fontFamily: font.mono, fontSize: 15.5, color: c.ink, padding: 0, margin: 0 },
  codeInput: { fontSize: 22, letterSpacing: 6 },

  problem: { fontFamily: font.sans, fontSize: 13, lineHeight: 20, color: c.red, marginTop: 12 },

  go: { marginTop: 14, backgroundColor: c.blue, borderRadius: radius.ctl, minHeight: 52,
    alignItems: 'center', justifyContent: 'center' },
  goOff: { backgroundColor: c.ruleSoft },
  goDown: { backgroundColor: c.blueInk },
  goText: { fontFamily: font.sansSemi, fontSize: 15, color: c.onBlue },
  goTextOff: { color: c.ink4 },

  fine: { fontFamily: font.sans, fontSize: 11.5, lineHeight: 18, color: c.ink3, marginTop: 12 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  linky: { fontFamily: font.sansMed, fontSize: 13, color: c.blue,
    textDecorationLine: 'underline' },
  dot: { fontFamily: font.sans, fontSize: 13, color: c.ink4 },
});
