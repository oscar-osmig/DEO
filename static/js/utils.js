// === UTILITY FUNCTIONS ===

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
    if (hash === '#settings') {
        setHeaderSection('Settings');
    } else if (hash === '#new-deo') {
        setHeaderSection('New Deo');
        initNewDeo();
    } else if (hash === '#workspace') {
        setHeaderSection('Workspaces');
    } else if (hash === '#template') {
        setHeaderSection('Templates');
    } else if (hash === '#dashboards') {
        setHeaderSection('Dashboards');
    } else {
        setHeaderSection('');
    }
}