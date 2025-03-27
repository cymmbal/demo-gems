const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.gem': 'application/octet-stream'
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

    // Get the file path
    let filePath = '.' + req.url.replace(/^\/warp\/\d+/, '');
    
    // Special handling for shared_js files
    if (filePath.includes('/shared_js/')) {
        // Convert the filename to the correct case
        const filename = path.basename(filePath);
        const dirname = path.dirname(filePath);
        
        // Map of correct filenames
        const fileMap = {
            'baseviewmodel.js': 'BaseViewModel.js',
            'cameraviewmodel.js': 'CameraViewModel.js',
            'driftcontrol.js': 'DriftControl.js',
            'gemviewmodel.js': 'GemViewModel.js',
            'gemplayer.js': 'GemPlayer.js',
            'rotationcontrol.js': 'RotationControl.js',
            'router.js': 'Router.js',
            'runtime.js': 'runtime.js',
            'themecolor.js': 'ThemeColor.js',
            'themecontent.js': 'ThemeContent.js',
            'viewstate.js': 'ViewState.js',
            'zoomcontrol.js': 'ZoomControl.js'
        };

        const correctFilename = fileMap[filename.toLowerCase()] || filename;
        filePath = path.join('.', 'shared_js', correctFilename);
        
        // Log the resolved path
        console.log('Resolved path:', filePath);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.log('File not found at:', filePath);
            // Try alternate path
            const alternatePath = path.join('.', 'gem-viewer', 'src', 'shared_js', correctFilename);
            console.log('Trying alternate path:', alternatePath);
            if (fs.existsSync(alternatePath)) {
                filePath = alternatePath;
                console.log('Found file at alternate path');
            }
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