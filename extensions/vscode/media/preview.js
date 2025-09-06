(function() {
    const vscode = acquireVsCodeApi();
    let currentDsrMap = null;

    // DOM elements
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('content');

    // Message handler
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'updatePreview':
                updatePreview(message.html, message.dsrMap);
                break;
        }
    });

    function updatePreview(html, dsrMap) {
        currentDsrMap = dsrMap;
        
        if (loadingEl.style.display !== 'none') {
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        }

        // Use morphdom-like approach for efficient DOM updates
        contentEl.innerHTML = html;

        // Add click handlers for footnotes
        const footnotes = contentEl.querySelectorAll('sup.reference a, .reference a');
        footnotes.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const claimId = findClaimIdForElement(e.target);
                if (claimId) {
                    vscode.postMessage({
                        type: 'footnoteClicked',
                        claimId: claimId
                    });
                }
            });
        });

        // Highlight claims with data attributes
        highlightClaims();
    }

    function findClaimIdForElement(element) {
        // Walk up the DOM to find an element with data-claim-id
        let current = element;
        while (current && current !== contentEl) {
            if (current.dataset && current.dataset.claimId) {
                return current.dataset.claimId;
            }
            current = current.parentElement;
        }
        return null;
    }

    function highlightClaims() {
        // Add visual indicators for claims that need attention
        const claimElements = contentEl.querySelectorAll('[data-claim-id]');
        claimElements.forEach(el => {
            const claimId = el.dataset.claimId;
            const claimType = el.dataset.claimType;
            const claimStatus = el.dataset.claimStatus;

            // Add appropriate CSS classes based on claim properties
            if (claimStatus === 'unsupported') {
                el.classList.add('claim-unsupported');
            }
            if (claimType === 'BLP') {
                el.classList.add('claim-blp');
            }
            if (el.dataset.claimRisk === 'high') {
                el.classList.add('claim-high-risk');
            }
        });
    }

    // Notify that webview is ready
    vscode.postMessage({ type: 'ready' });
})();