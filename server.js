const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.gem': 'application/octet-stream',
    '.png': 'image/png'
};

const server = http.createServer((req, res) => {
    console.log('Request:', req.url);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Handle root path
    if (req.url === '/') {
        req.url = '/warp/21';
    }

    // Handle /warp/XX paths
    if (req.url.match(/^\/warp\/\d+$/)) {
        req.url = '/index.html';
    }

    // Get the file path, removing any /warp/ prefix from non-HTML requests
    let filePath = '.' + req.url;
    if (!req.url.endsWith('.html')) {
        filePath = '.' + req.url.replace(/^\/warp\//, '/');
    }
    
    // Special handling for shared_js files
    if (filePath.includes('/shared_js/')) {
        // Try to find the actual file with correct case
        const dir = './shared_js';
        try {
            const files = fs.readdirSync(dir);
            const requestedFile = path.basename(filePath).toLowerCase();
            const matchingFile = files.find(f => f.toLowerCase() === requestedFile);
            if (matchingFile) {
                filePath = path.join(dir, matchingFile);
                console.log('Found matching file:', filePath);
            }
        } catch (err) {
            console.log('Error reading shared_js directory:', err);
        }
    }

    // Get the file extension
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read and serve the file
    console.log('Serving static file:', filePath, 'Content-Type:', contentType);
    fs.readFile(filePath, (error, content) => {
        if (error) {
            console.error('Error reading file:', filePath, error);
            if(error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Use PORT from environment variable or fallback to 8000
const port = process.env.PORT || 8000;

// Start the server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
}); 