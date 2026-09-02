// ============================================================================
// Beatfall for phones — the capture sidekick.
//
// This is not a small board and it never will be. Rearranging index cards is a
// desk activity; catching an idea before it evaporates is not. The web app owns
// structure. This owns the two seconds between having a thought and losing it.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

// Deep imports, not package imports. Each of these font packages re-exports
// every weight and italic it ships, so `from '@expo-google-fonts/newsreader'`
// drags 1.7MB of faces we never draw into the binary. Naming the five files
// we actually use takes the bundle from ~4.3MB of fonts to ~440KB.
import Newsreader_600SemiBold from '@expo-google-fonts/newsreader/600SemiBold/Newsreader_600SemiBold.ttf';
import InstrumentSans_400Regular from '@expo-google-fonts/instrument-sans/400Regular/InstrumentSans_400Regular.ttf';
import InstrumentSans_500Medium from '@expo-google-fonts/instrument-sans/500Medium/InstrumentSans_500Medium.ttf';
import InstrumentSans_600SemiBold from '@expo-google-fonts/instrument-sans/600SemiBold/InstrumentSans_600SemiBold.ttf';
import CourierPrime_400Regular from '@expo-google-fonts/courier-prime/400Regular/CourierPrime_400Regular.ttf';

import { palette } from './theme';
import * as store from './store';
import Capture from './Capture';

export default function App() {
  const scheme = useColorScheme();
  const c = palette(scheme);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(null);

  const [fonts] = useFonts({
    Newsreader_600SemiBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    CourierPrime_400Regular,
  });

  useEffect(() => {
    store.init().then(() => setReady(true)).catch((e) => setBroken(String(e?.message || e)));
  }, []);

  // If the local store cannot open there is no honest way to run: the promise
  // this app makes is that a note is kept, and it could not keep one.
  if (broken) {
    return (
      <View style={{ flex: 1, backgroundColor: c.ground, padding: 28, justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Newsreader_600SemiBold', fontSize: 20, color: c.ink, marginBottom: 10 }}>
          Beatfall can't open its notebook
        </Text>
        <Text style={{ fontFamily: 'InstrumentSans_400Regular', fontSize: 14, lineHeight: 22, color: c.ink2 }}>
          Storage on this phone wouldn't open, so nothing you typed could be kept.
          Restarting the app usually clears it. {broken}
        </Text>
      </View>
    );
  }

  if (!fonts || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: c.ground, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.blue} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Capture />
    </SafeAreaProvider>
  );
}
