export class ThemeContent {
    constructor() {
        // Create text overlay container
        this.textOverlay = document.createElement('div');
        this.textOverlay.className = 'text-overlay';
        
        // Create content elements
        this.artistName = document.createElement('div');
        this.artistName.className = 'artist-name';
        
        this.albumTitle = document.createElement('div');
        this.albumTitle.className = 'album-title';
        
        this.published = document.createElement('div');
        this.published.className = 'published';
        
        // Create panel overlay
        this.panelOverlay = document.createElement('div');
        this.panelOverlay.id = 'panel-overlay';
        
        // Create TAP text with kerning
		this.panelOverlay.appendChild(document.createTextNode('('));
        const tapText = document.createElement('span');
        tapText.className = 'kern-pair';
        tapText.textContent = 'T';
        this.panelOverlay.appendChild(tapText);
        this.panelOverlay.appendChild(document.createTextNode('AP)'));
        
        // Assemble elements
        this.textOverlay.appendChild(this.artistName);
        this.textOverlay.appendChild(this.albumTitle);
        this.textOverlay.appendChild(this.published);
        
        // Add elements to document
        document.body.appendChild(this.textOverlay);
        document.body.appendChild(this.panelOverlay);
    }

    /**
     * Update content from gem-player attributes
     */
    updateContent(gemPlayer) {
        // Update artist name
        const artistName = gemPlayer.getAttribute('artist');
        this.artistName.textContent = artistName || '';
        
        // Update album title
        const albumTitle = gemPlayer.getAttribute('album');
        this.albumTitle.textContent = albumTitle || '';
        
        // Update published info
        const published = gemPlayer.getAttribute('published');
        this.published.textContent = published || '';
    }

    /**
     * Clean up elements
     */
    cleanup() {
        if (this.textOverlay && this.textOverlay.parentNode) {
            this.textOverlay.parentNode.removeChild(this.textOverlay);
        }
        if (this.panelOverlay && this.panelOverlay.parentNode) {
            this.panelOverlay.parentNode.removeChild(this.panelOverlay);
        }
    }
} 