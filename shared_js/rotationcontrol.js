/**
 * Controls gem rotation based on user interaction
 */
export class RotationControl {
    constructor(gemViewModel, canvas, options = {}) {
        this.gemViewModel = gemViewModel;
        this.canvas = canvas;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // Add mobile sensitivity multiplier
        this.mobileSensitivityMultiplier = 1.22;

        // Track active pointers for iOS
        this.activePointers = new Set();

        this.options = {
            sensitivity: (this.isIOS ? this.mobileSensitivityMultiplier : 1) * (options.sensitivity || GemPlayer.Constants.ROTATION_SENSITIVITY),
            dragEasing: (this.isIOS ? this.mobileSensitivityMultiplier : 1) * (options.dragEasing || 0.9),
            verticalLimit: options.verticalLimit || 45,
            threshold: options.threshold || 0.001,
            autoRotateDelay: options.autoRotateDelay || 1000,
            autoRotateDuration: options.autoRotateDuration || 2000,
            invertRotation: options.invertRotation || false
        };

        // State
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.targetRotation = { x: 0, y: 0, z: 0 };
        this.currentRotation = { x: 0, y: 0, z: 0 };
        this.isAnimating = false;
        this.animationFrameId = null;
        this.hasManualRotation = false;
        this.autoRotateTimer = null;
        this.isAutoRotating = false;
        this.originalRotation = { x: 0, y: 0, z: 0 };

        this.init();
    }

    /**
     * Initialize rotation control
     */
    init() {

        // Mouse events
        this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('pointerleave', this.handlePointerLeave.bind(this));
    }

    /**
     * Clean up rotation control
     */
    cleanup() {
        this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
        this.canvas.removeEventListener('pointermove', this.handlePointerMove);
        this.canvas.removeEventListener('pointerup', this.handlePointerUp);
        this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.autoRotateTimer) {
            clearTimeout(this.autoRotateTimer);
            this.autoRotateTimer = null;
        }

        // Clear pointer tracking
        this.activePointers.clear();
    }

    /**
     * Handle pointer down event
     */
    handlePointerDown(e) {
        // On iOS, track pointer and cancel if multiple pointers detected
        if (this.isIOS) {
            this.activePointers.add(e.pointerId);
            if (this.activePointers.size > 1) {
                // Multiple pointers detected, cancel rotation
                this.handlePointerUp();
                return;
            }
        }

        this.isDragging = true;
        this.previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };

        // Clear auto-rotation timer and stop auto-rotation if active
        if (this.autoRotateTimer) {
            clearTimeout(this.autoRotateTimer);
            this.autoRotateTimer = null;
        }
        this.isAutoRotating = false;

        // Dispatch event for other controls
        this.canvas.dispatchEvent(new CustomEvent('rotationstart'));
    }

    /**
     * Normalize angle to be between -180 and 180 degrees
     */
    normalizeAngle(angle) {
        // Convert to degrees for easier math
        let degrees = (angle * 180 / Math.PI) % 360;
        if (degrees > 180) degrees -= 360;
        if (degrees < -180) degrees += 360;
        return degrees * Math.PI / 180;
    }

    /**
     * Handle pointer move event
     */
    handlePointerMove(e) {
        if (!this.isDragging) return;

        // On iOS, cancel if multiple pointers detected
        if (this.isIOS && this.activePointers.size > 1) {
            this.handlePointerUp();
            return;
        }

        const deltaMove = {
            x: e.clientX - this.previousMousePosition.x,
            y: e.clientY - this.previousMousePosition.y
        };

        // Update target rotation values - allow accumulation during drag
        this.targetRotation.y += deltaMove.x * this.options.sensitivity * 0.01;
        
        // Calculate new target x rotation with vertical limit
        const newTargetX = this.targetRotation.x + deltaMove.y * this.options.sensitivity * 0.01;
        const verticalLimitRadians = (this.options.verticalLimit * Math.PI) / 180;
        
        // Limit the vertical rotation
        this.targetRotation.x = Math.max(
            -verticalLimitRadians,
            Math.min(verticalLimitRadians, newTargetX)
        );

        // Update previous position
        this.previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };

        // Mark that user has manually rotated the gem
        this.hasManualRotation = true;

        // Start animation if not already running
        if (!this.isAnimating) {
            this.startRotationAnimation();
        }
    }

    /**
     * Handle pointer up event
     */
    handlePointerUp(e) {
        // On iOS, remove pointer from tracking
        if (this.isIOS && e) {
            this.activePointers.delete(e.pointerId);
        }

        this.isDragging = false;
        this.canvas.dispatchEvent(new CustomEvent('rotationend', { 
            detail: { hasManualRotation: this.hasManualRotation }
        }));
        this.startMomentumAnimation();
    }

    /**
     * Handle pointer leave event
     */
    handlePointerLeave(e) {
        // On iOS, remove pointer from tracking
        if (this.isIOS) {
            this.activePointers.delete(e.pointerId);
        }

        if (this.isDragging) {
            this.handlePointerUp(e);
        }
    }

    /**
     * Update gem rotation
     */
    updateGemRotation() {
        if (!this.gemViewModel) return;

        // Update gem rotation
        this.gemViewModel.rotation = {
            x: this.currentRotation.x,
            y: this.currentRotation.y,
            z: this.currentRotation.z
        };
    }

    /**
     * Start rotation animation
     */
    startRotationAnimation() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const animate = () => {
            // Lerp current rotation towards target
            this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * this.options.dragEasing;
            this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * this.options.dragEasing;

            // Update gem rotation
            this.updateGemRotation();

            // Continue animation if still dragging or not at target
            if (this.isDragging ||
                Math.abs(this.targetRotation.x - this.currentRotation.x) > this.options.threshold ||
                Math.abs(this.targetRotation.y - this.currentRotation.y) > this.options.threshold) {
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                this.animationFrameId = null;
                this.startMomentumAnimation();
            }
        };

        animate();
    }

    /**
     * Find nearest cardinal rotation (in the current rotation space)
     */
    findNearestCardinalRotation(currentRotationRadians) {
        // Convert to degrees for easier math
        const currentDegrees = currentRotationRadians * 180 / Math.PI;
        
        // Find the nearest multiple of 180 degrees
        const nearestMultiple = Math.round(currentDegrees / 180) * 180;
        
        // Convert back to radians
        return nearestMultiple * Math.PI / 180;
    }

    /**
     * Start momentum animation
     */
    startMomentumAnimation() {
        if (this.isAnimating || this.isDragging) return;

        this.isAnimating = true;

        const animate = () => {
            // Lerp current rotation towards target
            this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * this.options.dragEasing;
            this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * this.options.dragEasing;

            // Update gem rotation
            this.updateGemRotation();

            // Check if we've come to rest
            const xDiff = Math.abs(this.targetRotation.x - this.currentRotation.x);
            const yDiff = Math.abs(this.targetRotation.y - this.currentRotation.y);

            if (xDiff <= this.options.threshold && yDiff <= this.options.threshold) {
                this.isAnimating = false;
                this.animationFrameId = null;

                // Ensure both current and target are exactly equal
                this.currentRotation.y = this.targetRotation.y;

                // Only start auto-rotation timer if user has manually rotated
                if (this.hasManualRotation) {
                    // Clear any existing timer
                    if (this.autoRotateTimer) {
                        clearTimeout(this.autoRotateTimer);
                    }

                    // Start auto-rotation timer after delay
                    this.autoRotateTimer = setTimeout(() => {
                        this.startAutoRotation();
                    }, this.options.autoRotateDelay);
                }
            } else {
                this.animationFrameId = requestAnimationFrame(animate);
            }
        };

        animate();
    }

    /**
     * Start auto-rotation back to nearest front/back position
     */
    startAutoRotation() {
        if (this.isAutoRotating || this.isDragging) return;

        this.isAutoRotating = true;

        // Find nearest cardinal rotation in current space
        const targetY = this.findNearestCardinalRotation(this.currentRotation.y);

        // Store start time and initial values
        const startTime = performance.now();
        const startRotation = { ...this.currentRotation };

        const animate = (currentTime) => {
            // Only continue if not dragging
            if (this.isDragging) {
                this.isAutoRotating = false;
                this.animationFrameId = null;
                return;
            }

            // Calculate progress (0 to 1)
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / this.options.autoRotateDuration, 1);

            // Apply easing
            const easedProgress = RotationControl.easeInOutQuad(progress);

            // Interpolate rotations
            this.currentRotation.x = startRotation.x * (1 - easedProgress);
            this.currentRotation.y = startRotation.y + (targetY - startRotation.y) * easedProgress;

            // Update target values to match current
            this.targetRotation = { ...this.currentRotation };

            // Update gem rotation
            this.updateGemRotation();

            // Continue animation if not complete
            if (progress < 1) {
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.isAutoRotating = false;
                this.animationFrameId = null;
                this.hasManualRotation = false;

                // Set final rotation exactly to target value
                this.currentRotation.y = targetY;
                this.targetRotation.y = targetY;

                console.log('Auto-rotation complete - final position:', {
                    degrees: targetY * 180 / Math.PI,
                    radians: targetY
                });

                // Dispatch event for completion
                this.canvas.dispatchEvent(new CustomEvent('autorotationcomplete'));
            }
        };

        animate(startTime);
    }

    /**
     * Easing function for smooth animations
     */
    static easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
} 