export async function onRequest({ params, env }) {
    const TOKEN = env.GITHUB_TOKEN;
    const REPO = env.GITHUB_REPO;
    const filename = params.file;

    // Allow files created by the uploader: 12-hex hash + whitelisted ext.
    if (typeof filename !== 'string' || !/^[a-f0-9]{12}\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|json|xml|html|css|js|zip|rar|7z|tar|gz|mp4|mp3|wav|avi|mov|md|rtf)$/i.test(filename)) {
        return new Response('Not found', { status: 404 });
    }
    
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/public/${filename}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'CF-Worker', 'Accept': 'application/vnd.github.raw' }
    });
    
    if (!res.ok) return new Response('Not found', { status: 404 });
    
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain', 'csv': 'text/csv', 'json': 'application/json',
        'xml': 'application/xml', 'html': 'text/html', 'css': 'text/css', 'js': 'application/javascript',
        'zip': 'application/zip', 'rar': 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar', 'gz': 'application/gzip',
        'mp4': 'video/mp4', 'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'avi': 'video/x-msvideo', 'mov': 'video/quicktime',
        'md': 'text/markdown', 'rtf': 'application/rtf'
    };
    
    return new Response(res.body, {
        headers: {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff'
        }
    });
}
