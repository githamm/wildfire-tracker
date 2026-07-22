// Shared helpers used across map.js, table.js, and chart.js.
// Centralizing these avoids keeping duplicate "fire name" hacks and
// formatting/null-handling logic in sync across three separate files.
(function(window) {
    'use strict';

    // Temporary corrections for specific incidents. Add or remove entries
    // here instead of editing map.js / table.js / chart.js individually.
    var FIRE_OVERRIDES = {
        'Stone Mtn': { name: 'Stone Canyon' },
        'Quarry': { cause: 'Undetermined' }
    };

    // Shared, memoized by URL -- every tab's script fetches its data on
    // page load regardless of which tab is active, and two different URLs
    // (map_data.json, table_data.json) each happen to be needed by two
    // different scripts. Without sharing this, map.js/table.js both fetch
    // map_data.json independently, and table.js/chart.js both fetch
    // table_data.json independently -- four requests firing on every page
    // load for what's really only two distinct resources. Caching the
    // promise itself (not just the parsed result) means a second caller
    // that arrives while the first request is still in flight gets the
    // same in-progress request instead of starting a duplicate one.
    // Safe to share the same parsed object across callers since nothing
    // downstream mutates it -- every consumer only reads it or derives new
    // arrays/objects from it (filter/map), never writes back into it.
    var jsonRequestCache = {};

    function fetchJSON(url) {
        if (!jsonRequestCache[url]) {
            jsonRequestCache[url] = fetch(url).then(function(response) {
                if (!response.ok) {
                    throw new Error('Request failed: ' + response.status + ' (' + url + ')');
                }
                return response.json();
            });
        }
        return jsonRequestCache[url];
    }

    function applyFireOverrides(name, cause) {
        var override = FIRE_OVERRIDES[name];
        if (!override) {
            return { name: name, cause: cause };
        }
        return {
            name: override.name || name,
            cause: override.cause || cause
        };
    }

    function lowercaseFirst(str) {
        if (!str) return str;
        return str.charAt(0).toLowerCase() + str.slice(1);
    }

    // Produces "on state land ", "on private land ", etc. Categories not in
    // this list (e.g. federal agency names) are used as-is.
    var LOWERCASED_LANDOWNER_CATEGORIES = ['Private', 'County', 'State', 'Tribal'];

    function describeLandowner(category) {
        if (!category) return '';
        var label = LOWERCASED_LANDOWNER_CATEGORIES.indexOf(category) !== -1 ?
            lowercaseFirst(category) : category;
        return 'on ' + label + ' land ';
    }

    function formatAcres(acres) {
        if (acres == null) {
            return { acres: 'Unavailable', squareMiles: 'Unavailable' };
        }
        return {
            acres: Math.round(acres).toLocaleString(),
            squareMiles: Math.round((acres / 640) * 10) / 10
        };
    }

    function orUnavailable(value, suffix) {
        return value != null ? value + (suffix || '') : 'Unavailable';
    }

    // Shared by table.js and chart.js, which both build this same row
    // shape from the same table_data.json features -- previously each had
    // its own copy of this mapping, independently.
    // Deliberately left raw (no FIRE_OVERRIDES applied, percent_contained
    // kept as a number rather than formatted into a string): callers
    // differ in what they need from these values downstream in a way that
    // would break if either were baked in here. table.js sorts numerically
    // by percent_contained and matches fire_name against map_data.json's
    // own raw IncidentName (see isRowActive) -- an overridden display name
    // or a pre-formatted "45%" string would break both. Apply overrides/
    // formatting in each caller, at the point the value is actually
    // displayed.
    function normalizeTableRow(feature) {
        var p = feature.properties;
        return {
            fire_discovery_date_time: p.FireDiscoveryDateTime,
            fire_name: p.IncidentName,
            acres_burned: p.IncidentSize,
            percent_contained: p.PercentContained,
            fire_cause: p.FireCause,
            county: p.POOCounty
        };
    }

    // Personnel counts can run into the thousands on large Type 1 incidents,
    // so this adds comma grouping the same way formatAcres does for acreage.
    function formatPersonnel(value) {
        if (value == null) return 'Unavailable';
        return Math.round(value).toLocaleString();
    }

    // Continuous size, shared by the map's marker dots and the chart's
    // bubbles so both use the same curve rather than drifting apart (the
    // map used a plain sqrt for a while, then log, then this; the chart
    // separately used a plain sqrt with its own constant -- two different
    // scalings for the same underlying acreage). Callers pass their own
    // min/max pixel range (a map marker and a chart bubble want very
    // different absolute sizes), but the shape of the curve and the
    // acreage it's normalized against are the same everywhere.
    //
    // Diameter/radius scales with (acres/SIZE_REFERENCE_ACRES)^SIZE_EXPONENT.
    // Neither textbook curve worked well across this data's ~30,000x range
    // (single-digit acres up to 300k+): sqrt (exponent 0.5, the "honest
    // area encoding") compresses 10/100/1,000/10,000-acre fires all within
    // a couple pixels of each other and of the floor -- not distinguishable.
    // Log fixes that but overcorrects the other way -- a 10-acre fire comes
    // out over a third the size of a 300,000-acre one, since log flattens
    // the *extremes* together precisely because it's built to give even
    // steps per order of magnitude. A shallower exponent (0.3, between the
    // two) keeps small fires appropriately small next to the biggest ones
    // while still giving small/medium acreages clearly different,
    // perceptible sizes rather than bunching them at the floor.
    // The tradeoff: size no longer scales strictly proportionally with
    // acreage the way a sqrt encoding would -- this is a magnitude
    // indicator, not a literal to-scale area map (same tradeoff maps of
    // earthquake magnitude or population make, for the same reason).
    var SIZE_REFERENCE_ACRES = 300000;
    var SIZE_EXPONENT = 0.3;

    function sizeForAcres(acres, min, max) {
        var clamped = Math.min(Math.max(0, acres || 0), SIZE_REFERENCE_ACRES);
        var scale = Math.pow(clamped / SIZE_REFERENCE_ACRES, SIZE_EXPONENT);
        return min + (max - min) * scale;
    }

    // Color encodes containment status, a second at-a-glance signal
    // independent of size -- unknown/low containment (still dangerous,
    // could be a brand-new fire NIFC hasn't assessed yet) reads the same
    // as clearly-uncontained rather than defaulting to a calmer color for
    // missing data. Shared by the map marker, the map popup heading, the
    // table's containment indicator, and (indirectly, via the same
    // thresholds) anywhere else that needs to say "how contained is this."
    // No ">=100" branch: the map's data source only ever includes
    // currently-tracked incidents, and a fire drops out of that feed
    // entirely once it's fully contained -- reaching this app with
    // PercentContained === 100 essentially never happens. --marker-
    // contained is repurposed to mean "nearly there" (75%+) instead, since
    // that's the calmest state this app can actually show.
    function colorForContainment(percentContained) {
        if (percentContained == null || percentContained < 25) return 'var(--marker-fire)';
        if (percentContained < 75) return 'var(--marker-amber)';
        return 'var(--marker-contained)';
    }

    // Acreage and percentage change in mapped-perimeter acreage between two
    // consecutive daily snapshots, e.g. "+320 acres (+12.4%)". Returns
    // 'Unavailable' rather than throwing/NaN when either side is missing or
    // the previous acreage was 0 (divide-by-zero).
    function formatGrowthChange(current, previous) {
        if (current == null || previous == null || previous === 0) {
            return 'Unavailable';
        }

        var acresDelta = Math.round(current - previous);
        var acresSign = acresDelta > 0 ? '+' : '';
        var acresText = acresSign + acresDelta.toLocaleString() + ' acres';

        var pct = ((current - previous) / previous) * 100;
        var roundedPct = Math.round(pct * 10) / 10;
        var pctSign = roundedPct > 0 ? '+' : '';
        var pctText = pctSign + roundedPct + '%';

        return acresText + ' (' + pctText + ')';
    }

    // Leaflet caches its container's pixel size internally. If a map's tab
    // panel is hidden (display:none) -- whether at page load, or later when
    // the user navigates away and back -- that cached size goes stale, and
    // tiles/popups/pans compute against the wrong dimensions once the panel
    // is shown again (missing tiles, a visible "jump" on the next pan).
    // Call this once after creating a map to keep it correctly sized across
    // every tab switch, not just the first time the panel appears.
    function fixLeafletSizeOnVisibility(map, containerEl, onVisible) {
        if (!window.IntersectionObserver || !containerEl) return;
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    map.invalidateSize();
                    if (typeof onVisible === 'function') {
                        onVisible();
                    }
                }
            });
        });
        observer.observe(containerEl);
    }

    // Leaflet layer instances can only belong to one map at a time, so
    // map.js and perimeters.js each need their own fresh pair -- this keeps
    // the URLs/attribution/labels in sync between the two rather than
    // duplicating them. Adds Leaflet's built-in base-layer switcher (the
    // small layers-stack icon in the map corner) so both maps get the same
    // topo/satellite toggle with no custom UI needed.
    function addBaseLayerSwitcher(map) {
        var topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
        });
        var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
        });
        // A transparent overlay of place names/boundaries/roads, meant to
        // sit on top of the satellite imagery (which has no labels of its
        // own). Topo already has its own labels baked in, so this only
        // makes sense paired with Satellite -- see the baselayerchange
        // listener below.
        //
        // Rendered into a dedicated pane (z-index 350) rather than the
        // default tilePane (200, shared with both base layers) or
        // overlayPane (400, shared with fire markers/polygons/popups):
        // this guarantees labels always draw above the base tiles but
        // always stay below the actual fire data, regardless of DOM
        // insertion order. pointerEvents: none so the labels never
        // intercept clicks meant for a marker or perimeter underneath them.
        var labelsPaneName = 'referenceLabelsPane';
        if (!map.getPane(labelsPaneName)) {
            map.createPane(labelsPaneName);
            map.getPane(labelsPaneName).style.zIndex = 350;
            map.getPane(labelsPaneName).style.pointerEvents = 'none';
        }

        var labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Sources: Esri, Garmin, HERE, &copy; OpenStreetMap contributors, and the GIS User Community',
            pane: labelsPaneName
        });

        topo.addTo(map);

        var activeLayer = topo;

        // Labels always follow the base layer automatically -- shown with
        // Satellite, hidden with Topo (which already has its own labels) --
        // with no separate toggle for the user to manage.
        function selectLayer(nextLayer, nextButton, otherButton) {
            if (nextLayer === activeLayer) return;
            map.removeLayer(activeLayer);
            map.addLayer(nextLayer);
            activeLayer = nextLayer;
            nextButton.classList.add('active');
            otherButton.classList.remove('active');
            if (nextLayer === satellite) {
                map.addLayer(labels);
            } else {
                map.removeLayer(labels);
            }
        }

        // A compact "Map / Sat" segmented toggle instead of Leaflet's
        // default layers control (a collapsed icon that only reveals its
        // options on hover/click). Built as its own L.Control with plain
        // closures over this call's own map/layer variables -- not global
        // ids/functions -- since this runs twice on one page (the Map tab
        // and the Perimeters tab each get their own Leaflet map instance),
        // and hardcoded element ids would collide between them.
        var LayerToggleControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function() {
                var container = L.DomUtil.create('div', 'map-layer-toggle');
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                var mapButton = L.DomUtil.create('button', 'map-layer-toggle-btn active', container);
                mapButton.type = 'button';
                mapButton.textContent = 'Map';

                var satButton = L.DomUtil.create('button', 'map-layer-toggle-btn', container);
                satButton.type = 'button';
                satButton.textContent = 'Sat';

                L.DomEvent.on(mapButton, 'click', function() {
                    selectLayer(topo, mapButton, satButton);
                });
                L.DomEvent.on(satButton, 'click', function() {
                    selectLayer(satellite, satButton, mapButton);
                });

                return container;
            }
        });

        map.addControl(new LayerToggleControl());

        return topo;
    }

    // Builds the same fire-detail markup used both in the map's Leaflet
    // popups and the Perimeters tab's info card, so the two are guaranteed
    // to read identically rather than drifting out of sync over time.
    //
    // Expects pre-formatted date strings rather than raw values, since
    // callers differ in what they're formatting from: map.js has full
    // timestamps (wants time-of-day included), while perimeters.js has
    // plain "YYYY-MM-DD" archived calendar dates (no time-of-day to show).
    // Formatting stays the caller's responsibility so this function doesn't
    // need to know or guess which kind of date it received.
    //
    // props: {
    //   incidentName, cause, acres, percentContained, personnel, complexity,
    //   city, landownerCategory, county,
    //   discoveryDateFormatted, updatedLabel, updatedDateFormatted,
    //   lat, lng (optional -- omit to skip the Google Maps link),
    //   statusColor (optional -- a small dot shown before the Containment
    //   value; the map popup passes the same containment-status color the
    //   marker itself uses (see colorForContainment in map.js), so the
    //   popup visually confirms what the marker already showed before it
    //   was clicked. The Perimeters info card doesn't set this, so its
    //   Containment row has no dot.)
    // }
    function buildFireInfoHtml(props) {
        var overrides = applyFireOverrides(props.incidentName, props.cause);
        var acreInfo = formatAcres(props.acres);
        var percentContained = orUnavailable(props.percentContained, '%');
        var personnel = formatPersonnel(props.personnel);
        var complexity = orUnavailable(props.complexity);
        var city = props.city ? 'near ' + props.city : '';
        var landowner = describeLandowner(props.landownerCategory);
        var county = props.county || 'Unavailable';
        var cause = orUnavailable(overrides.cause);
        var discoveryDate = props.discoveryDateFormatted || 'Unavailable';
        var updatedLabel = props.updatedLabel || 'Updated';
        var updatedDate = props.updatedDateFormatted || 'Unavailable';

        function row(label, value) {
            return '<div class="fire-info-row"><span class="fire-info-label">' + label + '</span><strong>' + value + '</strong></div>';
        }

        // Only the Perimeters tab passes growthChangeLabel -- map/table
        // popups never set it, so this row simply doesn't appear there.
        // Gated on the label (always supplied by the Perimeters tab, even
        // for a fire's first mapped perimeter) rather than on growthChange
        // itself, so the row's presence doesn't flip on/off as the slider
        // moves -- that used to shift the rest of the card up and down.
        // The label names the actual comparison date (passed by the
        // caller, since only it knows the previous entry's date) rather
        // than the vaguer "previous perimeter", since perimeters aren't
        // always mapped on consecutive days.
        var growthRow = props.growthChangeLabel != null ?
            row(props.growthChangeLabel, props.growthChange || 'Unavailable') : '';

        // Only the Perimeters tab passes daysBurning, for the same reason.
        var daysBurningRow = props.daysBurning != null ?
            row('Days burning', props.daysBurning) : '';

        var mapsLinkHtml = '';
        if (props.lat != null && props.lng != null) {
            var mapsLink = 'https://www.google.com/maps?q=loc:' + props.lat + ',+' + props.lng + '&t=h';
            mapsLinkHtml = '<p class="fire-info-maps-link"><a href="' + mapsLink + '" target="_blank">Open in Google maps</a></p>';
        }

        var containmentDot = props.statusColor ?
            '<span class="fire-info-status-dot" style="background:' + props.statusColor + '"></span>' : '';

        // .fire-info-grid uses CSS auto-fit/minmax, so this same markup
        // naturally renders as a single column in a narrow Leaflet popup
        // and multiple columns in the wider Perimeters info card -- no
        // separate layout logic needed per context.
        return '<h3 class="fire-name">' + overrides.name + '<br><span class="update">' + updatedLabel + ' ' + updatedDate + '</span></h3>' +
            '<div class="fire-info-grid">' +
            row('Acres', acreInfo.acres + ' (' + acreInfo.squareMiles + ' sq. mi.)') +
            growthRow +
            row('Containment', containmentDot + percentContained) +
            row('Cause', cause) +
            row('Discovered', discoveryDate) +
            daysBurningRow +
            row('Personnel assigned', personnel) +
            row('Fire complexity', complexity) +
            '</div>' +
            '<p class="fire-info-note">The fire is burning ' + landowner + city + ' in ' + county + ' County.</p>' +
            mapsLinkHtml;
    }

    window.FireDataUtils = {
        fetchJSON: fetchJSON,
        applyFireOverrides: applyFireOverrides,
        lowercaseFirst: lowercaseFirst,
        describeLandowner: describeLandowner,
        formatAcres: formatAcres,
        formatPersonnel: formatPersonnel,
        sizeForAcres: sizeForAcres,
        colorForContainment: colorForContainment,
        formatGrowthChange: formatGrowthChange,
        orUnavailable: orUnavailable,
        normalizeTableRow: normalizeTableRow,
        fixLeafletSizeOnVisibility: fixLeafletSizeOnVisibility,
        addBaseLayerSwitcher: addBaseLayerSwitcher,
        buildFireInfoHtml: buildFireInfoHtml
    };
})(window);