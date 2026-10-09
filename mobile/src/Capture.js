// ============================================================================
// The capture screen. It has one job and it must do it in two seconds:
// choose a title, capture a note, then tap Keep. Each saved note requires
// a fresh title choice before another note can be entered.
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { palette, radius, font } from './theme';
import { Lockup } from './Mark';
import { SYNC_ENABLED } from './config';
import * as store from './store';
import * as photos from './photos';
import ScriptSheet, { lastScript, rememberScript, useScripts } from './Scripts';
import Account from './Account';
import { runSync } from './sync';

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


// ------------------------------------------------------------------ screen --
export default function Capture({ email }) {
  const scheme = useColorScheme();
  const c = palette(scheme);
  const inset = useSafeAreaInsets();
  const s = sheet(c);

  const [draft, setDraft] = useState('');
  /* THE PICTURE ATTACHED TO THE NOTE BEING TYPED, and nothing more than that.
     It is already a file on this phone's own disk by the time it gets here:
     the picking, the shrinking and the move out of the camera's temporary
     folder all happened before this state was set, so a force quit between
     taking the shot and pressing Keep costs a row in a table and never the
     photograph. */
  const [pic, setPic] = useState(null);
  const [picking2, setPicking2] = useState(false);   // a picker is open
  const [rows, setRows] = useState([]);
  const [tally, setTally] = useState({ total: 0, waiting: 0 });
  const [saving, setSaving] = useState(false);
  /* A title must be explicitly chosen for every note. */
  const [script, setScript] = useState(null);
  const [picking, setPicking] = useState(false);
  const [accounting, setAccounting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const shelf = useScripts();
  const field = useRef(null);

  const refresh = useCallback(async () => {
    const [list, counts] = await Promise.all([store.list(), store.counts()]);
    setRows(list);
    setTally(counts);
  }, []);

  /* SEND.
   *
   * A pull-to-refresh works, but only if you already know it is there, which
   * is not a thing to build a product's one deliberate action on. This is a
   * button, it floats above everything, and it is the trigger.
   *
   * It appears only when something is genuinely waiting, which is also the
   * only state in which it would do anything. */
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(0);
  const [everSent, setEverSent] = useState(false);
  const send = useCallback(async () => {
    if (sending || saving || picking2) return;
    Keyboard.dismiss();          // they are done typing; get out of the way
    setSending(true);
    const selectedId = script?.id;
    let r = null;
    try { r = await runSync(); } catch (e) {}
    await refresh();

    /* A WORKING TITLE THAT HAS JUST BECOME A REAL SCRIPT CHANGED ITS ID.
     *
     * runSync puts that right everywhere it is written down: the notes still
     * waiting, the cached shelf, and the remembered choice. What it cannot
     * reach is this screen, which is still holding the old `local:` id in
     * memory. Left alone, the next note is filed under an id the server has
     * never heard of, and the Send after that creates a SECOND script with
     * the same name.
     *
     * Both pieces are read back from disk rather than patched by hand, so
     * there is one answer to "which script is this" and it is the stored one. */
    if (r && r.promoted) {
      const agreed = await lastScript();
      setScript(current => current && current.id === selectedId && agreed.project ? agreed.project : current);
      shelf.reload();
    }

    if (r && r.sent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEverSent(true);
      setJustSent(r.sent);
      setTimeout(() => setJustSent(0), 4000);
    }

    /* A PICTURE THAT WAS REFUSED IS NOT A PICTURE THAT FAILED TO SEND, and
     * saying the wrong one wastes somebody's evening. A lapsed plan does not
     * get better with signal, so the message points at the computer rather
     * than at the weather. The server writes that sentence and the phone
     * repeats it, so there is one version of it in the world. */
    if (r && r.refused) {
      const f = r.refused;
      Alert.alert(
        f.status === 402 ? 'Pictures need a plan'
          : f.status === 507 ? 'No room for pictures'
          : 'Picture not sent yet',
        f.status === 402 || f.status === 507
          ? f.message
          : "The picture hasn’t been sent. Tap Send to retry when you have an internet connection."
      );
    } else if (r && !r.ok) {
      Alert.alert('Not sent yet',
        "Sending didn’t finish. Check your internet connection, then tap Send to retry.");
    }
    setSending(false);
  }, [refresh, sending, saving, picking2, script, shelf.reload]);

  useEffect(() => { refresh(); }, [refresh]);

  /* NOTHING SENDS BY ITSELF. Send is the only trigger, and it is a button.
   *
   * This used to sync on launch and on returning to the app, on the reasoning
   * that a note should never sit stranded. In practice it meant the notes were
   * gone before the writer could do anything with them: every relaunch, every
   * reload, and on iOS every full screen modal, emptied the phone. A writer
   * typed a note under one script, switched to another, and the first had
   * already left.
   *
   * So: type, Keep, type, Keep, switch script, Keep again. They stay exactly
   * where they are until Send is pressed. The button is sticky and impossible
   * to miss while anything is waiting, which is what makes this safe. */
  useEffect(() => {
    let gone = false;
    store.sentTally().then((n) => { if (!gone && n > 0) setEverSent(true); });
    return () => { gone = true; };
  }, []);

  // A remembered title is never consent to file the next note under it.
  const choose = (p) => {
    const slim = p ? { id: p.id, name: p.name } : null;
    setScript(slim);
    rememberScript(slim);
  };
  useEffect(() => {
    if (script && !picking && !saving && !waiting) field.current?.focus();
  }, [script, picking, saving, waiting]);

  /* ------------------------------------------------------------ pictures --
   *
   * A photograph is a note with a picture on it, the same way it is at the
   * desk. So the picture attaches to whatever is in the box, the box still
   * takes words, and Keep is still the one thing that saves anything. There
   * is no separate photo mode and no second Keep.
   *
   * A caption is optional on purpose. Somebody photographing a doorway from a
   * moving car has time for the shutter and not for a sentence, and the note
   * is worth having either way. */
  const attach = useCallback(async (how) => {
    if (!script || saving || picking2) return;
    Keyboard.dismiss();
    setPicking2(true);
    let got = null;
    try { got = how === 'camera' ? await photos.fromCamera() : await photos.fromLibrary(); }
    catch (e) { got = null; }
    setPicking2(false);

    if (got && got.denied) {
      Alert.alert(
        got.denied === 'camera' ? 'Beatfall cannot open the camera'
                                : 'Beatfall cannot see your photos',
        'You can turn this on for Beatfall in your phone’s Settings. '
        + 'Your typed notes work either way.');
      return;
    }
    if (!got || !got.uri) return;     // they backed out, or it would not save

    // Swapping one picture for another takes the first one off the phone.
    // Keeping it would fill up their storage with a shot they rejected.
    if (pic && pic.uri && pic.uri !== got.uri) photos.drop(pic.uri);
    settle();
    setPic(got);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [pic, picking2, script, saving]);

  /* Taken back off before it was kept, so the file goes with it. Nothing has
     been written to the notes table yet, which is why this can simply delete. */
  const unpin = useCallback(() => {
    if (pic && pic.uri) photos.drop(pic.uri);
    settle();
    setPic(null);
  }, [pic]);

  /* Switching scripts changes nothing about the notes already on this phone.
     Repainting when the picker closes is belt and braces: whatever the list
     was showing, it now shows what is actually in the database. */
  const closePicker = useCallback(() => { setPicking(false); refresh(); }, [refresh]);

  // The whole contract of this app, in one function: write to disk, and only
  // then tell the writer it is kept. If the insert throws, say so loudly and
  // do NOT clear the field: the words on screen are the last copy.
  const keep = async () => {
    const text = draft.trim();
    // A picture on its own is a whole note. Empty words on their own are not.
    if ((!text && !pic) || saving) return;
    // Guard Keep as well as the entry controls.
    if (!script) { setPicking(true); return; }
    setSaving(true);
    try {
      await store.add(text, script, pic);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      settle();
      setDraft('');
      /* Cleared AFTER the write, never before. The picture is on the phone's
         disk either way, but until the row exists nothing knows where it is,
         and a screen that has already let go of it would leave a file behind
         that only the account delete would ever find. */
      setPic(null);
      setScript(null);
      Keyboard.dismiss();
      await refresh();
      // Keep saves locally. Send remains the only upload trigger.
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
    const words = String(row.body || '').trim();
    Alert.alert(
      row.photo_uri && !words ? 'Delete this picture?' : 'Delete this note?',
      words
        ? (words.length > 90 ? words.slice(0, 90) + '…' : words)
          + (row.photo_uri ? '\n\nThe picture goes too.' : '')
        : 'The picture goes off this phone and is not sent.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => { await store.remove(row.id); settle(); refresh(); },
        },
      ],
    );
  };

  const ready = !!script && (draft.trim().length > 0 || !!pic);

  const openWaiting = () => { Keyboard.dismiss(); refresh(); setWaiting(true); };
  const accountButton = <Pressable onPress={() => { Keyboard.dismiss(); setAccounting(true); }} disabled={saving || sending || picking2} style={s.you} accessibilityRole="button" accessibilityLabel="Account"><Text style={s.youText}>{initial(email)}</Text></Pressable>;
  const waitingLink = <Pressable onPress={openWaiting} disabled={saving || sending || picking2} accessibilityRole="button" accessibilityLabel="Waiting to send" style={[s.waitingLink, { paddingBottom: Math.max(inset.bottom, 16) }]}>
    <Text style={s.waitingLabel}>Waiting to send</Text><View style={s.grow} /><Text style={s.waitingCount}>{tally.waiting}</Text><Text style={s.chevron}>›</Text>
  </Pressable>;
  return (
    <KeyboardAvoidingView style={[s.screen, { paddingTop: inset.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.head} onStartShouldSetResponder={() => true} onResponderRelease={() => Keyboard.dismiss()}>
        {waiting || script ? <Pressable onPress={() => { Keyboard.dismiss(); if (waiting) setWaiting(false); else setPicking(true); }} disabled={saving || sending || picking2} style={s.back} accessibilityRole="button" accessibilityLabel="Back to stories"><Text style={s.backText}>‹ Stories</Text></Pressable> : <Lockup scheme={scheme} size={26} />}
        <View style={s.grow} />{accountButton}
      </View>
      {waiting ? <>
        <View style={s.heading}><Text style={s.title}>Waiting to send</Text><Text style={s.subtitle}>{tally.waiting} {tally.waiting === 1 ? 'note' : 'notes'} saved on this phone</Text></View>
        <FlatList data={rows} keyExtractor={r => r.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[s.list, { paddingBottom: 24 }]}
          ListEmptyComponent={<Text style={s.empty}>{everSent ? 'Everything has been sent. Review your notes on your computer.' : 'Your kept notes will appear here.'}</Text>}
          renderItem={({ item }) => <Pressable onLongPress={() => scrub(item)} delayLongPress={350} accessibilityRole="button" accessibilityLabel={'Note for ' + (item.project_name || 'your story') + '. Hold to delete.'}>
            <View style={s.card}><Text style={s.storyLabel}>{item.project_name || 'No title'}</Text>
              {item.photo_uri ? <Image source={{ uri: item.photo_uri }} style={s.cardPic} resizeMode="cover" /> : null}
              <Text style={s.body}>{String(item.body || '').trim() || 'Picture without a caption'}</Text>
              <View style={s.foot}><Text style={s.stamp}>{when(item.created_at)}</Text><View style={s.grow} /><Text style={s.stamp}>Hold to delete</Text></View>
            </View>
          </Pressable>} />
        <View style={[s.sendArea, { paddingBottom: Math.max(inset.bottom, 16) }]}>
          {justSent > 0 && <Text style={s.confirm} accessibilityLiveRegion="polite">{justSent} sent. Waiting at your desk.</Text>}
          {SYNC_ENABLED && tally.waiting > 0 && <Pressable onPress={send} disabled={sending || saving || picking2} style={[s.primary, sending && s.disabled]} accessibilityRole="button" accessibilityLabel={'Send ' + tally.waiting + ' notes to your account'}><Text style={s.primaryText}>{sending ? 'Sending…' : 'Send ' + tally.waiting + (tally.waiting === 1 ? ' note' : ' notes') + ' to desktop'}</Text></Pressable>}
          <Text style={s.hint}>Review and place your notes on your computer.</Text>
        </View>
      </> : script ? <>
        <ScrollView style={s.grow} contentContainerStyle={s.captureContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View onStartShouldSetResponder={() => true} onResponderRelease={() => Keyboard.dismiss()}>
          <View style={s.destination}><View style={s.grow}><Text style={s.rail}>CAPTURING FOR</Text><Text style={s.title}>{script.name}</Text></View>
            <Pressable onPress={() => { if (!saving && !picking2 && !sending) { Keyboard.dismiss(); setPicking(true); } }} style={s.change} accessibilityRole="button" accessibilityLabel="Change story"><Text style={s.backText}>Change</Text></Pressable>
          </View>
          <View style={s.box}><TextInput ref={field} style={s.input} value={draft} onChangeText={text => { if (script && !saving && !sending) setDraft(text); }} editable={!!script && !saving && !sending} placeholder="What just occurred to you?" placeholderTextColor={c.ink4} multiline autoCorrect autoCapitalize="sentences" textAlignVertical="top" selectionColor={c.blue} scrollEnabled /></View>
          {pic && <View style={s.pinned}><Image source={{ uri: pic.uri }} style={s.pinnedPic} resizeMode="cover" /><Text style={s.pinnedWords}>Picture attached. Add a caption if you like.</Text><Pressable onPress={unpin} disabled={saving} style={s.remove} accessibilityRole="button" accessibilityLabel="Take this picture off the note"><Text style={s.backText}>×</Text></Pressable></View>}
          <View style={s.actions}>
            <Pressable onPress={() => attach('camera')} disabled={!script || saving || sending || picking2} style={s.secondary} accessibilityRole="button" accessibilityLabel="Take a photograph for this note"><Text style={s.secondaryText}>Photo</Text></Pressable>
            <Pressable onPress={() => attach('library')} disabled={!script || saving || sending || picking2} style={s.secondary} accessibilityRole="button" accessibilityLabel="Choose a picture from this phone"><Text style={s.secondaryText}>Library</Text></Pressable>
            <View style={s.grow} /><Pressable onPress={keep} disabled={!ready || saving || sending || picking2} style={[s.keep, (!ready || saving) && s.disabled]} accessibilityRole="button" accessibilityLabel="Keep this note"><Text style={[s.primaryText, !ready && s.disabledText]}>{saving ? 'Keeping…' : 'Keep note'}</Text></Pressable>
          </View><Text style={s.hint}>Saved on this phone until you send.</Text></View>
        </ScrollView>{waitingLink}
      </> : <>
        <ScriptSheet embedded visible scheme={scheme} shelf={shelf} current={script} onPick={choose} onClose={closePicker} />
        {waitingLink}
      </>}
      <Account visible={accounting} scheme={scheme} email={email} onClose={() => { setAccounting(false); refresh(); }} onCleared={() => setAccounting(false)} />
      <ScriptSheet visible={picking} scheme={scheme} shelf={shelf} current={script} onPick={choose} onClose={closePicker} />
    </KeyboardAvoidingView>
  );
}


/* One letter, from whatever we have. Not a photo and not a name: nobody else
   ever sees you in this app, so the circle is a landmark for your own thumb
   and a check that you are in the right account. */
function initial(email) {
  const t = String(email || '').trim();
  return t ? t[0].toUpperCase() : '\u00b7';
}

const sheet = (c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.ground }, grow: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, minHeight: 64 },
  you: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.rule },
  youText: { fontFamily: font.sansSemi, fontSize: 15, color: c.ink2 },
  back: { minHeight: 44, justifyContent: 'center' }, backText: { fontFamily: font.sansMed, fontSize: 15, color: c.blue },
  heading: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  title: { fontFamily: font.serif, fontSize: 34, lineHeight: 40, letterSpacing: -0.6, color: c.ink },
  subtitle: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: c.ink3, marginTop: 8 },
  rail: { fontFamily: font.sansSemi, fontSize: 10, letterSpacing: 1.6, color: c.ink3, marginBottom: 8 },
  captureContent: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  destination: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  change: { minHeight: 44, justifyContent: 'center' },
  box: { backgroundColor: c.card, borderWidth: 1, borderColor: c.rule, borderRadius: radius.panel, padding: 16, minHeight: 220 },
  input: { fontFamily: font.mono, fontSize: 16, lineHeight: 25, color: c.ink, minHeight: 190, padding: 0, margin: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  secondary: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: c.rule, borderRadius: radius.ctl, backgroundColor: c.card },
  secondaryText: { fontFamily: font.sansMed, fontSize: 14, color: c.ink2 },
  keep: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, backgroundColor: c.blue, borderRadius: radius.ctl },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: c.blue, borderRadius: radius.ctl },
  primaryText: { fontFamily: font.sansSemi, fontSize: 15, color: c.onBlue }, disabled: { backgroundColor: c.ruleSoft }, disabledText: { color: c.ink4 },
  hint: { fontFamily: font.sans, fontSize: 12, lineHeight: 18, color: c.ink3, marginTop: 12 },
  waitingLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 17, borderTopWidth: 1, borderColor: c.rule },
  waitingLabel: { fontFamily: font.serif, fontSize: 18, color: c.ink },
  waitingCount: { fontFamily: font.sansSemi, fontSize: 13, color: c.gold }, chevron: { fontFamily: font.sans, fontSize: 22, color: c.ink3 },
  list: { paddingHorizontal: 24, gap: 14 },
  card: { padding: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.rule, borderRadius: radius.panel },
  storyLabel: { fontFamily: font.sansSemi, fontSize: 10, letterSpacing: 1.4, color: c.ink3, marginBottom: 12 },
  body: { fontFamily: font.mono, fontSize: 15, lineHeight: 23, color: c.ink }, foot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  stamp: { fontFamily: font.sans, fontSize: 11, color: c.ink3 }, empty: { fontFamily: font.sans, fontSize: 15, lineHeight: 24, color: c.ink3 },
  sendArea: { paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderColor: c.ruleSoft },
  confirm: { fontFamily: font.sansMed, fontSize: 14, color: c.sage, marginBottom: 12 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginTop: 12, backgroundColor: c.surface, borderRadius: radius.panel },
  pinnedPic: { width: 56, height: 56, borderRadius: 4 }, pinnedWords: { flex: 1, fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: c.ink3 }, remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cardPic: { width: '100%', height: 170, borderRadius: 4, marginBottom: 12 },
});
