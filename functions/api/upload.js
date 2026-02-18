export async function onRequestPost({ request, env }) {
    try {
        const { filename, content } = await request.json();
        const TOKEN = env.GITHUB_TOKEN;
        const REPO = env.GITHUB_REPO;
        const BASE_URL = env.BASE_URL || new URL(request.url).origin;

        if (!TOKEN || !REPO) {
            return new Response(JSON.stringify({ success: false, error: 'Server not configured' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        if (typeof filename !== 'string' || !filename.trim()) {
            return new Response(JSON.stringify({ success: false, error: 'Missing filename' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (typeof content !== 'string' || !content.trim()) {
            return new Response(JSON.stringify({ success: false, error: 'Missing content' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Restrict extensions to allowed file types.
        const lower = filename.toLowerCase();
        const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
        const allowedExt = new Set([
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.txt', '.csv', '.json', '.xml', '.html', '.css', '.js',
            '.zip', '.rar', '.7z', '.tar', '.gz',
            '.mp4', '.mp3', '.wav', '.avi', '.mov',
            '.md', '.rtf'
        ]);
        if (!allowedExt.has(ext)) {
            return new Response(JSON.stringify({ success: false, error: 'Unsupported file type' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Validate base64 and enforce decoded size limit.
        let binary;
        try {
            if (!/^[A-Za-z0-9+/=\s]+$/.test(content)) throw new Error('Invalid base64');
            binary = atob(content.replace(/\s+/g, ''));
        } catch {
            return new Response(JSON.stringify({ success: false, error: 'Invalid base64' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const maxBytes = 24 * 1024 * 1024;
        if (binary.length > maxBytes) {
            return new Response(JSON.stringify({ success: false, error: 'File too large' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
        const uniqueFilename = `${hashHex}${ext}`;
        const path = `public/${uniqueFilename}`;
        
        // Check if file already exists
        const checkRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'CF-Worker' }
        });
        
        if (checkRes.ok) {
            return new Response(JSON.stringify({ 
                success: true, 
                url: `${BASE_URL}/${path}`,
                cached: true
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (checkRes.status !== 404) {
            let msg = `GitHub check failed (${checkRes.status})`;
            try {
                const d = await checkRes.json();
                if (d && d.message) msg = d.message;
            } catch {}
            return new Response(JSON.stringify({ success: false, error: msg }),
                { status: 502, headers: { 'Content-Type': 'application/json' } });
        }
        
        // Upload new file
        const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'CF-Worker' },
            body: JSON.stringify({ message: `Upload ${uniqueFilename}`, content })
        });

        let data = {};
        try {
            data = await res.json();
        } catch {}
        
        if (res.ok) {
            return new Response(JSON.stringify({ 
                success: true, 
                url: `${BASE_URL}/${path}`
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Race condition: file may have been created after our existence check.
        if (res.status === 422 && typeof data.message === 'string' && data.message.toLowerCase().includes('already exists')) {
            return new Response(JSON.stringify({
                success: true,
                url: `${BASE_URL}/${path}`,
                cached: true
            }), { headers: { 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ success: false, error: data.message || 'Upload failed' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
