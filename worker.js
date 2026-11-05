// Relais Cloudflare Worker pour « Idées de films »
// Garde la clé TMDB côté serveur. Le site appelle ce relais au lieu de TMDB.
//
// Réglages à créer dans Cloudflare (Settings → Variables and Secrets) :
//   TMDB_KEY  (type Secret)  : ta clé API TMDB (v3) ou ton jeton d'accès en lecture
//   ALLOWED   (type Text)    : https://julien67890.github.io
//                              (plusieurs origines possibles, séparées par des virgules)

const OK_PATHS = [
  /^\/3\/trending\/movie\/(day|week)$/,
  /^\/3\/discover\/movie$/,
  /^\/3\/search\/movie$/,
  /^\/3\/genre\/movie\/list$/,
  /^\/3\/configuration$/,
  /^\/3\/watch\/providers\/movie$/,
  /^\/3\/movie\/(now_playing|popular|top_rated|upcoming)$/,
  /^\/3\/movie\/\d+$/,
  /^\/3\/movie\/\d+\/watch\/providers$/
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED || '').split(',').map(s => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : (allowed[0] || ''),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response('Méthode non autorisée', { status: 405, headers: cors });
    // Refuse les appels venant d'un autre site
    if (origin && !originOk) return new Response('Origine non autorisée', { status: 403, headers: cors });

    const url = new URL(request.url);
    if (!OK_PATHS.some(re => re.test(url.pathname))) {
      return new Response('Chemin non autorisé', { status: 404, headers: cors });
    }

    const target = new URL('https://api.themoviedb.org' + url.pathname);
    url.searchParams.forEach((v, k) => { if (k !== 'api_key') target.searchParams.set(k, v); });

    const headers = { Accept: 'application/json' };
    if (env.TMDB_KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + env.TMDB_KEY;
    else target.searchParams.set('api_key', env.TMDB_KEY);

    // Cache de 10 minutes : moins d'appels à TMDB et un site plus rapide
    const cache = caches.default;
    const cacheKey = new Request(target.toString().replace(/api_key=[^&]+&?/, ''), { method: 'GET' });
    let res = await cache.match(cacheKey);
    if (!res) {
      const upstream = await fetch(target, { headers });
      res = new Response(upstream.body, upstream);
      if (upstream.ok) {
        res.headers.set('Cache-Control', 'public, max-age=600');
        await cache.put(cacheKey, res.clone());
      }
    }
    const out = new Response(res.body, res);
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  }
};
