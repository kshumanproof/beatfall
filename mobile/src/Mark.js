// ============================================================================
// The lockup.
//
// This is not drawn. It is the master artwork itself, lifted out of
// "Where your story falls into place..svg" at the placement that file puts
// its two halves in, and it is the same two files the website loads from
// public/brand/. There is nothing here to get wrong, and nothing here to
// keep in step by hand.
//
// ONE number sizes it: `size`, the type size the name would be set at. Every
// other dimension is a ratio measured off the artwork.
// ============================================================================
import React from 'react';
import { Image, View } from 'react-native';

const LOCKUP       = require('../assets/lockup.png');
const LOCKUP_DARK  = require('../assets/lockup-dark.png');
const TAGLINE      = require('../assets/tagline.png');
const TAGLINE_DARK = require('../assets/tagline-dark.png');

// Straight off the artwork: the lockup's ink is 510.909 x 110.30 page units
// against a 120.80 wordmark, and the tagline's is 513.947 x 32.656 sitting
// 17.888 below it, flush left.
const LOCK_H   = 0.913;
const LOCK_AR  = 510.909 / 110.300;
const TAG_W    = 4.254;
const TAG_AR   = 513.947 / 32.656;
const TAG_GAP  = 0.1481;

export function Lockup({ scheme, size = 34 }) {
  const h = size * LOCK_H;
  return (
    <Image
      source={scheme === 'dark' ? LOCKUP_DARK : LOCKUP}
      style={{ height: h, width: h * LOCK_AR }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Beatfall"
    />
  );
}

/* The lockup with the line under it, exactly as the artwork sets them. Use
   this wherever there is vertical room; use Lockup alone where there is not. */
export function LockupStacked({ scheme, size = 34 }) {
  const w = size * TAG_W;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Beatfall. Where your story falls into place.">
      <Lockup scheme={scheme} size={size} />
      <Image
        source={scheme === 'dark' ? TAGLINE_DARK : TAGLINE}
        style={{ width: w, height: w / TAG_AR, marginTop: size * TAG_GAP }}
        resizeMode="contain"
      />
    </View>
  );
}
