$(document).ready(function() {
    var chartColors = {
        red: 'rgba(192, 54, 57, .7)',
        blue: 'rgba(54, 56, 191, .7)',
        green: 'rgba(56, 191, 54, .7)',
        gray: 'rgba(0, 0, 0, .7)'
    };

    //$.getJSON("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/CY_WildlandFire_Locations_ToDate/FeatureServer/0/query?where=IncidentTypeCategory%20%3D%20'WF'%20AND%20POOState%20%3D%20'US-CO'&outFields=IncidentSize,FireCause,IncidentName,PercentContained,POOCounty,POOState,IncidentTypeCategory,FireDiscoveryDateTime&outSR=4326&f=json", function(result) {
    $.getJSON('https://raw.githubusercontent.com/githamm/wildfire-data/main/table_data.json', function(result) {
        var apiData = result.features;

        // Get fires bigger than 1,000 acres, change key names
        var bigFires = [];
        for (let i = 0; i < apiData.length; i++) {
            if (apiData[i].properties.IncidentSize >= 1000) {
                bigFires.push({
                    // fire_discovery_date_time: moment(apiData[i].properties.FireDiscoveryDateTime).format('M/D/YYYY'),
                    fire_discovery_date_time: moment(apiData[i].properties.FireDiscoveryDateTime).format(),
                    fire_name: apiData[i].properties.IncidentName,
                    acres_burned: apiData[i].properties.IncidentSize,
                    percent_contained: apiData[i].properties.PercentContained,
                    fire_cause: apiData[i].properties.FireCause,
                    county: apiData[i].properties.POOCounty
                })
            }
        }

        // Set containment to 'Unavailable' if no data
        for (let i = 0; i < bigFires.length; i++) {
            if (bigFires[i].percent_contained == null) {
                bigFires[i].percent_contained = 'Unavailable'
            } else bigFires[i].percent_contained = bigFires[i].percent_contained + '%'
        }

        // For temporary changes
        for (let i = 0; i < bigFires.length; i++) {
            if (bigFires[i].fire_name === 'Stone Mtn') {
                bigFires[i].fire_name = 'Stone Canyon'
            }
        }

        // Map data to chart data model
        var data = bigFires.map(function(row) {
            return {
                x: row['fire_discovery_date_time'],
                y: row['acres_burned'],
                r: row['acres_burned'] / 500,
                name: row['fire_name'],
                contained: row['percent_contained'],
                cause: row['fire_cause'],
                county: row['county']
            }
        })

        var scatterChartData = {
            datasets: [{
                backgroundColor: [],
                data: data,
            }]
        };

        var ctx = document.getElementById('container').getContext('2d');

        Chart.defaults.global.defaultFontFamily = 'Roboto Mono';
        Chart.defaults.global.defaultFontSize = 14;
        var myChart = new Chart.Bubble(ctx, {
            data: scatterChartData,
            options: {
                title: {
                    display: true,
                    text: 'Large wildfires by acres burned, discovery date',
                    fontSize: 16,
                },
                legend: {
                    display: false,
                },
                layout: {
                    padding: {
                        right: 25
                    }
                },
                scales: {
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                //'millisecond': 'MMM DD',
                                // 'second': 'MMM DD',
                                // 'minute': 'MMM DD',
                                // 'hour': 'MMM DD',
                                'day': 'MMM DD',
                                // 'week': 'MMM DD',
                                // 'month': 'MMM DD',
                                // 'quarter': 'MMM DD',
                                // 'year': 'MMM DD'
                            }
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Discovery date'
                        },
                        gridLines: {
                            display: true,
                        },
                        ticks: {
                            callback: function(value, index, values) {
                                // console.log(values);
                                return value
                                // return value.toLocaleString();
                            }
                        }
                    }],
                    yAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Acres burned'
                        },
                        gridLines: {
                            display: true,
                        },
                        ticks: {
                            callback: function(value, index, values) {
                                return value.toLocaleString();
                            }
                        }
                    }]
                },
                tooltips: {
                    displayColors: false,
                    callbacks: {
                        title: function(tooltipItem, all) {
                            return [
                                all.datasets[tooltipItem[0].datasetIndex].data[tooltipItem[0].index].name + ' fire',
                            ]
                        },
                        label: function(tooltipItem, all) {
                            var r = all.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].r * 500;
                            var contained = all.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].contained;
                            var cause = all.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].cause;
                            var county = all.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].county;
                            return [
                                'Acres burned: ' + tooltipItem.yLabel.toLocaleString(),
                                'Containment: ' + contained,
                                'Cause: ' + cause,
                                'Discovered: ' + moment(tooltipItem.xLabel).format('MMM DD, YYYY'),
                                'County: ' + county
                            ]
                        }
                    },
                    backgroundColor: 'rgba(241, 241, 241, .9)',
                    borderColor: 'rgba(0, 0, 0, .6)',
                    borderWidth: 1,
                    titleFontSize: 16,
                    titleFontColor: 'rgba(192, 54, 57, 1)',
                    bodyFontColor: '#000',
                    bodyFontSize: 14,
                    displayColors: false,
                    cornerRadius: 0,
                    bodySpacing: 4,
                    titleFontSize: 18,
                    titleMarginBottom: 7,
                    xPadding: 10,
                    yPadding: 15,
                    intersect: false
                },
                maintainAspectRatio: false //canvas fills available height
            }
        }); // end of chart

        // Add colors for circles
        var dataset = myChart.data.datasets[0];
        for (var i = 0; i < dataset.data.length; i++) {
            if (dataset.data[i].cause == 'Human') {
                dataset.backgroundColor[i] = chartColors.red;
                //pointBackGroundColors = 'red'
            } else if (dataset.data[i].cause == 'Natural') {
                dataset.backgroundColor[i] = chartColors.green
            } else if (dataset.data[i].cause == 'Undetermined') {
                dataset.backgroundColor[i] = chartColors.blue
            } else dataset.backgroundColor[i] = chartColors.gray
        }
        myChart.update();
    });
});