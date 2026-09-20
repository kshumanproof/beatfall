// ============================================================================
// Browser stand-in for the picture store.
//
// Metro picks this over photos.js for the `web` platform and ignores it
// everywhere else, exactly like store.web.js beside it, and for the same
// reason: the app can be opened in a browser for design review without a
// phone, a QR code and a firewall.
//
// Nothing here picks or keeps a picture. The camera, the shrink and the move
// into a folder the operating system will not empty are all native, and
// pretending otherwise in a browser would let a screen be reviewed in a state
// no phone can ever be in. The buttons are there, they answer honestly, and
// the rest of the screen is what this file exists to let somebody look at.
// ============================================================================
const nope = async () => null;

export const fromCamera  = nope;
export const fromLibrary = nope;
export const bytes       = nope;

export function has()     { return false; }
export function drop()    {}
export function dropAll() {}
