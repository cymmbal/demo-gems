// Import GemPlayer class to ensure it's registered
import { GemPlayer } from '../shared_js/gemplayer_new.js';
import { Router } from '../shared_js/router.js';
import { CameraViewModel } from '../shared_js/cameraviewmodel.js';
import { ViewState } from '../shared_js/viewstate.js';
import { GemViewModel } from '../shared_js/gemviewmodel.js';
import { DriftControl } from '../shared_js/driftcontrol.js';
import { ZoomControl } from '../shared_js/zoomcontrol.js';
import { ThemeColor } from '../shared_js/themecolor.js';
import { ThemeContent } from '../shared_js/themecontent.js';
import { RotationControl } from '../shared_js/rotationcontrol.js';
import { BaseViewModel } from '../shared_js/baseviewmodel.js';

// No need for additional initialization, the custom element handles everything
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, custom elements ready');
    
    // Initialize router
    const router = new Router();
    
    // Add event listeners to track the gem-player element events
    const player = document.querySelector('gem-player');
    
    if (player) {
        // Set up route handler for /warp/:number
        router.addRoute('/warp', (gemNumber) => {
            // Map gem numbers to gem types
            const gemMap = {
                '21': 'aphex-twin',
                '195': 'flying-lotus',
                '318': 'oneohtrix'
            };

            const gemType = gemMap[gemNumber];
            if (gemType) {
                // Update the gem player
                player.setAttribute('gem', gemType);
                
                // Update button states
                const buttons = document.querySelectorAll('.gem-button');
                buttons.forEach(btn => {
                    if (btn.getAttribute('data-gem') === gemType) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        });

        // Log when the scene starts loading
        player.addEventListener('scenestart', () => {
            console.log('Scene start event captured - Spline has begun initialization');
        });
        
        // Log when the scene is fully loaded and faded in
        player.addEventListener('sceneloaded', () => {
            console.log('Scene loaded event captured - Fade-in complete');
        });
        
        // Log any errors
        player.addEventListener('sceneerror', (event) => {
            console.error('Scene error event captured:', event.detail.error);
        });

        // Handle gem selection
        player.addEventListener('gemselected', (event) => {
            const gemType = event.detail.gemNumber;
            // Map gem types to numbers
            const numberMap = {
                'aphex-twin': '21',
                'flying-lotus': '195',
                'oneohtrix': '318'
            };
            const gemNumber = numberMap[gemType];
            if (gemNumber) {
                router.navigate(`/warp/${gemNumber}`);
            }
        });

        // Initialize based on current URL
        const currentGemNumber = router.getCurrentGemNumber();
        router.handleRoute(`/warp/${currentGemNumber}`);
    }
}); 