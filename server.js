const http = require('http');
const fs = require('fs');
const path = require('path');

// Add a file cache to store loaded gem files
const fileCache = {};

// Preload gem files to ensure consistent performance
function preloadGemFiles() {
    const gemFiles = [
        // Load WARP21 first as it's the default/most frequently accessed gem
        './assets/gems/aphex-twin-selected-ambient-works-ii.gem',
        './assets/gems/flying-lotus-cosmogramma.gem',
        './assets/gems/one-oh-trix-point-never-magic-otp.gem'
    ];
    
    gemFiles.forEach(filePath => {
        try {
            console.log('Preloading gem file:', filePath);
            const content = fs.readFileSync(filePath);
            fileCache[filePath] = content;
            console.log('Successfully cached:', filePath, `(${content.length} bytes)`);
        } catch (error) {
            console.error('Error preloading gem file:', filePath, error);
        }
    });
}

// Preload gem files at startup
preloadGemFiles();

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.gem': 'application/octet-stream',
    '.png': 'image/png'
};

// Add Date.now() as a query parameter to bust caches
function processTemplate(content, contentType) {
  if (contentType === 'text/html') {
    // Simple template processing for cache busting
    return content.replace(/<%=Date\.now\(\)%>/g, Date.now());
  }
  return content;
}

const server = http.createServer((req, res) => {
    // Log the request with timestamp
    const timestamp = new Date().toISOString().slice(11, 23);
    console.log(`[${timestamp}] Request:`, req.url);

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

    // Remove any query parameters from the file path
    filePath = filePath.split('?')[0];
    
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

    // Set up response headers with caching directives
    const headers = { 'Content-Type': contentType };
    
    // Disable caching for JS files for easier testing in local development
    if (extname === '.js') {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
        
        // Force rewriting the URL with a cache-busting parameter
        if (req.url.indexOf('?') === -1) {
            const cacheBuster = Date.now();
            const newUrl = `${req.url}?v=${cacheBuster}`;
            console.log(`Redirecting JS request to: ${newUrl}`);
            res.writeHead(302, { 'Location': newUrl });
            res.end();
            return;
        }
    } else if (extname === '.gem') {
        // Cache gem files for 1 year (31536000 seconds)
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        headers['Expires'] = new Date(Date.now() + 31536000 * 1000).toUTCString();
        headers['ETag'] = `"${path.basename(filePath)}-v1"`; // Simple ETag
    } else {
        // Short cache for other files
        headers['Cache-Control'] = 'public, max-age=3600'; // 1 hour
    }

    // Special handling for gem files - prioritize cached versions
    if (extname === '.gem') {
        // Check if this file is in cache
        if (fileCache[filePath]) {
            console.log(`[${timestamp}] Serving cached gem file:`, filePath, `(${fileCache[filePath].length} bytes)`);
            res.writeHead(200, headers);
            res.end(fileCache[filePath]);
            return;
        }
    }
    
    // Check if any file is in cache
    if (fileCache[filePath]) {
        console.log(`[${timestamp}] Serving cached file:`, filePath);
        res.writeHead(200, headers);
        res.end(fileCache[filePath]);
        return;
    }

    // Read and serve the file
    console.log('Serving static file:', filePath, 'Content-Type:', contentType);

    // Handle HTML files with template processing
    if (contentType === 'text/html') {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file ${filePath}: ${err.message}`);
                res.writeHead(500);
                res.end(`Server Error: Unable to read file ${filePath}`);
                return;
            }

            // Process template tags in HTML files
            const processedData = processTemplate(data, contentType);
            
            res.writeHead(200, headers);
            res.end(processedData);
        });
    } else {
        // For binary files and other non-HTML content
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.error(`Error reading file ${filePath}: ${err.message}`);
                res.writeHead(500);
                res.end(`Server Error: Unable to read file ${filePath}`);
                return;
            }
            
            // Cache gem files and other large resources
            const isGemFile = extname === '.gem';
            const isImportantResource = isGemFile || filePath.includes('runtime.js');
            
            if (isImportantResource) {
                console.log(`Caching file: ${filePath} (${data.length} bytes)`);
                fileCache[filePath] = data;
            }
            
            res.writeHead(200, headers);
            res.end(data);
        });
    }
});

// Use PORT from environment variable or fallback to 8000
const port = process.env.PORT || 8000;

// Start the server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
}); 