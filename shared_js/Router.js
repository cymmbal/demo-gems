export class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            this.handleRoute(window.location.pathname);
        });

        // Handle initial route
        this.handleRoute(window.location.pathname);
    }

    // Add a route handler
    addRoute(path, handler) {
        this.routes.set(path, handler);
    }

    // Handle a route change
    handleRoute(path) {
        // If no path or root path, default to WARP21
        if (!path || path === '/') {
            this.navigate('/warp/21');
            return;
        }

        // Extract gem number from path (e.g., /warp/21 -> 21)
        const match = path.match(/\/warp\/(\d+)/);
        if (match) {
            const gemNumber = match[1];
            const handler = this.routes.get('/warp');
            if (handler) {
                handler(gemNumber);
            }
        }
    }

    // Navigate to a new route
    navigate(path) {
        window.history.pushState({}, '', path);
        this.handleRoute(path);
    }

    // Get current gem number from URL
    getCurrentGemNumber() {
        const match = window.location.pathname.match(/\/warp\/(\d+)/);
        return match ? match[1] : '21'; // Default to 21 if no match
    }
} 