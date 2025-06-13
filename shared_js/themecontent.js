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
        
        // Assemble elements
        this.textOverlay.appendChild(this.artistName);
        this.textOverlay.appendChild(this.albumTitle);
        this.textOverlay.appendChild(this.published);
        
        // Add elements to document
        document.body.appendChild(this.textOverlay);
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
    }
} 