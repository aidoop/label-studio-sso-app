/**
 * Label Studio hideHeader Fix
 *
 * This script ensures hideHeader parameter works correctly in iframe environments
 * without relying on sessionStorage.
 *
 * It overrides the default behavior to always check URL parameters.
 */

(function() {
  'use strict';

  console.log('[hideHeader Fix] Initializing...');

  // Function to check hideHeader parameter
  function shouldHideHeader() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('hideHeader') === 'true';
  }

  // Monitor and apply hideHeader on page load and navigation
  function applyHideHeader() {
    const hideHeader = shouldHideHeader();

    if (hideHeader) {
      console.log('[hideHeader Fix] Applying hideHeader=true');

      // Add CSS to hide the header
      const style = document.createElement('style');
      style.id = 'hide-header-style';
      style.textContent = `
        /* Hide Label Studio header */
        header[class*="Menubar"],
        div[class*="Menubar_menubar"],
        nav[class*="Menubar"],
        .dm-header,
        .ls-header {
          display: none !important;
        }

        /* Adjust main content to fill space */
        main[class*="Menubar_content"],
        div[class*="Menubar_content"],
        .dm-content,
        .ls-content {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
      `;

      document.head.appendChild(style);
    }
  }

  // Apply on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyHideHeader);
  } else {
    applyHideHeader();
  }

  // Also observe for dynamic content changes (React SPA)
  const observer = new MutationObserver(() => {
    if (shouldHideHeader()) {
      applyHideHeader();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  console.log('[hideHeader Fix] Initialized successfully');
})();
