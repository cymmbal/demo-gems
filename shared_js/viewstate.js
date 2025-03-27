/**
 * Represents the state of a view object (position and rotation)
 */
export class ViewState {
    constructor(position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }) {
        this.position = { ...position };
        this.rotation = { ...rotation };
    }

    clone() {
        return new ViewState(
            { ...this.position },
            { ...this.rotation }
        );
    }
} 