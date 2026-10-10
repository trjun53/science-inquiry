// 학교 AI 서버(프록시) — Cloudflare Workers용
// 학생 브라우저 → 이 프록시 → Anthropic API
// · Claude API 키는 Cloudflare의 비밀 변수(ANTHROPIC_API_KEY)에만 저장되어 학생 기기에 노출되지 않습니다.
// · 허용한 웹사이트(ALLOWED_ORIGINS)에서 온 /v1/messages 요청만 전달합니다.
// · 모델과 최대 출력 길이를 고정해 비용이 커지지 않게 합니다.
//
// 설정(Cloudflare 대시보드 → Workers → 이 Worker → Settings → Variables and Secrets)
//   ANTHROPIC_API_KEY  (Secret)  : Claude API 키
//   ALLOWED_ORIGINS    (Text)    : 허용할 사이트 주소, 쉼표로 구분 (예: https://trjun53.github.io)

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });

    const url = new URL(request.url);
    if (!originOk || request.method !== 'POST' || url.pathname !== '/v1/messages') {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'permission_error', message: 'Not allowed' } }),
        { status: 403, headers: { ...cors, 'content-type': 'application/json' } });
    }

    let body;
    try { body = await request.json(); } catch (e) {
      return new Response('Bad request', { status: 400, headers: cors });
    }
    body.model = MODEL;
    body.max_tokens = Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS);
    delete body.tools;
    delete body.mcp_servers;

    const headers = {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
    };
    const beta = request.headers.get('anthropic-beta');
    if (beta) headers['anthropic-beta'] = beta;

    const upstream = await fetch(`https://api.anthropic.com/v1/messages${url.search}`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'content-type': upstream.headers.get('content-type') || 'application/json' },
    });
  },
};
