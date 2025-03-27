import { BaseViewModel } from './BaseViewModel.js';

/**
 * Manages gem state and animations
 */
export class GemViewModel extends BaseViewModel {
    constructor(gem, initialState, easingRatio, threshold) {
        super(gem, initialState, easingRatio, threshold);
    }

    apply() {
        // Apply rotation directly to gem
        this.targetObject.rotation.x = this.currentState.rotation.x;
        this.targetObject.rotation.y = this.currentState.rotation.y;
        this.targetObject.rotation.z = this.currentState.rotation.z;
    }
} 