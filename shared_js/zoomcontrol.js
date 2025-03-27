/**
 * Controls camera zoom based on screen size
 */
export class ZoomControl {
    constructor(cameraViewModel, options = {}) {
        this.cameraViewModel = cameraViewModel;
        this.options = {
            mobileWidth: 1024,
            mobilePosition: 4000,
            maxZoom: .675,
            desktopPosition: 2500,
            debounceDelay: 250,
            minWheelThreshold: 5, // Minimum wheel delta required to trigger zoom
            ...options
        };

        this._resizeHandler = null;
        this._wheelHandler = null;
        this._gestureHandler = null;
        this._debounceTimer = null;
        this._wheelDebounceTimer = null;
        this.zoomLevel = 0; // 0 = base, 1 = first zoom, 2 = max zoom
        this.lastWheelTime = 0;
        this.lastWheelDirection = 0; // -1 for up, 1 for down, 0 for none
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        // Create bound handler that we can reference later for cleanup
        this._resizeHandler = () => {
            // Clear previous debounce timer
            clearTimeout(this._debounceTimer);
            
            // Set a new debounce timer
            this._debounceTimer = setTimeout(() => {
                this.apply();
            }, this.options.debounceDelay);
        };

        // Create wheel handler for desktop
        this._wheelHandler = (e) => {
            if (!this.cameraViewModel || this.isIOS) return;

            // Prevent default wheel behavior
            // e.preventDefault();

            // Check if wheel movement exceeds threshold
            if (Math.abs(e.deltaY) < this.options.minWheelThreshold) {
                return;
            }

            // Debounce wheel events
            const now = Date.now();
            if (now - this.lastWheelTime < this.options.debounceDelay) {
                return;
            }

            // Get current wheel direction
            const currentDirection = e.deltaY < 0 ? 1 : -1;

            // Update last wheel time
            this.lastWheelTime = now;

            this.handleZoom(currentDirection);
        };

        // Create gesture handler for iOS pinch
        this._gestureHandler = (e) => {
            if (!this.cameraViewModel || !this.isIOS) return;

            // Prevent default gesture behavior
            e.preventDefault();

            // Debounce gesture events
            const now = Date.now();
            if (now - this.lastWheelTime < this.options.debounceDelay) {
                return;
            }

            // Get gesture direction (negative scale = pinch in, positive = pinch out)
            const currentDirection = e.scale < 1 ? 1 : -1;

            // Update last wheel time
            this.lastWheelTime = now;

            this.handleZoom(currentDirection);
        };

        // Bind the handlers
        window.addEventListener('resize', this._resizeHandler);
        window.addEventListener('wheel', this._wheelHandler);
        if (this.isIOS) {
            window.addEventListener('gesturechange', this._gestureHandler);
        }
        
        // Initial position setting
        this.apply();
    }

    /**
     * Handle zoom action for both wheel and gesture events
     */
    handleZoom(currentDirection) {
        // Get current camera direction (normalized)
        const currentPos = this.cameraViewModel.currentPosition;
        const distance = Math.sqrt(
            currentPos.x * currentPos.x +
            currentPos.y * currentPos.y +
            currentPos.z * currentPos.z
        );

        // Determine if we should zoom in or out based on direction
        const shouldZoomIn = currentDirection < 0;
        const shouldZoomOut = currentDirection > 0;

        // Get the base distance (either mobile or desktop)
        const isMobile = window.innerWidth < this.options.mobileWidth;
        const baseDistance = isMobile ? this.options.mobilePosition : this.options.desktopPosition;

        // Calculate new zoom level - only change by 1 step
        let newZoomLevel = this.zoomLevel;
        if (shouldZoomIn && this.zoomLevel < 2) {
            newZoomLevel = this.zoomLevel + 1;
        } else if (shouldZoomOut && this.zoomLevel > 0) {
            newZoomLevel = this.zoomLevel - 1;
        } else {
            // No change needed
            return;
        }

        // Calculate zoom multiplier based on level
        // Level 0 = 1.0 (base)
        // Level 1 = maxZoom
        // Level 2 = maxZoom * maxZoom
        const zoomMultiplier = Math.pow(this.options.maxZoom, newZoomLevel);
        const newDistance = baseDistance * zoomMultiplier;

        // Update zoom level
        this.zoomLevel = newZoomLevel;

        // Calculate normalized direction
        const direction = {
            x: currentPos.x / distance,
            y: currentPos.y / distance,
            z: currentPos.z / distance
        };

        // Set new position maintaining direction but updating distance
        this.cameraViewModel.position = {
            x: direction.x * newDistance,
            y: direction.y * newDistance,
            z: direction.z * newDistance
        };
    }

    /**
     * Clean up event listeners and references
     */
    cleanup() {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
        
        if (this._wheelHandler) {
            window.removeEventListener('wheel', this._wheelHandler);
            this._wheelHandler = null;
        }

        if (this._gestureHandler) {
            window.removeEventListener('gesturechange', this._gestureHandler);
            this._gestureHandler = null;
        }
        
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        // Clear reference to view model
        this.cameraViewModel = null;
    }

    /**
     * Apply zoom based on screen size
     */
    apply() {
        if (!this.cameraViewModel) return;

        const isMobile = window.innerWidth < this.options.mobileWidth;
        const targetDistance = isMobile ? this.options.mobilePosition : this.options.desktopPosition;

        // Get current camera direction (normalized)
        const currentPos = this.cameraViewModel.currentPosition;
        const distance = Math.sqrt(
            currentPos.x * currentPos.x +
            currentPos.y * currentPos.y +
            currentPos.z * currentPos.z
        );

        // If distance is zero, set a default forward-facing position
        if (distance === 0) {
            this.cameraViewModel.position = {
                x: 0,
                y: 0,
                z: targetDistance
            };
            return;
        }

        // Calculate normalized direction
        const direction = {
            x: currentPos.x / distance,
            y: currentPos.y / distance,
            z: currentPos.z / distance
        };

        // Set new position maintaining direction but updating distance
        this.cameraViewModel.position = {
            x: direction.x * targetDistance,
            y: direction.y * targetDistance,
            z: direction.z * targetDistance
        };
    }
} 