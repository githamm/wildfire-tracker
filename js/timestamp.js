// Shows "Updated X ago" in the header, sourced from the timestamp the
// data-refresh Action stamps after every successful run (so a stale display
// here is a real signal the pipeline broke, not just cosmetic staleness).
(function() {
    'use strict';

    var LAST_UPDATED_URL = 'https://raw.githubusercontent.com/githamm/wildfire-data/main/last-updated.json';
    var REFRESH_DISPLAY_MS = 60000; // keep the relative time ("8 minutes ago") current without a page reload

    document.addEventListener('DOMContentLoaded', function() {
        var el = document.getElementById('header-timestamp');
        if (!el) return;

        var generatedAt = null;

        function updateDisplay() {
            if (!generatedAt) return;
            el.textContent = 'Updated ' + moment(generatedAt).fromNow();
        }

        fetch(LAST_UPDATED_URL)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Request failed: ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                generatedAt = data.generatedAt;
                updateDisplay();
                setInterval(updateDisplay, REFRESH_DISPLAY_MS);
            })
            .catch(function(err) {
                console.error('Unable to load last-updated timestamp:', err);
                // Leave the span empty on failure -- CSS already hides an
                // empty .header-byline-timestamp gracefully (see styles.css),
                // so this fails invisibly instead of showing a broken label.
            });
    });
})();