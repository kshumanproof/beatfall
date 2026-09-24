// The written Help & shortcuts page.
//
// Conversational support now belongs to Chatling. This endpoint has one small
// job: hand the public help page the short, searchable answers maintained in
// _help/content.js. It deliberately requires no account so sign-in help stays
// available to somebody who cannot sign in.
import { send } from './_lib/core.js';
import { HELP, SECTIONS } from './_help/content.js';

const SUPPORT = 'support@beatfall.app';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' });

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  return send(res, 200, {
    sections: SECTIONS,
    topics: HELP,
    support: SUPPORT
  });
}
