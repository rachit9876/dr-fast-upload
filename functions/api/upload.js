export async function onRequestPost({ request, env }) {
    try {
        const { filename, content } = await request.json();
        
        if (!filename || !content) {
            return new Response(JSON.stringify({ success: false, error: 'Missing data' }), { status: 400 });
        }

        const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '.bin';

        // Convert base64 to binary to calculate the true hash
        const binaryString = atob(content.replace(/\s+/g, ''));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

        // Generate SHA-256 hash (first 12 characters)
        const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
        
        const uniqueFilename = `${hashHex}${ext}`;
        const path = `public/${uniqueFilename}`;
        const BASE_URL = env.BASE_URL || new URL(request.url).origin;
        const finalUrl = `${BASE_URL}/${path}`;

        const headers = { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'MinUploader' };

        // 1. DEDUPLICATION CHECK: Does it already exist?
        const checkRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, { headers });
        if (checkRes.ok) {
            return new Response(JSON.stringify({ success: true, url: finalUrl, cached: true }));
        }

        // 2. UPLOAD: It's new, so commit it to GitHub
        const uploadRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Upload ${uniqueFilename}`, content })
        });

        if (uploadRes.ok) {
            return new Response(JSON.stringify({ success: true, url: finalUrl, cached: false }));
        } else {
            const err = await uploadRes.json();
            return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
        }

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
    }
}