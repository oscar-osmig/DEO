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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initHelpNavigation);

// Also initialize when navigating to help view via hash
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#help') {
        // Small delay to ensure DOM is ready
        setTimeout(initHelpNavigation, 50);
    }
});
