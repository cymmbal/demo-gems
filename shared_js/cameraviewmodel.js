import { BaseViewModel } from './BaseViewModel.js';

/**
 * Manages camera state and animations
 */
export class CameraViewModel extends BaseViewModel {
	
    constructor(camera, initialState, easing = 0.15, threshold = 0.001) {
        super(camera, initialState, easing, threshold);
    }

    apply() {

		let camera = this.targetObject;

        if (!camera) return;

        try {
			
            camera.position.set(
                this.currentState.position.x,
                this.currentState.position.y,
                this.currentState.position.z
            );

            camera.rotation.set(
                this.currentState.rotation.x,
                this.currentState.rotation.y,
                this.currentState.rotation.z
            );

        } catch (error) {
            console.error('Error updating camera:', error);
        }
    }
} 