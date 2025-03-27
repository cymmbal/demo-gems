const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    console.log('Request:', req.url);

    // Handle static files
    if (req.url.includes('.')) {
        // Remove /warp/ prefix if present and normalize the path
        let filePath = '.' + req.url.replace(/^\/warp\/\d+\//, '/');
        
        // Handle absolute paths
        if (filePath.startsWith('./')) {
            filePath = '.' + filePath.substring(1);
        }

        const extname = path.extname(filePath);
        let contentType = 'text/html';
        
        switch (extname) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.jpg':
                contentType = 'image/jpg';
                break;
            case '.gem':
                contentType = 'application/octet-stream';
                break;
        }

        console.log('Serving static file:', filePath, 'Content-Type:', contentType);

        fs.readFile(filePath, (error, content) => {
            if (error) {
                console.error('Error reading file:', filePath, error);
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    // Handle routes
    if (req.url.startsWith('/warp/')) {
        fs.readFile('./index.html', (error, content) => {
            if (error) {
                console.error('Error reading index.html:', error);
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            } else {
                res.writeHead(200, { 
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(content, 'utf-8');
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// Use PORT from environment variable or fallback to 8000
const port = process.env.PORT || 8000;

// Start the server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
}); 