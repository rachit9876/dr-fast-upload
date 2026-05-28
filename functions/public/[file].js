export async function onRequest({ params, env }) {
    const filename = params.file;
    
    // Fetch raw file from GitHub
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/public/${filename}`, {
        headers: { 
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
            'User-Agent': 'MinUploader', 
            'Accept': 'application/vnd.github.raw' 
        }
    });
    
    if (!res.ok) return new Response('File Not Found', { status: 404 });
    
    // Basic MIME type mapping based on extension
    const ext = filename.split('.').pop().toLowerCase();
    const mimes = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 
        'webp': 'image/webp', 'pdf': 'application/pdf', 'txt': 'text/plain', 'json': 'application/json'
    };
    
    return new Response(res.body, {
        headers: {
            'Content-Type': mimes[ext] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*'
        }
    });
}