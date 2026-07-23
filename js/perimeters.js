// Colorado fire perimeter history. Pick a fire, scrub (or play) through its
// daily mapped-perimeter growth. Reads only from the GitHub-mirrored data
// this whole app uses elsewhere -- never queries NIFC directly.
(function() {
    'use strict';

    var INDEX_URL = 'https://raw.githubusercontent.com/githamm/wildfire-data/main/fire-index.json';
    var HISTORY_BASE_URL = 'https://raw.githubusercontent.com/githamm/wildfire-data/main/perimeter-history/';
    var PLAY_INTERVAL_MS = 900;

    var PERIMETER_STYLE = {
        color: '#c03639',
        weight: 2,
        opacity: .8,
        fillColor: '#c03639',
        fillOpacity: .35
    };

    // Mirrors the sanitizing done when the archiving job names each fire's
    // history file, so the client requests the same filename it wrote.
    function safeId(rawId) {
        return rawId.replace(/[^A-Za-z0-9_-]/g, '_');
    }

    function formatDate(dateStr) {
        // dateStr is a plain "YYYY-MM-DD" calendar date (not a timestamp to
        // convert between zones), so parse and display it as-is.
        return moment(dateStr, 'YYYY-MM-DD').format('MMM D, YYYY');
    }

    // A day whose mapped perimeter didn't change from the prior archived
    // day is stored server-side as {geometry: null, geometrySameAsDate:
    // "<date>"} instead of a second literal copy of the same (often large)
    // polygon -- expand those references back to a real geometry object
    // once, up front, so every entry in currentHistory always has a
    // literal `geometry` exactly like before this existed, and nothing
    // downstream (renderDay, the slider, the info card) needs to know the
    // difference. geometrySameAsDate always points directly at a day with
    // literal geometry, never at another reference, so this is a single
    // lookup per entry, not a chain walk.
    function resolveGeometryReferences(history) {
        var byDate = {};
        history.forEach(function(entry) {
            byDate[entry.date] = entry;
        });
        history.forEach(function(entry) {
            if (entry.geometry == null && entry.geometrySameAsDate) {
                var source = byDate[entry.geometrySameAsDate];
                entry.geometry = source ? source.geometry : null;
            }
        });
        return history;
    }

    document.addEventListener('DOMContentLoaded', function() {
        var mapEl = document.getElementById('perimeter-map');
        if (!mapEl) return;

        var select = document.getElementById('perimeter-fire-select');
        var slider = document.getElementById('perimeter-slider');
        var playButton = document.getElementById('perimeter-play');
        var dateLabel = document.getElementById('perimeter-date');
        var infoCard = document.getElementById('perimeter-info-card');

        var map = L.map('perimeter-map', {
            center: [39.0, -105.5],
            zoom: 7,
            minZoom: 3,
            scrollWheelZoom: true,
            preferCanvas: true,
            // Leaflet's keyboard handler gives the map container tabindex
            // and manages focus on it, which is a plausible source of the
            // page scrolling to bring the map into view on its own. Not
            // needed here since users drive this map via the picker/slider,
            // not arrow-key panning.
            keyboard: false
        });

        FireDataUtils.addBaseLayerSwitcher(map);

        var fireIndexById = {};
        var currentFireIndexEntry = {};
        var currentLayer = null;
        var currentHistory = [];
        var playTimer = null;
        var preservedScrollY = null;

        // Restoring the scroll position defends against whatever is causing
        // the jump (a native browser "scroll interactive element into view"
        // behavior, or Leaflet's own pan/zoom handling during fitBounds) --
        // rather than needing to pin down the exact mechanism, this just
        // puts the user back where they were after each point in the flow
        // that could plausibly have moved it. The delayed calls additionally
        // cover Leaflet's fitBounds animation, which doesn't finish within
        // a single frame.
        function restoreScroll() {
            if (preservedScrollY == null) return;
            window.scrollTo(window.scrollX, preservedScrollY);
            requestAnimationFrame(function() {
                window.scrollTo(window.scrollX, preservedScrollY);
            });
            [100, 400, 800].forEach(function(delay) {
                setTimeout(function() {
                    window.scrollTo(window.scrollX, preservedScrollY);
                }, delay);
            });
        }

        // Captured on mousedown/focus rather than only in the change
        // handler below -- some browsers scroll a <select> into view as
        // soon as it's interacted with (before its native dropdown even
        // opens), which happens before "change" ever fires. Capturing only
        // in the change handler would record the scroll position *after*
        // that jump already occurred, making the restore a no-op.
        function captureScroll() {
            preservedScrollY = window.scrollY;
        }

        function stopPlaying() {
            if (playTimer) {
                clearInterval(playTimer);
                playTimer = null;
                playButton.textContent = '\u25B6'; // play triangle
                playButton.setAttribute('aria-label', 'Play growth animation');
            }
        }

        function renderDay(index) {
            if (!currentHistory.length) return;
            index = Math.max(0, Math.min(index, currentHistory.length - 1));
            slider.value = index;

            var entry = currentHistory[index];

            if (currentLayer) {
                map.removeLayer(currentLayer);
                currentLayer = null;
            }

            if (entry.geometry) {
                currentLayer = L.geoJson({ type: 'Feature', geometry: entry.geometry, properties: {} }, {
                    style: PERIMETER_STYLE
                }).addTo(map);
            }

            dateLabel.textContent = formatDate(entry.date);

            // Same info-card content/format as the map's popups -- built
            // from the same shared function. Each history entry is now a
            // fully self-contained daily snapshot; the index fallback below
            // only matters for entries archived before that was true.
            var center = currentLayer ? currentLayer.getBounds().getCenter() : null;

            // Only perimeters after the first one have a "previous" to
            // compare against -- index 0 (the initial perimeter) shows
            // "Unavailable" for the value rather than omitting the row,
            // since the row appearing/disappearing as the slider moves
            // shifted the rest of the card up and down.
            var previousEntry = index > 0 ? currentHistory[index - 1] : null;
            var growthChange = previousEntry ?
                FireDataUtils.formatGrowthChange(entry.acres, previousEntry.acres) : null;
            var growthChangeLabel = previousEntry ?
                'Growth since ' + formatDate(previousEntry.date) : 'Growth';

            var discoveryRaw = entry.discoveryDate || currentFireIndexEntry.discoveryDate;
            var daysBurning = discoveryRaw ?
                moment(entry.date, 'YYYY-MM-DD').diff(moment(discoveryRaw).startOf('day'), 'days') + 1 : null;
            var daysBurningText = daysBurning != null && daysBurning >= 1 ?
                daysBurning + (daysBurning === 1 ? ' day' : ' days') : 'Unavailable';

            infoCard.innerHTML = FireDataUtils.buildFireInfoHtml({
                incidentName: entry.name || currentFireIndexEntry.name,
                cause: entry.cause || currentFireIndexEntry.cause,
                city: entry.city || currentFireIndexEntry.city,
                landownerCategory: entry.landownerCategory || currentFireIndexEntry.landownerCategory,
                county: entry.county || currentFireIndexEntry.county,
                discoveryDateFormatted: discoveryRaw ? moment(discoveryRaw).format('LL') : null,
                acres: entry.acres,
                growthChange: growthChange,
                growthChangeLabel: growthChangeLabel,
                daysBurning: daysBurningText,
                percentContained: entry.percentContained,
                personnel: entry.personnel,
                complexity: entry.complexity,
                updatedLabel: 'Perimeter as of',
                updatedDateFormatted: formatDate(entry.date),
                lat: center ? center.lat : null,
                lng: center ? center.lng : null
            });
            infoCard.classList.remove('is-loading');
        }

        // preserveScroll defaults to false: this also runs from the
        // IntersectionObserver below every time the map merely scrolls
        // into view (not just on tab switches or a fire actually
        // loading) -- restoring scroll on every one of those calls was
        // fighting the user's own scrolling and made it impossible to
        // scroll the map into view in the first place. Only the loadFire
        // callers below, where a genuine content/layout change just
        // happened, opt in with preserveScroll=true.
        function fitToCurrentLayer(preserveScroll) {
            if (!currentLayer) return;
            map.invalidateSize();
            map.fitBounds(currentLayer.getBounds(), { padding: [20, 20], maxZoom: 13 });
            if (preserveScroll) {
                restoreScroll();
            }
        }

        function loadFire(fireId) {
            // Fallback for the initial, non-user-triggered call from
            // populateFireList -- the mousedown/focus listeners below cover
            // every case where the user actually interacts with the select.
            if (preservedScrollY == null) {
                captureScroll();
            }
            stopPlaying();
            currentHistory = [];
            currentFireIndexEntry = fireIndexById[fireId] || {};
            slider.disabled = true;
            playButton.disabled = true;
            dateLabel.textContent = 'Loading\u2026';
            // Deliberately NOT clearing infoCard here: emptying it before the
            // new fire's data arrives shrinks the page right where the user
            // is scrolled to (the card is the last thing on the page), which
            // snaps their scroll position back toward the top. Dim the old
            // content instead until it's replaced.
            infoCard.classList.add('is-loading');

            if (currentLayer) {
                map.removeLayer(currentLayer);
                currentLayer = null;
            }
            restoreScroll();

            FireDataUtils.fetchJSON(HISTORY_BASE_URL + safeId(fireId) + '.json').then(function(history) {
                // Sort oldest-to-newest defensively -- the archiving job
                // appends in order, but don't assume that'll always hold.
                history.sort(function(a, b) {
                    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
                });
                currentHistory = resolveGeometryReferences(history);

                if (!history.length) {
                    dateLabel.textContent = 'No history available yet';
                    infoCard.classList.remove('is-loading');
                    infoCard.innerHTML = '<p class="no-data-note">No perimeter history has been archived for this fire yet.</p>';
                    restoreScroll();
                    return;
                }

                slider.min = 0;
                slider.max = history.length - 1;
                slider.disabled = history.length < 2;
                playButton.disabled = history.length < 2;

                // Default to the most recent day, not the first -- people
                // want to see the current state first, then scrub backward
                // through how it got there.
                renderDay(history.length - 1);
                fitToCurrentLayer(true);
            }).catch(function(err) {
                console.error('Unable to load perimeter history for', fireId, err);
                dateLabel.textContent = 'Unable to load this fire\u2019s history';
                infoCard.classList.remove('is-loading');
                infoCard.innerHTML = '<p class="no-data-note">Unable to load this fire\u2019s history. Please try again.</p>';
                restoreScroll();
            });
        }

        function populateFireList(index) {
            fireIndexById = index;

            var fires = Object.keys(index).map(function(id) {
                var entry = index[id];
                return {
                    id: id,
                    name: entry.name,
                    acres: entry.acres,
                    lastSeen: entry.lastSeen,
                    active: entry.active
                };
            });

            var active = fires.filter(function(f) { return f.active; })
                .sort(function(a, b) { return (b.acres || 0) - (a.acres || 0); });
            var past = fires.filter(function(f) { return !f.active; })
                .sort(function(a, b) { return a.lastSeen < b.lastSeen ? 1 : a.lastSeen > b.lastSeen ? -1 : 0; });

            select.innerHTML = '';

            function addGroup(label, group) {
                if (!group.length) return;
                var optgroup = document.createElement('optgroup');
                optgroup.label = label;
                group.forEach(function(f) {
                    var option = document.createElement('option');
                    option.value = f.id;
                    var acresText = f.acres != null ? Math.round(f.acres).toLocaleString() + ' ac' : 'size unknown';
                    option.textContent = f.name + ' (' + acresText + ')';
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            }

            addGroup('Active fires', active);
            addGroup('Past fires', past);

            if (!fires.length) {
                var emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = 'No fires archived yet';
                select.appendChild(emptyOption);
                dateLabel.textContent = 'No fires archived yet';
                return;
            }

            // Default to the largest active fire, or the most recently-seen
            // past fire if nothing is currently active.
            var defaultFire = active[0] || past[0];
            if (defaultFire) {
                select.value = defaultFire.id;
                loadFire(defaultFire.id);
            }
        }

        // Lazy: fire-index.json plus the auto-selected default fire's full
        // perimeter history (which can run several MB -- the archiving
        // workflow has its own step warning above 1-5MB, and the current
        // default fire is ~9MB) used to fetch unconditionally on every
        // page load, even for the majority of visits that never open this
        // tab. Deferred until the Perimeters tab is actually clicked --
        // dataLoadStarted guards against firing twice on repeat clicks.
        // Kept as the one thing this file defers rather than restructuring
        // the whole setup (map creation, event wiring) to be lazy too:
        // Leaflet map creation itself is cheap and already handled while
        // hidden (see FireDataUtils.fixLeafletSizeOnVisibility below), so
        // deferring just the actual network cost is the smallest change
        // that captures the real savings.
        var dataLoadStarted = false;

        function loadInitialData() {
            if (dataLoadStarted) return;
            dataLoadStarted = true;
            FireDataUtils.fetchJSON(INDEX_URL).then(populateFireList).catch(function(err) {
                console.error('Unable to load fire index:', err);
                select.innerHTML = '<option value="">Unable to load fire list</option>';
                dateLabel.textContent = 'Unable to load fire list';
            });
        }

        // tabs.js builds each tab's nav button dynamically with no id/data
        // attribute tying it back to its panel, so this matches on the
        // button text (set from the panel's data-title) rather than
        // modifying tabs.js itself to add a hook -- keeps this lazy-load
        // entirely contained to this one file.
        var perimetersTabButton = Array.prototype.filter.call(
            document.querySelectorAll('.tab-nav-button'),
            function(btn) { return btn.textContent === 'Perimeters'; }
        )[0];

        if (perimetersTabButton) {
            perimetersTabButton.addEventListener('click', loadInitialData);
        } else {
            // Couldn't find the tab button for some reason -- fall back to
            // loading immediately rather than silently never loading this
            // tab's data at all.
            loadInitialData();
        }

        select.addEventListener('mousedown', captureScroll);
        select.addEventListener('focus', captureScroll);

        select.addEventListener('change', function() {
            if (select.value) {
                loadFire(select.value);
            }
        });

        slider.addEventListener('input', function() {
            stopPlaying();
            renderDay(parseInt(slider.value, 10));
        });

        playButton.addEventListener('click', function() {
            if (playTimer) {
                stopPlaying();
                return;
            }
            if (!currentHistory.length) return;

            // If already at (or past) the end, restart from the beginning.
            var startIndex = parseInt(slider.value, 10) >= currentHistory.length - 1 ? 0 : parseInt(slider.value, 10);
            renderDay(startIndex);

            playButton.textContent = '\u23F8'; // pause symbol
            playButton.setAttribute('aria-label', 'Pause growth animation');

            playTimer = setInterval(function() {
                var next = parseInt(slider.value, 10) + 1;
                if (next > currentHistory.length - 1) {
                    stopPlaying();
                    return;
                }
                renderDay(next);
            }, PLAY_INTERVAL_MS);
        });

        FireDataUtils.fixLeafletSizeOnVisibility(map, mapEl, fitToCurrentLayer);
    });
})();