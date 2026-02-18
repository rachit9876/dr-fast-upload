export async function onRequestPost({ request }) {
  try {
    const { url } = await request.json();
    if (typeof url !== 'string' || !url.trim()) throw new Error('Missing url');

    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Invalid URL protocol');
    if (parsed.username || parsed.password) throw new Error('Credentials in URL not allowed');

    // Basic SSRF hardening: block obvious local / private destinations.
    // (Workers can’t reliably DNS-resolve here, so this is best-effort.)
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    ) {
      throw new Error('Blocked host');
    }
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) {
      throw new Error('Blocked private network');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 10_000);

    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('Failed to fetch');

    // Re-check final URL after redirects.
    try {
      const finalUrl = new URL(res.url);
      const finalHost = finalUrl.hostname.toLowerCase();
      if (finalHost === 'localhost' || finalHost === '127.0.0.1' || finalHost === '0.0.0.0' || finalHost === '::1') {
        throw new Error('Blocked host');
      }
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(finalHost)) {
        throw new Error('Blocked private network');
      }
    } catch (e) {
      // Only ignore URL parse errors (TypeError); re-throw intentional security errors.
      if (!(e instanceof TypeError)) throw e;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const maxBytes = 24 * 1024 * 1024;
    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) throw new Error('File too large');

    const bytes = await readToUint8ArrayWithLimit(res, maxBytes);
    const base64 = uint8ToBase64(bytes);
    
    return new Response(JSON.stringify({ success: true, base64, type: contentType.split(';')[0] || 'image/*' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function readToUint8ArrayWithLimit(res, maxBytes) {
  if (!res.body) throw new Error('Empty response');
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) throw new Error('File too large');
    chunks.push(value);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function uint8ToBase64(bytes) {
  // Avoid spreading huge arrays into function arguments.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
