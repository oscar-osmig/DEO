// === HELP CENTER ===

// Initialize help navigation
function initHelpNavigation() {
    const helpNav = document.querySelector('.help-nav');
    const helpContent = document.querySelector('.help-content');

    if (!helpNav || !helpContent) return;

    // Handle navigation clicks
    helpNav.addEventListener('click', (e) => {
        const navItem = e.target.closest('.help-nav-item');
        if (!navItem) return;

        e.preventDefault();

        const topic = navItem.dataset.topic;
        if (topic) {
            showHelpTopic(topic);
        }
    });

    // Handle card clicks (quick navigation from overview)
    helpContent.addEventListener('click', (e) => {
        const card = e.target.closest('.help-card[data-goto]');
        if (card) {
            e.preventDefault();
            const topic = card.dataset.goto;
            if (topic) {
                showHelpTopic(topic);
            }
        }
    });
}

// Show a specific help topic
function showHelpTopic(topic) {
    // Update navigation
    const navItems = document.querySelectorAll('.help-nav-item');
    navItems.forEach(item => {
        if (item.dataset.topic === topic) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update content
    const articles = document.querySelectorAll('.help-article');
    articles.forEach(article => {
        const articleId = article.id.replace('help-', '');
        if (articleId === topic) {
            article.classList.add('active');
        } else {
            article.classList.remove('active');
        }
    });

    // Scroll content to top
    const helpContent = document.querySelector('.help-content');
    if (helpContent) {
        helpContent.scrollTop = 0;
    }
}

// Copy manifest to clipboard
function copyManifest(button) {
    const manifest = button.closest('.help-manifest-wrapper').querySelector('.help-manifest');
    if (!manifest) return;

    const text = manifest.textContent;

    navigator.clipboard.writeText(text).then(() => {
        // Update button state
        button.classList.add('copied');
        const span = button.querySelector('span');
        const originalText = span.textContent;
        span.textContent = 'Copied!';

        // Update icon to checkmark
        const svg = button.querySelector('svg');
        svg.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';

        // Reset after 2 seconds
        setTimeout(() => {
            button.classList.remove('copied');
            span.textContent = originalText;
            svg.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initHelpNavigation);

// Also initialize when navigating to help view via hash
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#help') {
        // Small delay to ensure DOM is ready
        setTimeout(initHelpNavigation, 50);
    }
});
