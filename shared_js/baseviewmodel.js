import { ViewState } from './ViewState.js';

/**
 * Base class for view models that manage state and animations
 */
export class BaseViewModel {
    constructor(targetObject, initialState = new ViewState(), easingRatio = 0.15, threshold = 0.001) {
        this.targetObject = targetObject;
        this.easingRatio = easingRatio;
        this.threshold = threshold;
        
        // Current state
        this.currentState = initialState.clone();
        
        // Target state
        this.targetState = initialState.clone();
        
        // Change tracking
        this._hasChanges = false;
        this._hasPositionChange = false;
        this._hasRotationChange = false;
        
        // Animation frame tracking
        this._pendingValidation = false;
        this._validationFrameId = null;

        // Calculate initial radius
        this._radius = Math.sqrt(
            initialState.position.x * initialState.position.x +
            initialState.position.y * initialState.position.y +
            initialState.position.z * initialState.position.z
        );

		// Apply the initial state
		this.apply();
    }

    // Position getters/setters (target values)
    get x() { return this.targetState.position.x; }
    set x(value) { 
        this.targetState.position.x = value;
        this._hasPositionChange = true;
        this.scheduleValidation();
    }
    
    get y() { return this.targetState.position.y; }
    set y(value) { 
        this.targetState.position.y = value;
        this._hasPositionChange = true;
        this.scheduleValidation();
    }
    
    get z() { return this.targetState.position.z; }
    set z(value) { 
        this.targetState.position.z = value;
        this._hasPositionChange = true;
        this.scheduleValidation();
    }

    // Rotation getters/setters (target values)
    get rotationX() { return this.targetState.rotation.x; }
    set rotationX(value) { 
        this.targetState.rotation.x = value;
        this._hasRotationChange = true;
        this.scheduleValidation();
    }
    
    get rotationY() { return this.targetState.rotation.y; }
    set rotationY(value) { 
        this.targetState.rotation.y = value;
        this._hasRotationChange = true;
        this.scheduleValidation();
    }
    
    get rotationZ() { return this.targetState.rotation.z; }
    set rotationZ(value) { 
        this.targetState.rotation.z = value;
        this._hasRotationChange = true;
        this.scheduleValidation();
    }

    // Current position getters (read-only)
    get currentX() { return this.currentState.position.x; }
    get currentY() { return this.currentState.position.y; }
    get currentZ() { return this.currentState.position.z; }

    // Current rotation getters (read-only)
    get currentRotationX() { return this.currentState.rotation.x; }
    get currentRotationY() { return this.currentState.rotation.y; }
    get currentRotationZ() { return this.currentState.rotation.z; }

    // Position object getters/setters (target values)
    get position() { return { ...this.targetState.position }; }
    set position(value) {
        this.targetState.position = { ...value };
        this._hasPositionChange = true;
        this.scheduleValidation();
    }

    // Rotation object getters/setters (target values)
    get rotation() { return { ...this.targetState.rotation }; }
    set rotation(value) {
        this.targetState.rotation = { ...value };
        this._hasRotationChange = true;
        this.scheduleValidation();
    }

    // Current position object getter (read-only)
    get currentPosition() { return { ...this.currentState.position }; }

    // Current rotation object getter (read-only)
    get currentRotation() { return { ...this.currentState.rotation }; }

    // Has changes getter
    get hasChanges() { return this._hasChanges; }

    // Schedule validation for next frame if not already scheduled
    scheduleValidation() {
        if (!this._pendingValidation) {
            this._pendingValidation = true;
            this._validationFrameId = requestAnimationFrame(() => this.validate());
        }
    }

    validate() {
        this._pendingValidation = false;
        this._validationFrameId = null;
        
        // Only update if we have changes
        if (this._hasPositionChange || this._hasRotationChange) {
            this.update();
        }
    }

    update() {
        // Reset change flags
        this._hasPositionChange = false;
        this._hasRotationChange = false;
        
        // Position lerp
        for (const axis of ['x', 'y', 'z']) {
            const diff = this.targetState.position[axis] - this.currentState.position[axis];
            if (Math.abs(diff) > this.threshold) {
                this.currentState.position[axis] += diff * this.easingRatio;
                this._hasPositionChange = true;
            } else {
                this.currentState.position[axis] = this.targetState.position[axis];
            }
        }
        
        // Rotation lerp
        for (const axis of ['x', 'y', 'z']) {
            const diff = this.targetState.rotation[axis] - this.currentState.rotation[axis];
            if (Math.abs(diff) > this.threshold) {
                this.currentState.rotation[axis] += diff * this.easingRatio;
                this._hasRotationChange = true;
            } else {
                this.currentState.rotation[axis] = this.targetState.rotation[axis];
            }
        }
        
        // Apply current state to actual object
        this.apply();
        
        // Update overall change state
        this._hasChanges = this._hasPositionChange || this._hasRotationChange;
        
        // Schedule next update if we still have changes
        if (this._hasChanges) {
            this.scheduleValidation();
        }
    }

    apply() {
        // This method should be overridden by derived classes
        throw new Error('apply() method must be implemented by derived class');
    }

    // Radius getters/setters
    get radius() {
        return this._radius;
    }

    set radius(value) {
        if (value === this._radius) return;
        
        this._radius = value;
        const currentPos = this.currentState.position;
        const r = Math.sqrt(
            currentPos.x * currentPos.x +
            currentPos.y * currentPos.y +
            currentPos.z * currentPos.z
        );
        
        if (r === 0) return;

        const scale = value / r;
        const newPos = {
            x: currentPos.x * scale,
            y: currentPos.y * scale,
            z: currentPos.z * scale
        };
        
        this.targetState.position = { ...newPos };
        this._hasPositionChange = true;
        this.scheduleValidation();
    }
} 