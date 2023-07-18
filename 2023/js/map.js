$(document).ready(function() {
    /* Adapted from http://bl.ocks.org/zross/47760925fcb1643b4225 */
    var mapTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    });

    var smallFireIcon = L.icon({
        iconUrl: './icons/small-fire.png',
        iconSize: [35, 35],
        iconAnchor: [17, 32],
        popupAnchor: [-2.5, -23]
    });
    var mediumFireIcon = L.icon({
        iconUrl: './icons/medium-fire.png',
        iconSize: [35, 35],
        iconAnchor: [17, 32],
        popupAnchor: [-2.5, -23]
    });
    var largeFireIcon = L.icon({
        iconUrl: './icons/large-fire.png',
        iconSize: [35, 35],
        iconAnchor: [17, 32],
        popupAnchor: [-2.5, -23]
    });
    // var containedSmallFireIcon = L.icon({
    //     iconUrl: '../icons/small-fire.png',
    //     iconSize: [25, 25],
    //     iconAnchor: [20, 30],
    //     popupAnchor: [-7.5, -22]
    // });
    // var containedMediumFireIcon = L.icon({
    //     iconUrl: '../icons/medium-fire.png',
    //     iconSize: [25, 25],
    //     iconAnchor: [20, 30],
    //     popupAnchor: [-7.5, -22]
    // });
    // var containedLargeFireIcon = L.icon({
    //     iconUrl: '../icons/large-fire.png',
    //     iconSize: [25, 25],
    //     iconAnchor: [20, 30],
    //     popupAnchor: [-7.5, -22]
    // });

    var map = L.map('map', {
        center: [37.0119, -105.4842],
        zoom: 6,
        minZoom: 3,
        //dragging: false,
        layers: [mapTiles],
        scrollWheelZoom: false,
        preferCanvas: true
    });

    //var promise = $.getJSON('https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Current_WildlandFire_Locations/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson');
    //var promise = $.getJSON('https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query?where=1%3D1&outFields=FireCause,FireDiscoveryDateTime,IncidentName,IncidentTypeCategory,PercentContained,POOCounty,POOLandownerCategory,POOState,TotalIncidentPersonnel,IncidentSize,ModifiedOnDateTime_dt,FireMgmtComplexity,POOCity&outSR=4326&f=geojson');
    var promise = $.getJSON('https://raw.githubusercontent.com/githamm/wildfire-data/main/map_data.json');
    promise.then(function(data) {
        var allWildfires = L.geoJson(data, {
            filter: function(feature, layer) {
                return feature.properties.PercentContained != 100 && feature.properties.IncidentSize > 1 && feature.properties.IncidentTypeCategory == 'WF' || feature.properties.IncidentTypeCategory == 'CX';
            },
            pointToLayer: function(feature, latlng) {
                var acres;
                if (feature.properties.IncidentSize != null) {
                    acres = feature.properties.IncidentSize.toLocaleString()
                } else feature.properties.IncidentSize = 'Unavailable';

                var squareMiles = Math.round((feature.properties.IncidentSize / 640) * 10) / 10;
                var percentContained;

                if (feature.properties.PercentContained != null) {
                    percentContained = feature.properties.PercentContained + '%'
                } else percentContained = 'Unavailable';

                var personnel;
                if (feature.properties.TotalIncidentPersonnel != null) {
                    personnel = feature.properties.TotalIncidentPersonnel
                } else personnel = 'Unavailable';

                var complexity;
                if (feature.properties.FireMgmtComplexity != null) {
                    complexity = feature.properties.FireMgmtComplexity
                } else complexity = 'Unavailable';

                var city;
                var landowner;

                if (feature.properties.POOCity != null) {
                    city = 'near ' + feature.properties.POOCity
                } else city = '';

                // This makes non-agency names lowercase
                String.prototype.lowercase = function() {
                    return this.charAt(0).toLowerCase() + this.slice(1);
                };

                if (feature.properties.POOLandownerCategory != null) {
                    if (feature.properties.POOLandownerCategory == 'Private' || feature.properties.POOLandownerCategory == 'County' || feature.properties.POOLandownerCategory == 'State' || feature.properties.POOLandownerCategory == 'Tribal') {
                        landowner = 'on ' + feature.properties.POOLandownerCategory.lowercase() + ' land '
                    } else landowner = 'on ' + feature.properties.POOLandownerCategory + ' land '
                } else landowner = '';

                var fireIcon;
                var discoveryDate = moment(feature.properties.FireDiscoveryDateTime).format('LL');
                var modifiedDate = moment(feature.properties.ModifiedOnDateTime_dt).format('LLL');
                var popupInfo = '<h3 class="fire-name">' + feature.properties.IncidentName + '<br><span class="update">Updated ' + modifiedDate + '</span></h3>Acres: <strong>' + acres + '</strong> (' + squareMiles + ' sq. miles)<br>Containment: <strong>' + percentContained + '</strong><br>Cause: <strong>' + feature.properties.FireCause + '</strong><br>Discovered: <strong>' + discoveryDate + '</strong><br>Personnel assigned: <strong>' + personnel + '</strong><br>Fire complexity: <strong>' + complexity + '</strong><br><span style="display:block;margin-top:10px;line-height1.3">The fire is burning ' + landowner + city + ' in ' + feature.properties.POOCounty + ' County.</span><br><span style="display:block;margin-top:-5px;line-height:1.3;text-align:right;font-style:italic"><a href="https://www.google.com/maps?q=loc:' + feature.geometry.coordinates[1] + ',+' + feature.geometry.coordinates[0] + '&t=h" target="blank">Open in Google maps</a></span>';

                if (feature.properties.IncidentSize < 1000) {
                    fireIcon = smallFireIcon
                } else if (feature.properties.IncidentSize < 10000) {
                    fireIcon = mediumFireIcon
                } else fireIcon = largeFireIcon;

                return L.marker(latlng, {
                    icon: fireIcon
                }).bindPopup(popupInfo).openPopup();
            }
        });
        var activeWildfires = L.geoJson(data, {
            filter: function(feature, layer) {
                return feature.properties.PercentContained != 100 && feature.properties.IncidentSize > 100 && feature.properties.IncidentTypeCategory == 'WF';
            },
            pointToLayer: function(feature, latlng) {
                var acres = feature.properties.IncidentSize.toLocaleString();
                var squareMiles = Math.round((feature.properties.IncidentSize / 640) * 10) / 10;
                var percentContained;

                if (feature.properties.PercentContained != null) {
                    percentContained = feature.properties.PercentContained + '%'
                } else percentContained = 'Unavailable';

                var personnel;
                if (feature.properties.TotalIncidentPersonnel != null) {
                    personnel = feature.properties.TotalIncidentPersonnel
                } else personnel = 'Unavailable';

                var complexity;
                if (feature.properties.FireMgmtComplexity != null) {
                    complexity = feature.properties.FireMgmtComplexity
                } else complexity = 'Unavailable';

                var city;
                var landowner;

                if (feature.properties.POOCity != null) {
                    city = 'near ' + feature.properties.POOCity
                } else city = '';

                // This makes non-agency names lowercase
                String.prototype.lowercase = function() {
                    return this.charAt(0).toLowerCase() + this.slice(1);
                };

                if (feature.properties.POOLandownerCategory != null) {
                    if (feature.properties.POOLandownerCategory == 'Private' || feature.properties.POOLandownerCategory == 'County' || feature.properties.POOLandownerCategory == 'State' || feature.properties.POOLandownerCategory == 'Tribal') {
                        landowner = 'on ' + feature.properties.POOLandownerCategory.lowercase() + ' land '
                    } else landowner = 'on ' + feature.properties.POOLandownerCategory + ' land '
                } else landowner = '';

                var fireIcon;
                var discoveryDate = moment(feature.properties.FireDiscoveryDateTime).format('LL');
                var modifiedDate = moment(feature.properties.ModifiedOnDateTime_dt).format('LLL');
                var popupInfo = '<h3 class="fire-name">' + feature.properties.IncidentName + '<br><span class="update">Updated ' + modifiedDate + '</span></h3>Acres: <strong>' + acres + '</strong> (' + squareMiles + ' sq. miles)<br>Containment: <strong>' + percentContained + '</strong><br>Cause: <strong>' + feature.properties.FireCause + '</strong><br>Discovered: <strong>' + discoveryDate + '</strong><br>Personnel assigned: <strong>' + personnel + '</strong><br>Fire complexity: <strong>' + complexity + '</strong><br><span style="display:block;margin-top:10px;line-height1.3">The fire is burning ' + landowner + city + ' in ' + feature.properties.POOCounty + ' County.</span><br><span style="display:block;margin-top:-5px;line-height:1.3;text-align:right;font-style:italic"><a href="https://www.google.com/maps?q=loc:' + feature.geometry.coordinates[1] + ',+' + feature.geometry.coordinates[0] + '&t=h" target="blank">Open in Google maps</a></span>';

                if (feature.properties.IncidentSize < 1000) {
                    fireIcon = smallFireIcon
                } else if (feature.properties.IncidentSize < 10000) {
                    fireIcon = mediumFireIcon
                } else fireIcon = largeFireIcon;

                return L.marker(latlng, {
                    icon: fireIcon
                }).bindPopup(popupInfo).openPopup();
            }
        });

        var incidentType1Wildfires = L.geoJson(data, {
            filter: function(feature, layer) {
                return feature.properties.FireMgmtComplexity == 'Type 1 Incident' || feature.properties.FireMgmtComplexity == 'Type 2 Incident';
            },
            pointToLayer: function(feature, latlng) {
                var acres = feature.properties.IncidentSize.toLocaleString();
                var squareMiles = Math.round((feature.properties.IncidentSize / 640) * 10) / 10;
                var percentContained;

                if (feature.properties.PercentContained != null) {
                    percentContained = feature.properties.PercentContained + '%'
                } else percentContained = 'Unavailable';

                var personnel;
                if (feature.properties.TotalIncidentPersonnel != null) {
                    personnel = feature.properties.TotalIncidentPersonnel
                } else personnel = 'Unavailable';

                var complexity;
                if (feature.properties.FireMgmtComplexity != null) {
                    complexity = feature.properties.FireMgmtComplexity
                } else complexity = 'Unavailable';

                var city;
                var landowner;

                if (feature.properties.POOCity != null) {
                    city = 'near ' + feature.properties.POOCity
                } else city = '';

                String.prototype.lowercase = function() {
                    return this.charAt(0).toLowerCase() + this.slice(1);
                };

                if (feature.properties.POOLandownerCategory != null) {
                    if (feature.properties.POOLandownerCategory == 'Private' || feature.properties.POOLandownerCategory == 'County' || feature.properties.POOLandownerCategory == 'State' || feature.properties.POOLandownerCategory == 'Tribal') {
                        landowner = 'on ' + feature.properties.POOLandownerCategory.lowercase() + ' land '
                    } else landowner = 'on ' + feature.properties.POOLandownerCategory + ' land '
                } else landowner = '';

                var fireIcon;
                var discoveryDate = moment(feature.properties.FireDiscoveryDateTime).format('LL');
                var modifiedDate = moment(feature.properties.ModifiedOnDateTime_dt).format('LLL');
                var popupInfo = '<h3 class="fire-name">' + feature.properties.IncidentName + '<br><span class="update">Updated ' + modifiedDate + '</span></h3>Acres: <strong>' + acres + '</strong> (' + squareMiles + ' sq. miles)<br>Containment: <strong>' + percentContained + '</strong><br>Cause: <strong>' + feature.properties.FireCause + '</strong><br>Discovered: <strong>' + discoveryDate + '</strong><br>Personnel assigned: <strong>' + personnel + '</strong><br>Fire complexity: <strong>' + complexity + '</strong><br><span style="display:block;margin-top:10px;line-height1.3">The fire is burning ' + landowner + city + ' in ' + feature.properties.POOCounty + ' County.</span><br><span style="display:block;margin-top:-5px;line-height:1.3;text-align:right;font-style:italic"><a href="https://www.google.com/maps?q=loc:' + feature.geometry.coordinates[1] + ',+' + feature.geometry.coordinates[0] + '&t=h" target="blank">Open in Google maps</a></span>';

                if (feature.properties.IncidentSize < 1000) {
                    fireIcon = smallFireIcon
                } else if (feature.properties.IncidentSize < 10000) {
                    fireIcon = mediumFireIcon
                } else fireIcon = largeFireIcon;


                // if (feature.properties.PercentContained == 100) {
                //     if (feature.properties.IncidentSize < 1000) {
                //         fireIcon = containedSmallFireIcon
                //     } else if (feature.properties.IncidentSize < 10000) {
                //         fireIcon = containedMediumFireIcon
                //     } else fireIcon = containedLargeFireIcon
                // };

                return L.marker(latlng, {
                    icon: fireIcon
                }).bindPopup(popupInfo).openPopup();
            }
        });

        var circleWildfires = L.geoJson(data, {
            filter: function(feature, layer) {
                return feature.properties.PercentContained != 100 && feature.properties.IncidentSize > 1 && feature.properties.IncidentTypeCategory == 'WF';
            },
            pointToLayer: function(feature, latlng) {
                var acres = feature.properties.IncidentSize;
                var squareMiles = Math.round((feature.properties.IncidentSize / 640) * 10) / 10;
                var circleRadius;
                var circleSize = Math.sqrt(acres) * .15;
                var activeCircle = {
                    radius: circleSize,
                    fillColor: "brown",
                    color: "#aaa",
                    weight: 0,
                    opacity: 0,
                    fillOpacity: .5
                };
                var percentContained;

                if (feature.properties.PercentContained != null) {
                    percentContained = feature.properties.PercentContained + '%'
                } else percentContained = 'Unavailable';

                var personnel;
                if (feature.properties.TotalIncidentPersonnel != null) {
                    personnel = feature.properties.TotalIncidentPersonnel
                } else personnel = 'Unavailable';

                var complexity;
                if (feature.properties.FireMgmtComplexity != null) {
                    complexity = feature.properties.FireMgmtComplexity
                } else complexity = 'Unavailable';

                var city;
                var landowner;

                if (feature.properties.POOCity != null) {
                    city = 'near ' + feature.properties.POOCity
                } else city = '';

                String.prototype.lowercase = function() {
                    return this.charAt(0).toLowerCase() + this.slice(1);
                };

                if (feature.properties.POOLandownerCategory != null) {
                    if (feature.properties.POOLandownerCategory == 'Private' || feature.properties.POOLandownerCategory == 'County' || feature.properties.POOLandownerCategory == 'State' || feature.properties.POOLandownerCategory == 'Tribal') {
                        landowner = 'on ' + feature.properties.POOLandownerCategory.lowercase() + ' land '
                    } else landowner = 'on ' + feature.properties.POOLandownerCategory + ' land '
                } else landowner = '';

                var fireIcon;
                var discoveryDate = moment(feature.properties.FireDiscoveryDateTime).format('LL');
                var modifiedDate = moment(feature.properties.ModifiedOnDateTime_dt).format('LLL');
                var popupInfo = '<h3 class="fire-name">' + feature.properties.IncidentName + '<br><span class="update">Updated ' + modifiedDate + '</span></h3>Acres: <strong>' + acres.toLocaleString() + '</strong> (' + squareMiles + ' sq. miles)<br>Containment: <strong>' + percentContained + '</strong><br>Cause: <strong>' + feature.properties.FireCause + '</strong><br>Discovered: <strong>' + discoveryDate + '</strong><br>Personnel assigned: <strong>' + personnel + '</strong><br>Fire complexity: <strong>' + complexity + '</strong><br><span style="display:block;margin-top:10px;line-height1.3">The fire is burning ' + landowner + city + ' in ' + feature.properties.POOCounty + ' County.</span><br><span style="display:block;margin-top:-5px;line-height:1.3;text-align:right;font-style:italic"><a href="https://www.google.com/maps?q=loc:' + feature.geometry.coordinates[1] + ',+' + feature.geometry.coordinates[0] + '&t=h" target="blank">Open in Google maps</a></span>';

                if (feature.properties.IncidentSize < 1000) {
                    fireIcon = smallFireIcon
                } else if (feature.properties.IncidentSize < 10000) {
                    fireIcon = mediumFireIcon
                } else fireIcon = largeFireIcon;

                return L.circleMarker(latlng, activeCircle).bindPopup(popupInfo).openPopup();
            }
        });
        // map.fitBounds(allWildfires.getBounds(), {
        //     padding: [50, 50]
        // });

        allWildfires.addTo(map)

        $("#activeWildfires").click(function() {
            map.addLayer(activeWildfires)
            map.removeLayer(incidentType1Wildfires)
            //map.removeLayer(smallWildfires)
            map.removeLayer(circleWildfires)
            map.removeLayer(allWildfires)
        });

        $("#incidentType1Wildfires").click(function() {
            map.addLayer(incidentType1Wildfires)
            map.removeLayer(activeWildfires)
            //map.removeLayer(smallWildfires)
            map.removeLayer(circleWildfires)
            map.removeLayer(allWildfires)
        });

        $("#allWildfires").click(function() {
            map.addLayer(allWildfires)
            map.removeLayer(activeWildfires)
            map.removeLayer(incidentType1Wildfires)
            //map.removeLayer(smallWildfires)
            map.removeLayer(circleWildfires)
        });

        $("#circleWildfires").click(function() {
            map.addLayer(circleWildfires)
            map.removeLayer(activeWildfires)
            map.removeLayer(incidentType1Wildfires)
            //map.removeLayer(smallWildfires)
            map.removeLayer(allWildfires)
        });
    })
})