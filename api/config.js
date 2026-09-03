// ============================================================================
// The two public values the browser legitimately needs: the Supabase URL and
// its anon key. Both are safe in a browser by design: row-level security is
// what protects the data, not secrecy of this key.
//
// Serving them from here rather than hard-coding means the same static files
// work in every environment.
// ============================================================================
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    siteUrl: process.env.SITE_URL || ''
  }));
}
