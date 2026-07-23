// U.S./Colorado wildfire map. Loads current point-location wildfire data
// into a Leaflet map, with three renderings (all active, 25K+ acres,
// Type 1/2 only) controlled by the "Filter by fire type" buttons. Fire
// perimeter history lives on its own tab (see perimeters.js).
(function() {
    'use strict';

    var POINT_DATA_URL = 'https://raw.githubusercontent.com/githamm/wildfire-data/main/map_data.json';

    // Marker dot diameter range -- the curve shape and acreage reference
    // are shared (see FireDataUtils.sizeForAcres) with the chart's bubble
    // sizing, but the actual min/max pixels are tuned per context: a
    // small map marker and a chart bubble want very different absolute
    // sizes.
    var DOT_MIN = 6;
    var DOT_MAX = 30;

    // Flat pixel amounts, not proportional to dot size: the ring always
    // sits RING_GAP past the dot's edge and always grows by RING_GROWTH
    // during the pulse, regardless of how big the dot itself is. A
    // proportional gap/growth (dot size * some ratio) meant most fires --
    // which are small -- had a barely-visible pulse, since a percentage of
    // a small number is smaller still. A flat amount keeps the pulse
    // equally noticeable on every marker, small or large.
    var RING_GAP = 2;
    var RING_GROWTH = 5;

    // Respected manually because SMIL <animate> (below) isn't covered by
    // the CSS prefers-reduced-motion media query the way a CSS animation
    // would be -- checked once, not per marker.
    var PREFERS_REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Headroom (px) past the ring's own peak diameter (dot + RING_GAP +
    // RING_GROWTH, doubled for a full diameter) plus its stroke width and
    // antialiasing, so it never renders past the icon's own box.
    function boxForDot(dotDiameter) {
        var ringPeakR = dotDiameter / 2 + RING_GAP + RING_GROWTH;
        return Math.ceil(ringPeakR * 2 + 4);
    }

    // Solid dot plus a ring that expands and fades out around it, reset,
    // and repeats -- a "radar ping" rather than a static breathing ring.
    // Built as raw SVG with native <animate> elements (SMIL), not a CSS
    // div + @keyframes -- animating a CSS-bordered circle via
    // transform:scale() also scales the border stroke itself every frame,
    // which read as jittery/self-redrawing at these small pixel sizes.
    // SVG's <animate> instead interpolates the actual radius while the
    // stroke-width attribute stays fixed, which is what a genuinely smooth
    // pulse needs. Shared by live map markers (buildPulseIcon) and the
    // "Markers"/"Status" legend swatches (populateSizeLegend,
    // populateStatusLegend), so all three render identically.
    function buildMarkerSvg(dotDiameter, color, box) {
        var center = box / 2;
        var dotR = (dotDiameter / 2).toFixed(2);
        var ringRestR = (dotDiameter / 2 + RING_GAP).toFixed(2);
        var ringPeakR = (dotDiameter / 2 + RING_GAP + RING_GROWTH).toFixed(2);

        var ringAnimation = PREFERS_REDUCED_MOTION ? '' :
            '<animate attributeName="r" values="' + ringRestR + ';' + ringPeakR + ';' + ringRestR + '" dur="2s" repeatCount="indefinite"/>' +
            '<animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite"/>';
        var ringOpacity = '0.35';

        return '<svg width="' + box + '" height="' + box + '" viewBox="0 0 ' + box + ' ' + box + '" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="' + center + '" cy="' + center + '" r="' + ringRestR + '" fill="none" stroke="' + color + '" stroke-width="1.5" opacity="' + ringOpacity + '">' +
                ringAnimation +
            '</circle>' +
            // A thin light stroke, always on regardless of basemap: the
            // muted status colors read fine against the light Topo layer,
            // but can blend into brown/green satellite imagery (dry
            // terrain, forest canopy) without something guaranteeing
            // contrast against any background color.
            '<circle cx="' + center + '" cy="' + center + '" r="' + dotR + '" fill="' + color + '" stroke="rgba(255,255,255,.85)" stroke-width="1"/>' +
            '</svg>';
    }

    // A live-location-style marker (solid dot with an expanding, fading
    // ring around it) instead of a static fire icon -- reads as "actively
    // tracked" rather than a fixed map pin, which fits an incident that's
    // still moving.
    function buildPulseIcon(acres, percentContained) {
        var dotDiameter = FireDataUtils.sizeForAcres(acres, DOT_MIN, DOT_MAX);
        var color = FireDataUtils.colorForContainment(percentContained);
        var box = boxForDot(dotDiameter);
        return L.divIcon({
            className: 'fire-pulse-marker-wrapper',
            html: buildMarkerSvg(dotDiameter, color, box),
            iconSize: [box, box],
            iconAnchor: [box / 2, box / 2],
            popupAnchor: [0, -box / 2]
        });
    }

    function normalizePointProperties(feature) {
        var p = feature.properties;
        return {
            incidentName: p.IncidentName,
            cause: p.FireCause,
            acres: p.IncidentSize,
            percentContained: p.PercentContained,
            personnel: p.TotalIncidentPersonnel,
            complexity: p.IncidentComplexityLevel,
            city: p.POOCity,
            landownerCategory: p.POOLandownerCategory,
            county: p.POOCounty,
            discoveryDate: p.FireDiscoveryDateTime,
            modifiedDate: p.ModifiedOnDateTime_dt,
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0]
        };
    }

    function buildPopupHtml(props) {
        return FireDataUtils.buildFireInfoHtml({
            incidentName: props.incidentName,
            cause: props.cause,
            acres: props.acres,
            percentContained: props.percentContained,
            personnel: props.personnel,
            complexity: props.complexity,
            city: props.city,
            landownerCategory: props.landownerCategory,
            county: props.county,
            discoveryDateFormatted: props.discoveryDate ? moment(props.discoveryDate).format('LL') : null,
            updatedLabel: 'Updated',
            updatedDateFormatted: props.modifiedDate ? moment(props.modifiedDate).format('LLL') : null,
            lat: props.lat,
            lng: props.lng,
            // Same color the marker itself is drawn with -- the popup
            // should visually confirm what you already saw before clicking.
            statusColor: FireDataUtils.colorForContainment(props.percentContained)
        });
    }

    // Note: the "all wildfires" filter below intentionally groups with
    // parentheses (contained/size checks apply to BOTH WF and CX types).
    // The original code's operator precedence let any CX-type incident
    // through regardless of size/containment - fixed here.

    function isWildfireOrComplex(feature) {
        var p = feature.properties;
        return p.PercentContained != 100 && p.IncidentSize > 1 && (p.IncidentTypeCategory === 'WF' || p.IncidentTypeCategory === 'CX');
    }

    function isActiveWildfire(feature) {
        var p = feature.properties;
        return p.PercentContained != 100 && p.IncidentSize >= 25000 && p.IncidentTypeCategory === 'WF';
    }

    function isType1Or2Wildfire(feature) {
        var p = feature.properties;
        return p.IncidentTypeCategory === 'WF' && (p.IncidentComplexityLevel === 'Type 1 Incident' || p.IncidentComplexityLevel === 'Type 2 Incident');
    }

    function createPointLayer(data, filterFn) {
        return L.geoJson(data, {
            filter: filterFn,
            pointToLayer: function(feature, latlng) {
                var props = normalizePointProperties(feature);
                var popupHtml = buildPopupHtml(props);
                return L.marker(latlng, { icon: buildPulseIcon(props.acres, props.percentContained) }).bindPopup(popupHtml);
            }
        });
    }

    // Log-spaced reference points (not the actual data) spanning the
    // sizing curve end to end, so the legend reads as a graduated scale --
    // circles growing left to right along a shared baseline -- rather than
    // a handful of disconnected examples. Computed from FireDataUtils.sizeForAcres()
    // rather than hand-copied, so it can't drift out of sync with it. Kept
    // to 4 points -- enough to show the scale's shape without turning the
    // legend into its own size-reading exercise.
    var LEGEND_ACRES = [100, 5000, 50000, 300000];

    // A proportional-symbol scale: circles of increasing size sharing a
    // common baseline, acreage labeled underneath each. Bottom-aligning the
    // row (see .size-scale's align-items in styles.css) works because
    // every item is [swatch, label] stacked in a column of its own -- the
    // label's height is constant across items, so aligning each column's
    // *bottom* edge also aligns every swatch's bottom edge, regardless of
    // how tall the swatch itself is.
    function populateSizeLegend() {
        var container = document.getElementById('marker-size-legend');
        if (!container) return;

        container.innerHTML = LEGEND_ACRES.map(function(acres, index) {
            var dotDiameter = FireDataUtils.sizeForAcres(acres, DOT_MIN, DOT_MAX);
            var box = boxForDot(dotDiameter);
            var isLast = index === LEGEND_ACRES.length - 1;
            var label = Math.round(acres).toLocaleString() + (isLast ? '+' : '');

            return '<div class="size-scale-item">' +
                '<span class="legend-pulse-swatch" style="width:' + box + 'px;height:' + box + 'px">' + buildMarkerSvg(dotDiameter, 'var(--marker-fire)', box) + '</span>' +
                '<p class="size-scale-label">' + label + '</p>' +
                '</div>';
        }).join('');
    }

    // Representative containment percentages spanning colorForContainment's
    // three bands. All swatches use the same reference acreage so size
    // stays constant and color is the only thing varying -- this legend is
    // about status, not size (see populateSizeLegend for that).
    // Labeled by the actual percentage range each color covers, not a word
    // like "Uncontained" -- the red band covers 0-24%, which includes
    // fires already a quarter contained, so a categorical label like that
    // overstates how little containment progress has been made.
    var STATUS_LEGEND = [
        { percentContained: 10, label: '0-24% contained' },
        { percentContained: 50, label: '25-74% contained' },
        { percentContained: 90, label: '75%+ contained' }
    ];
    var STATUS_LEGEND_REFERENCE_ACRES = 5000;

    function populateStatusLegend() {
        var list = document.getElementById('marker-status-legend');
        if (!list) return;

        var dotDiameter = FireDataUtils.sizeForAcres(STATUS_LEGEND_REFERENCE_ACRES, DOT_MIN, DOT_MAX);
        var box = boxForDot(dotDiameter);

        list.innerHTML = STATUS_LEGEND.map(function(entry) {
            var color = FireDataUtils.colorForContainment(entry.percentContained);
            return '<li class="icon-list-item">' +
                '<span class="legend-pulse-swatch" style="width:' + box + 'px;height:' + box + 'px">' + buildMarkerSvg(dotDiameter, color, box) + '</span>' +
                '<p class="legend-marker-text">' + entry.label + '</p>' +
                '</li>';
        }).join('');
    }

    document.addEventListener('DOMContentLoaded', function() {
        var mapEl = document.getElementById('map');
        if (!mapEl) return;

        populateSizeLegend();
        populateStatusLegend();

        var map = L.map('map', {
            center: [37.0119, -105.4842],
            zoom: 6,
            minZoom: 3,
            scrollWheelZoom: true,
            preferCanvas: true
        });

        FireDataUtils.addBaseLayerSwitcher(map);
        FireDataUtils.fixLeafletSizeOnVisibility(map, mapEl);

        var layers = {};

        function showLayer(key) {
            Object.keys(layers).forEach(function(layerKey) {
                map.removeLayer(layers[layerKey]);
            });
            if (layers[key]) {
                map.addLayer(layers[key]);
            }
        }

        FireDataUtils.fetchJSON(POINT_DATA_URL).then(function(data) {
            layers.all = createPointLayer(data, isWildfireOrComplex);
            layers.active = createPointLayer(data, isActiveWildfire);
            layers.type1 = createPointLayer(data, isType1Or2Wildfire);
            layers.all.addTo(map);
        }).catch(function(err) {
            console.error('Unable to load wildfire point data:', err);
        });

        // Segmented button group, not radio inputs -- see the filter
        // markup in all_graphics.html. data-filter on each button is the
        // layer key directly, so there's no separate id-to-key mapping to
        // keep in sync.
        var filterButtons = document.querySelectorAll('#wildfire-filter-toggle .filter-toggle-btn');
        filterButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                filterButtons.forEach(function(b) {
                    b.classList.remove('active');
                });
                button.classList.add('active');
                showLayer(button.getAttribute('data-filter'));
            });
        });
    });
})();