/**
 * Controls camera drift based on mouse position or device motion
 */
export class DriftControl {
    constructor(cameraViewModel, canvas, options = {}) {
        this.cameraViewModel = cameraViewModel;
        this.canvas = canvas;
        // More comprehensive iOS detection
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // CRITICAL UPDATE: Always use 15 degrees, completely ignore the passed options
        // This version was updated on: March 31, 2024
        this.options = {
            // Hardcode to 15 degrees, completely ignoring any options
            maxRotationDrift: 15,
            invertRotationDrift: options.invertRotationDrift || false
        };
        
        console.log('UPDATED DRIFTCONTROL.JS - Using fixed 15 degree rotation');

        this.enabled = true;
        this._driftHandler = null;
        this._motionHandler = null;
        this._orientationHandler = null;
        this._permissionOverlay = null;
        this._motionDetectionTimer = null;
        this._motionDetected = false;
        
        // Motion control state
        this.initialOrientation = null;
        this.maxRotationAngle = 45; // Maximum physical device rotation to map to maxRotationDrift
        this.hasMotionPermission = true; // Always set to true to skip permission
        this.screenOrientation = window.orientation || 0;

        // Orbit control state for desktop
        this.orbitControl = {
            baseTheta: 0,  // Base horizontal rotation
            basePhi: Math.PI/2,  // Base vertical rotation (90 degrees to face forward)
            hoverOffset: 0,  // Current hover-based offset
            radius: 0  // Current camera distance from origin
        };

        this.init();
    }

    /**
     * Convert degrees to radians
     */
    degreesToRadians(degrees) {
        return -degrees * Math.PI / 180;
    }

    /**
     * Quaternion multiplication
     */
    multiplyQuaternions(a, b) {
        return {
            w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
            x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
            y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
            z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
        };
    }

    /**
     * Create rotation quaternion from axis and angle
     */
    axisAngleToQuaternion(axis, angle) {
        const halfAngle = angle / 2;
        const s = Math.sin(halfAngle);
        return {
            w: Math.cos(halfAngle),
            x: axis.x * s,
            y: axis.y * s,
            z: axis.z * s
        };
    }

    /**
     * Rotate a point using a quaternion
     */
    rotatePointWithQuaternion(point, q) {
        // Convert point to quaternion
        const p = {
            w: 0,
            x: point.x,
            y: point.y,
            z: point.z
        };

        // Calculate conjugate
        const qConjugate = {
            w: q.w,
            x: -q.x,
            y: -q.y,
            z: -q.z
        };

        // Rotate using p' = qpq*
        const rotated = this.multiplyQuaternions(
            this.multiplyQuaternions(q, p),
            qConjugate
        );

        return {
            x: rotated.x,
            y: rotated.y,
            z: rotated.z
        };
    }

    /**
     * Initialize drift control
     */
    init() {
        // Create bound handler that we can reference later for cleanup
        this._driftHandler = (e) => {
            if (this.enabled) {
                this.apply(e.clientX, e.clientY);
            }
        };

        // Bind the handler
        this.canvas.addEventListener('pointermove', this._driftHandler);
    }

    /**
     * Test if motion data is actually being received
     */
    testMotionData() {
        // Clear any existing timer
        if (this._motionDetectionTimer) {
            clearTimeout(this._motionDetectionTimer);
        }
        
        // Reset detection flag
        this._motionDetected = false;
        
        // Set up a timer to check if motion is detected within 2 seconds
        this._motionDetectionTimer = setTimeout(() => {
            if (!this._motionDetected) {
                console.log('No motion data detected, showing permission overlay');
                // No motion detected after timeout, show the overlay
                localStorage.removeItem('motionPermissionGranted');
                this.hasMotionPermission = false;
                this.createPermissionOverlay();
            }
        }, 2000);
    }

    /**
     * Create and show permission overlay
     */
    createPermissionOverlay() {
        this._permissionOverlay = document.getElementById('panel-overlay');
        if (!this._permissionOverlay) return;
        
        this._permissionOverlay.style.visibility = 'visible';
        this._permissionOverlay.style.opacity = '1';
        this._permissionOverlay.style.pointerEvents = 'auto';

        const requestMotionPermission = async () => {
            try {
                if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                console.log('Permission response:', permissionState);
                if (permissionState === 'granted') {
                        localStorage.setItem('motionPermissionGranted', 'true');
                        this.hasMotionPermission = true;
                        this.initOrientationHandler();
                        // Test if motion is actually working after permission
                        this.testMotionData();
                    }
                } else {
                    // For devices that don't require explicit permission
                    localStorage.setItem('motionPermissionGranted', 'true');
                    this.hasMotionPermission = true;
                    this.initOrientationHandler();
                    // Test if motion is actually working
                    this.testMotionData();
                }
            } catch (error) {
                console.error('Error requesting motion permission:', error);
            }
            
            // Hide overlay regardless of outcome
            this._permissionOverlay.style.visibility = 'hidden';
            this._permissionOverlay.style.opacity = '0';
            this._permissionOverlay.style.pointerEvents = 'none';
            this._permissionOverlay.removeEventListener('click', handleClick);
        };

        const handleClick = () => {
            // Remove the click listener immediately to prevent double-clicks
            this._permissionOverlay.removeEventListener('click', handleClick);
            // Request permission in direct response to click
            requestMotionPermission();
        };

        this._permissionOverlay.addEventListener('click', handleClick);
    }

    /**
     * Initialize orientation handler for mobile devices
     */
    initOrientationHandler() {
        // Clean up any existing handlers
        if (this._orientationHandler) {
            window.removeEventListener('deviceorientation', this._orientationHandler);
        }

        // Create new orientation handler
        this._orientationHandler = (e) => {
            if (!this.enabled) return;
            
            // Get orientation data
            const { beta, gamma } = e;
            if (beta === null || gamma === null) return;
            
            // Mark that motion data has been detected
            this._motionDetected = true;
            
            // Initialize reference orientation if needed
            if (!this.initialOrientation) {
                this.initialOrientation = { beta, gamma };
                return;
            }
            
            // Calculate relative rotation from initial position
            let deltaGamma = gamma - this.initialOrientation.gamma;
            let deltaBeta = beta - this.initialOrientation.beta;
            
            // Adjust for screen orientation
            if (this.screenOrientation === 90) {
                [deltaGamma, deltaBeta] = [-deltaBeta, deltaGamma];
            } else if (this.screenOrientation === -90) {
                [deltaGamma, deltaBeta] = [deltaBeta, -deltaGamma];
            } else if (this.screenOrientation === 180) {
                [deltaGamma, deltaBeta] = [-deltaGamma, -deltaBeta];
            }
            
            // Normalize rotations to our desired range
            const horizontalValue = Math.max(-1, Math.min(1, deltaGamma / this.maxRotationAngle));
            const verticalValue = Math.max(-1, Math.min(1, deltaBeta / this.maxRotationAngle));
            
            // Apply the normalized rotations
            this.applyNormalizedRotations(horizontalValue, verticalValue);
        };

        // Bind the handler
        window.addEventListener('deviceorientation', this._orientationHandler);
    }

    /**
     * Clean up event listeners
     */
    cleanup() {
        if (this._driftHandler) {
            this.canvas.removeEventListener('pointermove', this._driftHandler);
            this._driftHandler = null;
        }
        
        if (this._orientationHandler) {
            window.removeEventListener('deviceorientation', this._orientationHandler);
            this._orientationHandler = null;
        }

        window.removeEventListener('orientationchange', this._orientationChangeHandler);
        
        // Clear motion detection timer
        if (this._motionDetectionTimer) {
            clearTimeout(this._motionDetectionTimer);
            this._motionDetectionTimer = null;
        }
    }

    /**
     * Enable/disable drift control
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled && this.isIOS && !this.initialOrientation) {
            // Re-initialize identity when re-enabling
            this.initialOrientation = null;
        }
    }

    /**
     * Apply hover-based drift control to the camera orbit
     */
    apply(mouseX, mouseY) {
        if (!this.cameraViewModel) return;
        
        // Get canvas dimensions and center
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Calculate deltas from center (-1 to 1)
        const deltaX = (mouseX - centerX) / (rect.width / 2);
        const deltaY = (mouseY - centerY) / (rect.height / 2);
        
        // Clamp deltas to -1 to 1 and invert vertical
        const clampedDeltaX = Math.max(-1, Math.min(1, deltaX));
        const clampedDeltaY = -Math.max(-1, Math.min(1, deltaY));
        
        // Apply both rotations
        this.applyNormalizedRotations(clampedDeltaX, clampedDeltaY);
    }

    /**
     * Apply normalized rotation values (-1...1) to the camera for both axes
     */
    applyNormalizedRotations(horizontalValue, verticalValue) {
        if (!this.cameraViewModel) return;
        
        // Get current camera radius
        const currentPos = this.cameraViewModel.position;
        const radius = Math.sqrt(
            currentPos.x * currentPos.x +
            currentPos.y * currentPos.y +
            currentPos.z * currentPos.z
        );

        if (this.isIOS) {
            // Mobile: Only horizontal rotation, keep camera at horizontal plane
            const horizontalAngle = this.degreesToRadians(horizontalValue * this.options.maxRotationDrift);
            const phi = Math.PI/2; // Keep camera at horizontal plane
            
            // Calculate new position using spherical coordinates
            const sinPhi = Math.sin(phi); // Will be 1 since phi is π/2
            const position = {
                x: radius * Math.sin(horizontalAngle),
                y: 0, // Keep at horizontal plane
                z: radius * Math.cos(horizontalAngle)
            };

            // Update camera position
            this.cameraViewModel.position = position;

            // Calculate look-at rotation (always looking at origin)
            const direction = {
                x: -position.x,
                y: 0, // Keep level
                z: -position.z
            };

            // Normalize direction
            const length = Math.sqrt(
                direction.x * direction.x +
                direction.z * direction.z // Only need x and z since y is 0
            );

            direction.x /= length;
            direction.z /= length;

            // Convert to Euler angles for the camera
            this.cameraViewModel.rotation = {
                x: 0, // Keep level
                y: Math.atan2(direction.x, direction.z),
                z: 0
            };
        } else {
            // Desktop: Apply hover-based offset to base rotation
            // Convert mouse delta to rotation offset in radians
            const hoverOffset = this.degreesToRadians(horizontalValue * this.options.maxRotationDrift);
            const verticalOffset = this.degreesToRadians(verticalValue * this.options.maxRotationDrift);

            // Update base rotation with hover offset
            this.orbitControl.baseTheta = hoverOffset;
            this.orbitControl.basePhi = Math.PI/2 + verticalOffset; // Add vertical offset to base 90-degree angle

            // Calculate new position using spherical coordinates
            const position = {
                x: -radius * Math.sin(this.orbitControl.basePhi) * Math.sin(this.orbitControl.baseTheta),
                y: radius * Math.cos(this.orbitControl.basePhi),
                z: radius * Math.sin(this.orbitControl.basePhi) * Math.cos(this.orbitControl.baseTheta)
            };

            // Update camera position
            this.cameraViewModel.position = position;

            // Calculate look-at rotation (always looking at origin)
            const direction = {
                x: -position.x,
                y: -position.y,
                z: -position.z
            };

            // Normalize direction
            const length = Math.sqrt(
                direction.x * direction.x +
                direction.y * direction.y +
                direction.z * direction.z
            );

            direction.x /= length;
            direction.y /= length;
            direction.z /= length;

            // Convert to Euler angles for the camera
            this.cameraViewModel.rotation = {
                x: Math.asin(-direction.y),
                y: Math.atan2(direction.x, direction.z),
                z: 0
            };
        }
    }
} 