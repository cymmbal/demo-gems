export class ThemeColor {
    constructor() {
        // Constants for theme color transitions
        this.TRANSITION_DURATION = 1000; // Duration in milliseconds
        this.TRANSITION_DELAY = 1000;    // Delay before starting transition
        
        // Constants for font colors
        this.BRIGHTNESS_THRESHOLD = 0.7;  // Threshold for switching between light/dark text
        this.LIGHT_FONT_COLOR = '#f0f0f0'; // Light text color (for dark backgrounds)
        this.DARK_FONT_COLOR = '#111111';  // Dark text color (for light backgrounds)
        
        // Create meta tag for theme color if it doesn't exist
        this.metaTag = document.querySelector('meta[name="theme-color"]');
        if (!this.metaTag) {
            this.metaTag = document.createElement('meta');
            this.metaTag.name = 'theme-color';
            document.head.appendChild(this.metaTag);
        }
        
        // Initialize transition state
        this.transition = {
            isTransitioning: false,
            startTime: 0,
            startColor: null,
            targetColor: null,
            animationFrame: null
        };
    }

    /**
     * Convert RGB to HSV
     */
    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        let h = 0;
        const s = max === 0 ? 0 : d / max;
        const v = max;

        if (max !== min) {
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }

        return { h, s, v };
    }

    /**
     * Convert HSV to RGB
     */
    hsvToRgb(h, s, v) {
        let r, g, b;

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0:
                r = v; g = t; b = p;
                break;
            case 1:
                r = q; g = v; b = p;
                break;
            case 2:
                r = p; g = v; b = t;
                break;
            case 3:
                r = p; g = q; b = v;
                break;
            case 4:
                r = t; g = p; b = v;
                break;
            case 5:
                r = v; g = p; b = q;
                break;
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    /**
     * Parse RGB or hex color string into object
     */
    parseRGB(color) {
        // Try RGB format first
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            return {
                r: parseInt(rgbMatch[1]),
                g: parseInt(rgbMatch[2]),
                b: parseInt(rgbMatch[3])
            };
        }

        // Try hex format
        const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (hexMatch) {
            return {
                r: parseInt(hexMatch[1], 16),
                g: parseInt(hexMatch[2], 16),
                b: parseInt(hexMatch[3], 16)
            };
        }

        console.warn('Failed to parse color:', color);
        return { r: 0, g: 0, b: 0 };
    }

    /**
     * Linear interpolation between two colors in HSV space
     */
    lerpColor(startColor, endColor, t) {
        const startRGB = this.parseRGB(startColor);
        const endRGB = this.parseRGB(endColor);
        
        // Convert both colors to HSV
        const startHSV = this.rgbToHsv(startRGB.r, startRGB.g, startRGB.b);
        const endHSV = this.rgbToHsv(endRGB.r, endRGB.g, endRGB.b);
        
        // Interpolate in HSV space
        // For hue, we need to handle the circular nature of the color wheel
        let h = startHSV.h + (endHSV.h - startHSV.h) * t;
        if (Math.abs(endHSV.h - startHSV.h) > 0.5) {
            if (startHSV.h < endHSV.h) {
                h = startHSV.h + (1 - (endHSV.h - startHSV.h)) * t;
            } else {
                h = startHSV.h - (1 - (startHSV.h - endHSV.h)) * t;
            }
        }
        
        const s = startHSV.s + (endHSV.s - startHSV.s) * t;
        
        // Only allow value (brightness) to decrease if the target color is darker
        let v;
        if (endHSV.v < startHSV.v) {
            // If target is darker, allow full interpolation
            v = startHSV.v + (endHSV.v - startHSV.v) * t;
        } else {
            // If target is lighter, maintain at least the starting brightness
            v = Math.max(startHSV.v, startHSV.v + (endHSV.v - startHSV.v) * t);
        }
        
        // Convert back to RGB
        const rgb = this.hsvToRgb(h, s, v);
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    /**
     * Calculate brightness of a color (0-1)
     */
    calculateBrightness(color) {
        const rgb = this.parseRGB(color);
        return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
    }

    /**
     * Update all background colors and theme color
     */
    setColor(newColor) {
        // Calculate background brightness
        const brightness = this.calculateBrightness(newColor);
        
        // Determine font color based on brightness
        const baseFontColor = brightness > this.BRIGHTNESS_THRESHOLD 
            ? this.DARK_FONT_COLOR 
            : this.LIGHT_FONT_COLOR;
        
        // Update panel overlay with semi-transparent version
        const rgbMatch = newColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const rgbaColor = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, 0.5)`;
            
            // Update panel overlay background and font color
            const panelOverlay = document.getElementById('panel-overlay');
            if (panelOverlay) {
                panelOverlay.style.backgroundColor = rgbaColor;
                panelOverlay.style.color = baseFontColor.replace(')', ', 0.5)').replace('rgb', 'rgba');
            }
        }

        // Update body background and font color
        document.body.style.backgroundColor = newColor;
        document.body.style.color = baseFontColor;

        // Get current theme color
        let currentColor = this.metaTag.content;

        // If current color is black or null, use document body background color
        if (!currentColor || currentColor === 'rgb(0, 0, 0)') {
            currentColor = getComputedStyle(document.body).backgroundColor;
        }

        // If we're already transitioning, update the target color
        if (this.transition.isTransitioning) {
            this.transition.targetColor = newColor;
            return;
        }

        // Set initial color immediately
        this.metaTag.content = currentColor;

        // Start transition after delay
        setTimeout(() => {
            // Start new transition
            this.transition.startTime = performance.now();
            this.transition.startColor = currentColor;
            this.transition.targetColor = newColor;
            this.transition.isTransitioning = true;

            // Start animation loop
            const animate = () => {
                const currentTime = performance.now();
                const elapsed = currentTime - this.transition.startTime;
                const progress = Math.min(elapsed / this.TRANSITION_DURATION, 1);

                // Calculate current color
                const currentColor = this.lerpColor(
                    this.transition.startColor,
                    this.transition.targetColor,
                    progress
                );

                // Update meta tag
                this.metaTag.content = currentColor;

                // Continue animation if not complete
                if (progress < 1) {
                    this.transition.animationFrame = requestAnimationFrame(animate);
                } else {
                    this.transition.isTransitioning = false;
                    this.transition.animationFrame = null;
                }
            };

            this.transition.animationFrame = requestAnimationFrame(animate);
        }, this.TRANSITION_DELAY);
    }

    /**
     * Clean up any ongoing transitions
     */
    cleanup() {
        if (this.transition.animationFrame) {
            cancelAnimationFrame(this.transition.animationFrame);
            this.transition.animationFrame = null;
        }
        this.transition.isTransitioning = false;
    }

    /**
     * Update all background colors and theme color
     */
    updateColors(sourceElement) {
        // Get the computed background color from the source element
        const bgColor = getComputedStyle(sourceElement).backgroundColor;
        
        // Convert RGB to RGBA for the panel overlay
        const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const rgbaColor = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, 0.5)`;
            
            // Update panel overlay background
            const panelOverlay = document.getElementById('panel-overlay');
            if (panelOverlay) {
                panelOverlay.style.backgroundColor = rgbaColor;
            }
        }

        // Update body background
        document.body.style.backgroundColor = bgColor;

        // Update theme color with smooth transition
        this.setColor(bgColor);
    }
} 