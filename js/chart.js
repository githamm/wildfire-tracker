// Large-wildfire bubble chart. Still uses Chart.js (v2) for rendering,
// but no longer depends on jQuery for data loading or DOM readiness.
(function() {
    'use strict';

    var DATA_URL = 'https://raw.githubusercontent.com/githamm/wildfire-data/main/table_data.json';
    var MIN_ACRES_FOR_CHART = 1000;

    // Bubble radius range for FireDataUtils.sizeForAcres -- same curve
    // and 300k-acre reference the map's markers use, but the map's tiny
    // 6-30px marker range would look sparse on a dedicated bubble chart,
    // so this uses its own, bigger min/max instead.
    var CHART_MIN_RADIUS = 4;
    var CHART_MAX_RADIUS = 45;

    // Muted to match the rest of the app's palette (same tone as
    // --marker-fire/--marker-contained) instead of raw, saturated RGB
    // primaries -- these were the loudest colors on the page. Must be kept
    // in sync by hand with #red/#green/#blue in styles.css -- see the
    // comment there for why.
    var CHART_COLORS = {
        red: 'rgba(163, 42, 26, .75)',
        blue: 'rgba(66, 99, 156, .75)',
        green: 'rgba(94, 122, 82, .75)',
        gray: 'rgba(136, 136, 136, .75)'
    };

    function colorForCause(cause) {
        if (cause === 'Human') return CHART_COLORS.red;
        if (cause === 'Natural') return CHART_COLORS.green;
        if (cause === 'Undetermined') return CHART_COLORS.blue;
        return CHART_COLORS.gray;
    }

    document.addEventListener('DOMContentLoaded', function() {
        var canvas = document.getElementById('container');
        if (!canvas) return;

        // Same table_data.json table.js fetches -- FireDataUtils.fetchJSON
        // is memoized by URL, so whichever of the two scripts runs first
        // makes the actual network request and the other reuses it.
        FireDataUtils.fetchJSON(DATA_URL)
            .then(function(result) {
                var bigFires = result.features
                    .filter(function(feature) {
                        return feature.properties.IncidentSize >= MIN_ACRES_FOR_CHART;
                    })
                    .map(FireDataUtils.normalizeTableRow);

                // Overrides applied here, not inside normalizeTableRow --
                // colorForCause below needs the *overridden* cause (e.g.
                // FIRE_OVERRIDES can turn a raw cause into "Undetermined"),
                // so this has to happen before building chartPoints.
                // percent_contained stays a raw number until the tooltip
                // callback formats it, same reasoning as table.js.
                var chartPoints = bigFires.map(function(row) {
                    var overrides = FireDataUtils.applyFireOverrides(row.fire_name, row.fire_cause);
                    return {
                        x: row.fire_discovery_date_time,
                        y: row.acres_burned,
                        r: FireDataUtils.sizeForAcres(row.acres_burned, CHART_MIN_RADIUS, CHART_MAX_RADIUS),
                        name: overrides.name,
                        contained: row.percent_contained,
                        cause: overrides.cause,
                        county: row.county
                    };
                });

                var backgroundColors = chartPoints.map(function(point) {
                    return colorForCause(point.cause);
                });

                var ctx = canvas.getContext('2d');
                Chart.defaults.global.defaultFontFamily = 'IBM Plex Sans';
                Chart.defaults.global.defaultFontSize = 13;

                new Chart.Bubble(ctx, {
                    data: {
                        datasets: [{
                            backgroundColor: backgroundColors,
                            data: chartPoints
                        }]
                    },
                    options: {
                        title: {
                            display: true,
                            text: 'Large wildfires by acres burned, discovery date',
                            fontSize: 16
                        },
                        legend: {
                            display: false
                        },
                        layout: {
                            padding: { right: 25 }
                        },
                        scales: {
                            xAxes: [{
                                type: 'time',
                                time: {
                                    unit: 'week',
                                    displayFormats: { week: 'MMM DD' }
                                },
                                scaleLabel: {
                                    display: true,
                                    labelString: 'Discovery date'
                                },
                                gridLines: { display: true }
                            }],
                            yAxes: [{
                                scaleLabel: {
                                    display: true,
                                    labelString: 'Acres burned'
                                },
                                gridLines: { display: true },
                                ticks: {
                                    callback: function(value) {
                                        return value.toLocaleString();
                                    }
                                }
                            }]
                        },
                        tooltips: {
                            // Chart.js v2 draws tooltips on canvas, not as
                            // styleable DOM/CSS -- there's no literal way to
                            // reuse .fire-info-row/.fire-name here the way
                            // the map popup and Perimeters card do. This
                            // matches what the canvas API *can* control:
                            // the same color palette (background/border/
                            // font colors below are the same hex values as
                            // --surface/--rule/--accent/--ink elsewhere),
                            // an uppercase title to match .fire-name's
                            // text-transform (canvas fillText doesn't apply
                            // CSS text-transform, so it has to be
                            // uppercased in the string itself), and the
                            // same "Acres (sq. mi.)" formatting used
                            // everywhere else. displayColors stays off: it
                            // draws a color swatch next to every line in a
                            // multi-line label (all 5, once each, all the
                            // same color) rather than one swatch near the
                            // title the way the popup's colored heading
                            // works -- repeated identical squares next to
                            // each line looked odd, not like the clean,
                            // swatch-free tooltips elsewhere in the app.
                            displayColors: false,
                            callbacks: {
                                title: function(tooltipItem, all) {
                                    return [(all.datasets[tooltipItem[0].datasetIndex].data[tooltipItem[0].index].name + ' fire').toUpperCase()];
                                },
                                label: function(tooltipItem, all) {
                                    var point = all.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                                    var acreInfo = FireDataUtils.formatAcres(tooltipItem.yLabel);
                                    return [
                                        'Acres: ' + acreInfo.acres + ' (' + acreInfo.squareMiles + ' sq. mi.)',
                                        'Containment: ' + FireDataUtils.orUnavailable(point.contained, '%'),
                                        'Cause: ' + point.cause,
                                        'Discovered: ' + moment(tooltipItem.xLabel).format('MMM DD, YYYY'),
                                        'County: ' + point.county
                                    ];
                                }
                            },
                            backgroundColor: '#fff',
                            borderColor: '#E0E0DA',
                            borderWidth: 1,
                            titleFontSize: 18,
                            titleFontColor: '#C0281C',
                            bodyFontColor: '#0F0F0F',
                            bodyFontSize: 13,
                            cornerRadius: 6,
                            bodySpacing: 4,
                            titleMarginBottom: 7,
                            xPadding: 10,
                            yPadding: 15,
                            intersect: false
                        },
                        maintainAspectRatio: false
                    }
                });
            })
            .catch(function(err) {
                console.error('Unable to load wildfire chart data:', err);
            });
    });
})();