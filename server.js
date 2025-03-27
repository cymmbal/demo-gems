const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

// Define MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
    '.gem': 'application/octet-stream'
};

const server = http.createServer((req, res) => {
    console.log('Request:', req.url);

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Health check endpoint for Render
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy' }));
        return;
    }

    // Handle root path and /warp/XX paths
    if (req.url === '/' || req.url.match(/^\/warp\/\d+$/)) {
        req.url = '/index.html';
    }

    // Remove query strings from URL
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = parsedUrl.pathname;

    // Resolve file path
    let filePath = path.join(process.cwd(), pathname.substring(1));

    // Special handling for shared_js files
    if (pathname.startsWith('/shared_js/')) {
        const filename = path.basename(pathname);
        // Try both the direct path and the source path
        const paths = [
            path.join(process.cwd(), 'shared_js', filename),
            path.join(process.cwd(), 'gem-viewer', 'src', 'shared_js', filename)
        ];

        // Find the first path that exists
        filePath = paths.find(p => fs.existsSync(p)) || filePath;
        console.log('Resolved shared_js path:', filePath);
    }

    // Get file extension and content type
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read and serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                console.error('File not found:', filePath);
                res.writeHead(404);
                res.end('File not found');
            } else {
                console.error('Server error:', error);
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            console.log('Serving static file:', filePath, 'Content-Type:', contentType);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Error handling for server
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    
    // Log environment info
    console.log('Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        PORT: PORT,
        PWD: process.cwd(),
        Platform: process.platform,
        'Node.js Version': process.version
    });
}); 