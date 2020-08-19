///// MAPS /////

/*** Function to add comma to string numbers ***/
String.prototype.commafy = function() {
    return this.replace(/(^|[^\w.])(\d{4,})/g, function($0, $1, $2) {
        return $1 + $2.replace(/\d(?=(?:\d\d\d)+(?!\d))/g, "$&,");
    });
};

var mapSpreadsheetID = '14u9c1dlrpjlAuMN1A7oV8qTpGY7Z5zhC1M3176L0F14/1'
var mapUrl = 'https://spreadsheets.google.com/feeds/list/' + mapSpreadsheetID + '/public/full?alt=json';

$.getJSON(mapUrl, function(data) {
    var output = data.feed.entry;
    // var countyCoordinates = {
    //     'type': 'FeatureCollection',
    //     'features': []
    // };

    // for (i = 0; i < output.length; i++) {
    //     var longitude = (output[i].gsx$longitude.$t);
    //     var latitude = (output[i].gsx$latitude.$t);
    //     var coordinates = JSON.parse('[' + longitude + ', ' + latitude + ']');

    //     countyCoordinates.features.push({
    //         'type': 'Feature',
    //         'geometry': {
    //             'type': 'Point',
    //             'coordinates': coordinates
    //         },
    //         'properties': {
    //             'name': output[i].gsx$county.$t,
    //             'number_of_cases': output[i].gsx$numberofcases.$t,
    //             'number_of_deaths': output[i].gsx$numberofdeaths.$t,
    //         }
    //     });
    // }

    // var map = L.map('map', {
    //     center: [39.001, -105.7821],
    //     zoom: 7,
    //     minZoom: 5,
    //     maxZoom: 10,
    //     scrollWheelZoom: false,
    //     preferCanvas: true
    // });

    // var basemap = L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
    //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://cartodb.com/attributions">CartoDB</a>',
    //     subdomains: "abcd",
    //     maxZoom: 19
    // });
    // basemap.addTo(map);

    // /// COUNTY LAYER
    // var countyStyle = {
    //     "color": "#ccc",
    //     "weight": .5,
    //     "fillOpacity": 0
    // };

    // var countyJsonLayer = new L.GeoJSON.AJAX('./scripts/colorado_county_boundaries.json', { style: countyStyle }).addTo(map);

    // /// CIRCLE LAYERS
    // var casesLayer = L.geoJSON(countyCoordinates, {
    //     pointToLayer: function(feature, latlng) {
    //         var circleRadius;
    //         var circleBorder;

    //         if (feature.properties.number_of_cases > 0) {
    //             casesCircleRadius = (Math.sqrt(feature.properties.number_of_cases) * .6)
    //         } else {
    //             casesCircleRadius = 0
    //         };

    //         var casesCircle = {
    //             radius: casesCircleRadius,
    //             fillColor: "blue",
    //             color: "#000",
    //             weight: 0,
    //             opacity: .75,
    //             fillOpacity: .35
    //         };

    //         // var popupText = '<h3 class="popup-header">' + feature.properties.name + ' County</h3><hr><div class="popup-container">Confirmed cases: <strong>' + feature.properties.number_of_cases + '</strong><br>Deaths: <strong>' + feature.properties.number_of_deaths + '</strong><br>Last reported case: <strong>' + feature.properties.last_reported_case + '</strong><br><br>Related story: <a href="' + feature.properties.story_link + '" target="_blank">' + feature.properties.latest_headline + '</a></div>';

    //         var popupText = '<h3 class="popup-header">' + feature.properties.name + ' County</h3><hr><div class="popup-container">Confirmed cases: <strong>' + (feature.properties.number_of_cases).commafy() + '</strong><br>Deaths: <strong>' + feature.properties.number_of_deaths + '</strong><br><br><a href="https://www.denverpost.com/tag/coronavirus-colorado/" target="_blank"><em>Read the latest coronavirus stories</em></a></div>';

    //         if (feature.properties.number_of_cases != '') {
    //             return L.circleMarker(latlng, casesCircle).bindPopup(popupText)
    //         }
    //     }
    // }).addTo(map);

    // var deathsLayer = L.geoJSON(countyCoordinates, {
    //     pointToLayer: function(feature, latlng) {
    //         var circleRadius;
    //         var circleBorder;

    //         if (feature.properties.number_of_deaths > 0) {
    //             deathsCircleRadius = (Math.sqrt(feature.properties.number_of_deaths) * .6)
    //         } else {
    //             deathsCircleRadius = 0
    //         };

    //         var deathsCircle = {
    //             radius: deathsCircleRadius,
    //             fillColor: "red",
    //             color: "#000",
    //             weight: 0,
    //             opacity: 0,
    //             fillOpacity: .75
    //         };

    //         // var popupText = '<h3 class="popup-header">' + feature.properties.name + ' County</h3><hr><div class="popup-container">Confirmed cases: <strong>' + feature.properties.number_of_cases + '</strong><br>Deaths: <strong>' + feature.properties.number_of_deaths + '</strong><br>Last reported case: <strong>' + feature.properties.last_reported_case + '</strong><br><br>Related story: <a href="' + feature.properties.story_link + '" target="_blank">' + feature.properties.latest_headline + '</a></div>';

    //         var popupText = '<h3 class="popup-header">' + feature.properties.name + ' County</h3><hr><div class="popup-container">Confirmed cases: <strong>' + feature.properties.number_of_cases + '</strong><br>Deaths: <strong>' + feature.properties.number_of_deaths + '</strong><br><br><a href="https://www.denverpost.com/tag/coronavirus-colorado/" target="_blank"><em>Read the latest coronavirus stories</em></a></div>';

    //         if (feature.properties.number_of_deaths != 0) {
    //             return L.circleMarker(latlng, deathsCircle).bindPopup(popupText)
    //         }
    //     }
    // }).addTo(map);

    /// CHOROPLETH RATE MAP
    var geojsonCounties = {
        'type': 'FeatureCollection',
        'features': []
    };

    for (i = 0; i < output.length; i++) {
        var coords = JSON.parse(output[i].gsx$geometry.$t);

        geojsonCounties.features.push({
            'type': 'Feature',
            'geometry': {
                'type': 'MultiPolygon',
                'coordinates': coords
            },
            'properties': {
                'name': output[i].gsx$firename.$t,
                'status': output[i].gsx$status.$t,
                'acres': output[i].gsx$acres.$t,
                'containment': output[i].gsx$containment.$t,
                'updated': output[i].gsx$updated.$t,
                'cause': output[i].gsx$cause.$t,
                'discovered': output[i].gsx$discovered.$t
            }
        });
    }

    var map = L.map('map', {
        center: [39.498440, -104.987003],
        zoom: 12,
        minZoom: 8,
        maxZoom: 20,
        scrollWheelZoom: false,
        preferCanvas: true
    });

    var basemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    });
    basemap.addTo(map);
    L.geoJSON(geojsonCounties, {
        style: function(feature) {
            var status = feature.properties.status;
            var fillColor;
            var borderColor;
            // Blue color ramp (light to dark): ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#08519c','#08306b']
            if (status == 'Active') {
                fillColor = 'red';
            } else fillColor = '#ccc';
            return {
                color: 'red',
                opacity: 1,
                weight: 2,
                fillColor: fillColor,
                fillOpacity: .33
            }
        },

        onEachFeature: function(feature, layer) {
            // var cases = feature.properties.number_of_cases;
            // var population = feature.properties.population;
            // var rate = ((cases / population) * 100000).toFixed(1);
            // var rateText;

            // if (cases <= 5) {
            //     rateText = '*'
            // } else rateText = rate.commafy();

            // var popupText;
            // if (cases == '') {
            //     popupText = '<h3 class="popup-header">' + feature.properties.name + ' County</h3><hr><div class="popup-container"><em>No cases reported</em></div>';
            // } else popupText = '<h3 class="popup-header">' + feature.properties.name + ' County</h3><hr><div class="popup-container">Confirmed cases: <strong>' + cases.commafy() + '</strong><br>Case rate: <strong>' + rateText + '</strong><br>Deaths: <strong>' + feature.properties.number_of_deaths + '</strong><br><br><a href="https://www.denverpost.com/tag/coronavirus-colorado/" target="_blank"><em>Read the latest coronavirus stories</em></a></div>';
            // layer.bindPopup(
            //     popupText
            // )
            popupText = '<h3 class="fire-name">' + feature.properties.name + '<br><span class="update">Updated ' + feature.properties.updated + '</span></h3>Acres: <strong>' + feature.properties.acres + '</strong><br>Containment: <strong>' + feature.properties.containment + '%</strong><br>Cause: <strong>' + feature.properties.cause + '</strong><br>Discovered: <strong>' + feature.properties.discovered + '</strong>';
            layer.bindPopup(
                popupText)
        }
    }).addTo(map)
});