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

// === ALERT MODAL ===
const alertModal = {
    overlay: null,
    resolvePromise: null,
    isConfirmMode: false,

    init() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'alert-modal-overlay';
        this.overlay.innerHTML = `
            <div class="alert-modal">
                <div class="alert-modal-icon alert-modal-icon-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                </div>
                <h3 class="alert-modal-title">Alert</h3>
                <p class="alert-modal-message">Message here</p>
                <div class="alert-modal-actions">
                    <button class="btn btn-secondary alert-modal-cancel" style="display: none;">No</button>
                    <button class="btn alert-modal-ok">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Event listeners
        this.overlay.querySelector('.alert-modal-ok').addEventListener('click', () => this.close(true));
        this.overlay.querySelector('.alert-modal-cancel').addEventListener('click', () => this.close(false));
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

    show({ title = 'Alert', message = '', type = 'info', confirm = false, confirmText = 'Yes', cancelText = 'No' } = {}) {
        this.init();
        this.isConfirmMode = confirm;

        this.overlay.querySelector('.alert-modal-title').textContent = title;
        this.overlay.querySelector('.alert-modal-message').textContent = message;

        // Show/hide cancel button based on confirm mode
        const cancelBtn = this.overlay.querySelector('.alert-modal-cancel');
        const okBtn = this.overlay.querySelector('.alert-modal-ok');

        if (confirm) {
            cancelBtn.style.display = 'block';
            cancelBtn.textContent = cancelText;
            okBtn.textContent = confirmText;
        } else {
            cancelBtn.style.display = 'none';
            okBtn.textContent = 'OK';
        }

        // Update icon based on type
        const iconContainer = this.overlay.querySelector('.alert-modal-icon');
        iconContainer.className = `alert-modal-icon alert-modal-icon-${type}`;

        if (type === 'error') {
            iconContainer.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            `;
        } else if (type === 'success') {
            iconContainer.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9 12l2 2 4-4"/>
                </svg>
            `;
        } else if (type === 'warning') {
            iconContainer.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            `;
        } else {
            iconContainer.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
            `;
        }

        this.overlay.classList.add('active');

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    },

    close(result = false) {
        this.overlay.classList.remove('active');
        if (this.resolvePromise) {
            // For confirm mode, return the result; for regular alerts, just resolve
            this.resolvePromise(this.isConfirmMode ? result : undefined);
            this.resolvePromise = null;
        }
    }
};

// Convenience function for styled alerts
async function showAlert(options) {
    return alertModal.show(options);
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
    const isHome = !hash || hash === '' || hash === '#' || hash === '#home';

    // Manage the has-route class for preventing home view flash
    if (!isHome) {
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
        setHeaderSection('Bot Templates');
    } else if (hash === '#dashboards') {
        setHeaderSection('Dashboards');
    } else if (hash === '#teams') {
        setHeaderSection('Teams');
    } else if (hash === '#apps') {
        setHeaderSection('Apps');
    } else if (hash === '#help') {
        setHeaderSection('Help');
    } else {
        // Home or unknown hash
        setHeaderSection('Home');
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

// === FEEDBACK MODAL ===
const FeedbackModal = {
    overlay: null,
    selectedFile: null,

    init() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'feedback-modal-overlay';
        this.overlay.innerHTML = `
            <div class="feedback-modal">
                <div class="feedback-modal-header">
                    <div class="feedback-modal-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="feedback-modal-title">Send Feedback</h3>
                        <p class="feedback-modal-subtitle">Help us improve DEO</p>
                    </div>
                </div>
                <form id="feedback-form">
                    <div class="feedback-form-group">
                        <label class="feedback-form-label">Title</label>
                        <input type="text" class="feedback-form-input" id="feedback-title" placeholder="Brief summary of your feedback" required>
                    </div>
                    <div class="feedback-form-group">
                        <label class="feedback-form-label">Message</label>
                        <textarea class="feedback-form-textarea" id="feedback-message" placeholder="Describe your feedback, suggestion, or issue in detail..." required></textarea>
                    </div>
                    <div class="feedback-form-group">
                        <label class="feedback-form-label">Attachment (optional)</label>
                        <div class="feedback-file-upload" id="feedback-file-upload">
                            <input type="file" id="feedback-file" accept="image/*,.pdf,.txt,.log">
                            <svg class="feedback-file-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p class="feedback-file-upload-text">Click or drag file to upload</p>
                            <p class="feedback-file-upload-hint">Images, PDF, or text files up to 5MB</p>
                            <p class="feedback-file-name" id="feedback-file-name"></p>
                        </div>
                    </div>
                    <div class="feedback-modal-actions">
                        <button type="button" class="btn btn-secondary feedback-cancel">Cancel</button>
                        <button type="submit" class="btn btn-primary feedback-submit">Send Feedback</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Event listeners
        this.overlay.querySelector('.feedback-cancel').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // File upload handling
        const fileInput = this.overlay.querySelector('#feedback-file');
        const fileUpload = this.overlay.querySelector('#feedback-file-upload');
        const fileName = this.overlay.querySelector('#feedback-file-name');

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alertModal.show({
                        type: 'warning',
                        title: 'File Too Large',
                        message: 'File size must be less than 5MB.'
                    });
                    fileInput.value = '';
                    return;
                }
                this.selectedFile = file;
                fileName.textContent = file.name;
                fileUpload.classList.add('has-file');
            } else {
                this.selectedFile = null;
                fileName.textContent = '';
                fileUpload.classList.remove('has-file');
            }
        });

        // Form submission
        const form = this.overlay.querySelector('#feedback-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submit();
        });
    },

    show() {
        this.init();
        this.reset();
        this.overlay.classList.add('active');
    },

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
    },

    reset() {
        const form = this.overlay.querySelector('#feedback-form');
        form.reset();
        this.selectedFile = null;
        this.overlay.querySelector('#feedback-file-name').textContent = '';
        this.overlay.querySelector('#feedback-file-upload').classList.remove('has-file');
        this.overlay.querySelector('.feedback-submit').disabled = false;
        this.overlay.querySelector('.feedback-submit').textContent = 'Send Feedback';
    },

    async submit() {
        const title = this.overlay.querySelector('#feedback-title').value.trim();
        const message = this.overlay.querySelector('#feedback-message').value.trim();
        const submitBtn = this.overlay.querySelector('.feedback-submit');

        if (!title || !message) {
            alertModal.show({
                type: 'warning',
                title: 'Missing Fields',
                message: 'Please fill in both title and message.'
            });
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('message', message);
            if (this.selectedFile) {
                formData.append('file', this.selectedFile);
            }

            const res = await fetch('/feedback', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.success) {
                this.close();
                // Show success message using themed modal
                alertModal.show({
                    type: 'success',
                    title: 'Feedback Sent',
                    message: 'Thank you for your feedback! We appreciate you taking the time to help us improve.'
                });
            } else {
                throw new Error(data.detail || 'Failed to send feedback');
            }
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Feedback';
            alertModal.show({
                type: 'error',
                title: 'Error',
                message: 'Failed to send feedback: ' + err.message
            });
        }
    }
};

// Open feedback modal on click
document.addEventListener('click', (e) => {
    if (e.target.closest('#open-feedback-btn')) {
        e.preventDefault();
        FeedbackModal.show();
    }
});