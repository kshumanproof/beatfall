// ============================================================================
// Pictures, on the phone.
//
// The same promise the words get: a photograph is on this device's own disk
// before the screen says it was kept, and the network is not in that path. A
// writer photographing a doorway in a car park with one bar of signal gets the
// same answer as a writer typing a line at their kitchen table.
//
// THE DOCUMENT DIRECTORY, NOT THE CACHE. The camera hands back a file in a
// temporary folder, and a temporary folder is exactly what it sounds like:
// iOS and Android are both free to empty it the moment storage runs low, with
// no warning and no way to ask for it back. A picture waiting to be sent has
// to survive that, so it is moved somewhere the system will not touch.
//
// THE PICTURE IS SHRUNK HERE, BEFORE IT IS STORED. A modern phone camera makes
// a four megabyte file, and four megabytes is too big to send, too big to keep
// two hundred of, and far more detail than a reference photograph needs. The
// server refuses anything over 1.5MB precisely so that a client which skipped
// this step cannot quietly cost somebody their whole quota in six pictures.
// ============================================================================
import * as Picker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

/* The same two numbers the desktop uses, on purpose. A picture added at the
   desk and a picture caught on a phone should not be visibly different
   qualities in the same PDF. */
const EDGE    = 1600;
const QUALITY = 0.8;

const FOLDER = 'vision';

function box() {
  const dir = new Directory(Paths.document, FOLDER);
  try { if (!dir.exists) dir.create({ intermediates: true }); } catch (e) {}
  return dir;
}

const name = () =>
  'p_' + Date.now().toString(36)
  + Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0') + '.jpg';

/* ONE PICTURE, SHRUNK AND PUT SOMEWHERE SAFE.
 *
 * Returns { uri, bytes } for a file this app owns, or null if anything at all
 * went wrong. Null is a real answer: the caller keeps the writer's words and
 * says the picture did not attach, which is far better than half a note. */
async function keep(asset) {
  if (!asset || !asset.uri) return null;

  let made = asset;
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    /* Only ever DOWN. Resizing a small picture up to 1600 makes a bigger file
       out of the same detail, which is the opposite of the point. */
    if (asset.width && asset.width > EDGE) ctx.resize({ width: EDGE });
    const ref = await ctx.renderAsync();
    made = await ref.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  } catch (e) {
    /* Shrinking failed, which happens on odd formats. The original still goes
       through: the server's own ceiling is the backstop, and a picture that is
       refused there is a message on screen rather than a lost note. */
    made = asset;
  }

  try {
    const mine = new File(box(), name());
    const src  = new File(made.uri);
    /* Move, and copy if the move is refused. Android hands back files from a
       few different places depending on which app answered the picker, and
       not all of them can be moved across. A copy always works and the
       original is a temporary file either way. */
    try { await src.move(mine); }
    catch (e) {
      await src.copy(mine);
      try { if (src.exists) src.delete(); } catch (e2) {}
    }
    return { uri: mine.uri, bytes: sizeOf(mine) };
  } catch (e) {
    return null;
  }
}

function sizeOf(file) {
  try { return file.info().size || 0; } catch (e) { return 0; }
}

/* --------------------------------------------------------------- picking --
 *
 * Both of these return the same thing, so the screen does not care which
 * button was pressed: { uri, bytes } for one picture, or null.
 *
 * A refusal is not an error. Somebody who said no to the camera once has said
 * no, and the right answer is a plain sentence about where to change it, not
 * a second dialog arguing with them. The caller does that; this reports
 * `denied` and stops. */
export async function fromCamera() {
  const perm = await Picker.requestCameraPermissionsAsync();
  if (!perm.granted) return { denied: 'camera' };
  const r = await Picker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,              // compressed once, below, not twice
    exif: false,             // the server strips it too; no reason to carry it
  });
  if (r.canceled || !r.assets || !r.assets.length) return null;
  return keep(r.assets[0]);
}

export async function fromLibrary() {
  const perm = await Picker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { denied: 'library' };
  const r = await Picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  });
  if (r.canceled || !r.assets || !r.assets.length) return null;
  return keep(r.assets[0]);
}

/* ------------------------------------------------------------ the bytes --
 *
 * Read back as base64 at the moment of sending and never held in memory
 * before then. A screen holding twenty pictures as strings is a screen that
 * gets killed by the operating system halfway through a sentence. */
export async function bytes(uri) {
  const f = new File(uri);
  if (!f.exists) return null;
  return f.base64();
}

export function has(uri) {
  try { return !!uri && new File(uri).exists; } catch (e) { return false; }
}

/* Gone from this phone. Called when a note is thrown away, and again when the
   server has confirmed the picture arrived: this device is not an archive,
   and a photograph that is safely on the account has no reason to keep
   filling up somebody's storage. */
export function drop(uri) {
  if (!uri) return;
  try { const f = new File(uri); if (f.exists) f.delete(); } catch (e) {}
}

/* Everything, for the account delete. Same rule as the notes: half a wipe is
   worse than none, because it looks clean. */
export function dropAll() {
  try {
    const dir = box();
    dir.list().forEach((f) => { try { f.delete(); } catch (e) {} });
  } catch (e) {}
}
