// === UTILITY FUNCTIONS ===

// === DELETE CONFIRMATION MODAL ===
const deleteModal = {
    overlay: null,
    resolvePromise: null,

    init() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'delete-modal-overlay';
        this.overlay.innerHTML = `
            <div class="delete-modal">
                <div class="delete-modal-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </div>
                <h3 class="delete-modal-title">Delete Item</h3>
                <p class="delete-modal-message">Are you sure you want to delete this item?</p>
                <p class="delete-modal-warning">This action cannot be undone.</p>
                <div class="delete-modal-actions">
                    <button class="btn btn-secondary delete-modal-cancel">Cancel</button>
                    <button class="btn delete-modal-confirm">Delete</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Event listeners
        this.overlay.querySelector('.delete-modal-cancel').addEventListener('click', () => this.close(false));
        this.overlay.querySelector('.delete-modal-confirm').addEventListener('click', () => this.close(true));
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close(false);
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.close(false);
            }
        });
    },

    show({ title = 'Delete Item', message = 'Are you sure you want to delete this item?', warning = 'This action cannot be undone.', confirmText = 'Delete' } = {}) {
        this.init();

        this.overlay.querySelector('.delete-modal-title').textContent = title;
        this.overlay.querySelector('.delete-modal-message').textContent = message;
        this.overlay.querySelector('.delete-modal-warning').textContent = warning;
        this.overlay.querySelector('.delete-modal-confirm').textContent = confirmText;

        this.overlay.classList.add('active');

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    },

    close(confirmed) {
        this.overlay.classList.remove('active');
        if (this.resolvePromise) {
            this.resolvePromise(confirmed);
            this.resolvePromise = null;
        }
    }
};

// Convenience function for delete confirmation
async function confirmDelete(options) {
    return deleteModal.show(options);
}

// Helper function to set header section
function setHeaderSection(text) {
    const section = document.getElementById('header-section');
    const separator = document.querySelector('.header-separator');

    if (text) {
        section.textContent = text;
        separator.classList.add('visible');
    } else {
        section.textContent = '';
        separator.classList.remove('visible');
    }
}

// Generate random template name
function generateTemplateName() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Template-${id}`;
}

// Initialize template name when navigating to new-deo
function initNewDeo() {
    const templateNameInput = document.getElementById('template-name-input');
    if (templateNameInput && !templateNameInput.value) {
        templateNameInput.value = generateTemplateName();
    }
}

// Check if there's a hash in URL and set header section accordingly
function initFromHash() {
    const hash = window.location.hash;

    // Manage the has-route class for preventing home view flash
    if (hash && hash.length > 1) {
        document.documentElement.classList.add('has-route');
    } else {
        document.documentElement.classList.remove('has-route');
    }

    if (hash === '#settings') {
        setHeaderSection('Settings');
    } else if (hash === '#new-deo') {
        setHeaderSection('Canvas');
        initNewDeo();
    } else if (hash === '#workspace') {
        setHeaderSection('Workspaces');
    } else if (hash === '#template') {
        setHeaderSection('Templates');
    } else if (hash === '#dashboards') {
        setHeaderSection('Dashboards');
    } else if (hash === '#teams') {
        setHeaderSection('Teams');
    } else {
        setHeaderSection('');
    }

    // Ensure target view is properly activated on refresh
    // This helps browsers that might not apply :target immediately
    if (hash && hash.length > 1) {
        const targetElement = document.querySelector(hash);
        if (targetElement) {
            // Force a reflow to ensure :target is applied
            targetElement.offsetHeight;
        }
    }
}