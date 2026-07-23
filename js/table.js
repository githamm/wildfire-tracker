// Custom sortable/filterable table. Replaces jQuery DataTables.
(function() {
    'use strict';

    var DATA_URL = 'https://raw.githubusercontent.com/githamm/wildfire-data/main/table_data.json';
    var MAP_DATA_URL = 'https://raw.githubusercontent.com/githamm/wildfire-data/main/map_data.json';
    var MIN_ACRES = 10;

    var tableBody;
    var allRows = [];
    var currentSort = { key: 'fire_discovery_date_time', direction: 'desc' };
    var showActiveOnly = false;

    // Fire names (lowercased/trimmed) currently present in map_data.json --
    // populated once at load, before renderRows() ever runs (see the
    // Promise.all below).
    var activeFireNames = {};

    function normalizeNameForMatch(name) {
        return (name || '').trim().toLowerCase();
    }

    // A pure containment/age heuristic used to be this table's only
    // signal, and it wasn't reliable on its own: a fire whose containment
    // was never updated to exactly 100% once crews moved on, or whose
    // discovery date is missing, could look "still active" indefinitely no
    // matter how old it actually was -- very old fires at 0% containment,
    // still flagged active. That's what motivated cross-referencing
    // map_data.json instead (see isRowActive below). But the two NIFC
    // services don't always agree: map_data.json comes from
    // WFIGS_Incident_Locations_Current, table_data.json from
    // WFIGS_Incident_Locations_YearToDate, and a small, brand-new fire can
    // land in the YearToDate archive before -- or without ever -- showing
    // up in Current (Current seems to skew toward larger/higher-priority
    // incidents). The "Round Bottom" fire is a real example: 21 acres,
    // discovered within the last day, null containment, absent from
    // map_data.json entirely. Bounded to a short recency window (not
    // indefinite) so this can't reintroduce the original bug -- an old
    // fire whose containment was simply never updated, looking active
    // forever.
    var RECENT_DISCOVERY_DAYS = 7;

    function isRecentlyDiscoveredWithUnknownContainment(row) {
        if (row.percent_contained != null || !row.fire_discovery_date_time) {
            return false;
        }
        var daysSinceDiscovery = moment().diff(moment(row.fire_discovery_date_time), 'days');
        return daysSinceDiscovery <= RECENT_DISCOVERY_DAYS;
    }

    // Active = present in map_data.json (still-tracked incidents -- the
    // more direct signal, see above), OR recently discovered with unknown
    // containment (catches a real fire the map cross-reference alone
    // would miss, per the Round Bottom case above).
    // Matched on the raw IncidentName (not the display name after
    // FIRE_OVERRIDES) since both files come from the same underlying NIFC
    // data and should agree on the raw name even where a local override
    // changes what's shown. Neither table_data.json nor map_data.json
    // expose a stable unique ID (only the perimeter feed does), so name
    // matching is the best available option -- restricted to Colorado
    // fires on the map side too (see the Promise.all below), since a
    // generic name recurring in a *different* state was turning into real,
    // not just theoretical, false positives. Two unrelated fires with an
    // identical name in the *same* state remains a small residual risk
    // this can't fully rule out.
    function isRowActive(row) {
        return !!activeFireNames[normalizeNameForMatch(row.fire_name)] ||
            isRecentlyDiscoveredWithUnknownContainment(row);
    }

    function compareRows(a, b) {
        var key = currentSort.key;
        var dir = currentSort.direction === 'asc' ? 1 : -1;
        var av = a[key];
        var bv = b[key];

        if (key === 'fire_discovery_date_time') {
            av = av ? new Date(av).getTime() : 0;
            bv = bv ? new Date(bv).getTime() : 0;
        } else if (key === 'acres_burned' || key === 'percent_contained') {
            av = av == null ? -Infinity : av;
            bv = bv == null ? -Infinity : bv;
        } else {
            av = (av || '').toString().toLowerCase();
            bv = (bv || '').toString().toLowerCase();
        }

        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
    }

    function renderRows() {
        var rows = showActiveOnly ? allRows.filter(isRowActive) : allRows.slice();
        rows.sort(compareRows);

        var fragment = document.createDocumentFragment();

        if (!rows.length) {
            var emptyRow = document.createElement('tr');
            var emptyCell = document.createElement('td');
            emptyCell.colSpan = 6;
            emptyCell.textContent = 'No wildfires match this filter.';
            emptyRow.appendChild(emptyCell);
            fragment.appendChild(emptyRow);
        }

        rows.forEach(function(row) {
            var overrides = FireDataUtils.applyFireOverrides(row.fire_name, row.fire_cause);
            var tr = document.createElement('tr');

            // A small dot instead of tinting the whole row -- flags an
            // actively-tracked fire without recoloring every cell's text.
            // Unlike the legend's dot (all_graphics.html, aria-hidden since
            // its adjacent "Active fire" text already says what it means),
            // this one has no adjacent text of its own, so it needs its
            // own accessible name -- title alone gives sighted mouse users
            // a tooltip but isn't reliably announced by screen readers.
            var nameCell = document.createElement('td');
            if (isRowActive(row)) {
                var activeDot = document.createElement('span');
                activeDot.className = 'table-status-dot table-status-dot--active';
                activeDot.title = 'Active fire';
                activeDot.setAttribute('role', 'img');
                activeDot.setAttribute('aria-label', 'Active fire');
                nameCell.appendChild(activeDot);
            }
            nameCell.appendChild(document.createTextNode(overrides.name));
            tr.appendChild(nameCell);

            [
                row.fire_discovery_date_time ? moment(row.fire_discovery_date_time).format('MM/DD/YYYY') : 'Unavailable',
                row.acres_burned != null ? Math.round(row.acres_burned).toLocaleString() : 'Unavailable',
                FireDataUtils.orUnavailable(row.percent_contained, '%'),
                FireDataUtils.orUnavailable(overrides.cause),
                row.county || 'Unavailable'
            ].forEach(function(text) {
                var td = document.createElement('td');
                td.textContent = text;
                tr.appendChild(td);
            });

            fragment.appendChild(tr);
        });

        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);
    }

    function setupSortHandlers() {
        var headerCells = document.querySelectorAll('#wildfire-table th[data-key]');

        headerCells.forEach(function(th) {
            th.addEventListener('click', function() {
                var key = th.getAttribute('data-key');
                if (currentSort.key === key) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.key = key;
                    currentSort.direction = 'asc';
                }

                headerCells.forEach(function(h) {
                    h.removeAttribute('data-sort-direction');
                });
                th.setAttribute('data-sort-direction', currentSort.direction);

                renderRows();
            });
        });

        // Reflect the initial sort (discovery date, descending) in the header.
        var initialHeader = document.querySelector('#wildfire-table th[data-key="' + currentSort.key + '"]');
        if (initialHeader) {
            initialHeader.setAttribute('data-sort-direction', currentSort.direction);
        }
    }

    // Button group, not radio inputs -- see the filter markup in
    // all_graphics.html. data-filter's value ('all'/'active') drives
    // showActiveOnly directly, matching the pattern already used for the
    // Map tab's filter toggle.
    function setupFilterHandlers() {
        var buttons = document.querySelectorAll('#wildfire-table-filter-toggle .filter-toggle-btn');
        buttons.forEach(function(button) {
            button.addEventListener('click', function() {
                buttons.forEach(function(b) {
                    b.classList.remove('active');
                });
                button.classList.add('active');
                showActiveOnly = button.getAttribute('data-filter') === 'active';
                renderRows();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        tableBody = document.querySelector('#wildfire-table tbody');
        if (!tableBody) return;

        setupSortHandlers();
        setupFilterHandlers();

        Promise.all([
            FireDataUtils.fetchJSON(DATA_URL),
            // If the map feed specifically fails to load, don't block the
            // whole table on it -- fall back to an empty feature list
            // (nothing shows as active) rather than showing neither.
            FireDataUtils.fetchJSON(MAP_DATA_URL).catch(function(err) {
                console.error('Unable to load map data for active-fire matching:', err);
                return { features: [] };
            })
        ])
            .then(function(results) {
                var tableResult = results[0];
                var mapResult = results[1];

                // map_data.json is nationwide, but this table is Colorado
                // only -- without the state check, a generic/common fire
                // name (e.g. "Turkey," "Bear Creek," "Rock Creek" -- exactly
                // the kind of name that recurs across many different fires
                // in different states and years) could match an unrelated,
                // currently-active fire somewhere else in the country,
                // wrongly flagging a long-resolved Colorado fire as active.
                activeFireNames = {};
                (mapResult.features || []).forEach(function(feature) {
                    var props = feature.properties || {};
                    if (props.IncidentName && props.POOState === 'US-CO') {
                        activeFireNames[normalizeNameForMatch(props.IncidentName)] = true;
                    }
                });

                allRows = tableResult.features
                    .filter(function(feature) {
                        return feature.properties.IncidentSize >= MIN_ACRES;
                    })
                    .map(FireDataUtils.normalizeTableRow);

                renderRows();
            })
            .catch(function(err) {
                console.error('Unable to load wildfire table data:', err);
                tableBody.innerHTML = '<tr><td colspan="6">Unable to load wildfire data. Please try again later.</td></tr>';
            });
    });
})();
