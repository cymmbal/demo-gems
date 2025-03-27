/**
 * Controls camera drift based on mouse position or device motion
 */
export class DriftControl {
    constructor(cameraViewModel, canvas, options = {}) {
        this.cameraViewModel = cameraViewModel;
        this.canvas = canvas;
        // More comprehensive iOS detection
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        this.options = {
            maxRotationDrift: this.isIOS ? 20 : (options.maxRotationDrift || 15), // 30 degrees for mobile, default 15 for desktop
            invertRotationDrift: options.invertRotationDrift || false
        };

        this.enabled = true;
        this._driftHandler = null;
        this._motionHandler = null;
        this._permissionOverlay = null;
        
        // Motion control state
        this.identityRotation = null;
        this.maxRotationAngle = 45; // Maximum physical device rotation to map to maxRotationDrift
        this.hasMotionPermission = localStorage.getItem('motionPermissionGranted') === 'true';

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
        if (this.isIOS) {
            if (typeof DeviceMotionEvent?.requestPermission === 'function') {
                if (!this.hasMotionPermission) {
                    console.log('Showing permission overlay - no permission yet');
                    this.createPermissionOverlay();
                } else {
                    console.log('Permission already granted, initializing motion handler');
                    this.initMotionHandler();
                }
            } else {
                console.log('No permission needed, initializing motion handler directly');
                this.initMotionHandler();
            }
        } else {
            // Create bound handler that we can reference later for cleanup
            this._driftHandler = (e) => {
                if (this.enabled) {
                    this.apply(e.clientX, e.clientY);
                }
            };

            // Bind the handler
            this.canvas.addEventListener('pointermove', this._driftHandler);
        }
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
                const permissionState = await window.DeviceMotionEvent.requestPermission();
                console.log('Permission response:', permissionState);
                if (permissionState === 'granted') {
                    localStorage.setItem('motionPermissionGranted', 'true');
                    this.hasMotionPermission = true;
                    this.initMotionHandler();
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
     * Initialize motion handler for iOS
     */
    initMotionHandler() {
        // Clean up any existing motion handler
        if (this._motionHandler) {
            window.removeEventListener('devicemotion', this._motionHandler);
        }

        // Create new motion handler
        this._motionHandler = (e) => {
            if (!this.enabled) return;
            
            // Get rotation rate data
            const rotationRate = e.rotationRate;
            if (!rotationRate) return;
            
            // Initialize identity rotation if needed
            if (!this.identityRotation && rotationRate.beta && rotationRate.gamma) {
                this.identityRotation = {
                    beta: rotationRate.beta,
                    gamma: rotationRate.gamma
                };
                return;
            }
            
            if (this.identityRotation && rotationRate.beta && rotationRate.gamma) {
                // Calculate deltas from identity
                const deltaX = (rotationRate.gamma - this.identityRotation.gamma) / this.maxRotationAngle;
                const deltaY = (rotationRate.beta - this.identityRotation.beta) / this.maxRotationAngle;
                
                // Apply rotations with deltas clamped to -1 to 1
                this.applyNormalizedRotations(
                    Math.max(-1, Math.min(1, deltaX)),
                    Math.max(-1, Math.min(1, deltaY))
                );
            }
        };

        // Simply add the event listener - permission should be granted at this point
        window.addEventListener('devicemotion', this._motionHandler);
    }

    /**
     * Clean up event listeners and handlers
     */
    cleanup() {
        if (this._driftHandler) {
            this.canvas.removeEventListener('pointermove', this._driftHandler);
            this._driftHandler = null;
        }
        if (this._motionHandler) {
            window.removeEventListener('devicemotion', this._motionHandler);
            this._motionHandler = null;
        }
        // Reset identity rotation when cleaning up
        this.identityRotation = null;
        
        // Remove permission overlay if it exists
        if (this._permissionOverlay) {
            this._permissionOverlay.style.visibility = 'hidden';
            this._permissionOverlay.style.opacity = '0';
            this._permissionOverlay.style.pointerEvents = 'none';
        }
    }

    /**
     * Enable/disable drift control
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled && this.isIOS && !this.identityRotation) {
            // Re-initialize identity when re-enabling
            this.identityRotation = null;
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