$(document).ready(function() {
    //$.getJSON("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/CY_WildlandFire_Locations_ToDate/FeatureServer/0/query?where=IncidentTypeCategory%20%3D%20'WF'%20AND%20POOState%20%3D%20'US-CO'&outFields=FireCause,FireDiscoveryDateTime,IncidentName,IncidentTypeCategory,PercentContained,POOCounty,DailyAcres,&outSR=4326&f=json", function(result) {
    $.getJSON('https://raw.githubusercontent.com/githamm/wildfire-data/main/table_data.json', function(result) {
        var apiData = result.features;
        var bigFires = [];
        for (let i = 0; i < apiData.length; i++) {
            if (apiData[i].attributes.DailyAcres >= 10) {
                bigFires.push({
                    fire_discovery_date_time: apiData[i].attributes.FireDiscoveryDateTime,
                    fire_name: apiData[i].attributes.IncidentName,
                    acres_burned: apiData[i].attributes.DailyAcres,
                    percent_contained: apiData[i].attributes.PercentContained,
                    fire_cause: apiData[i].attributes.FireCause,
                    county: apiData[i].attributes.POOCounty
                })
            }
        };
        var dateNow = Date.now();
        var threeDays = (3 * (1000 * 60 * 60 * 24));

        // TABLE
        var table = $('#wildfire-table').DataTable({
            data: bigFires,
            scrollY: '500px',
            scrollCollapse: true,
            paging: false,
            scrollX: true,
            fixedHeader: true,
            dom: '<<ift>>',
            order: [1, 'desc'],
            columns: [
                { data: 'fire_name' },
                {
                    data: 'fire_discovery_date_time',
                    render: function(data) {
                        return moment(data).format("MM/DD/YYYY")
                    }
                },
                { data: 'acres_burned', render: $.fn.dataTable.render.number(',', '.', 0, '') },
                { data: 'percent_contained', render: $.fn.dataTable.render.number(',', '.', 0, '', '%') },
                { data: 'fire_cause' },
                { data: 'county' }
            ],
            createdRow: function(row, data, index) {
                if (data.percent_contained != null && data.percent_contained != 100) {
                    $(row).addClass('active-fire');
                } else if (data.fire_discovery_date_time > (dateNow - threeDays) && data.percent_contained != 100) {
                    $(row).addClass('active-fire');
                }
            }
        })

        $('#filter-button').click(function() {
            $.fn.dataTableExt.afnFiltering.push(function(settings, data, dataIndex) {
                var fireDiscoveryUnixDate = (new Date(data[1]).getTime());
                if (data[3] != '' && data[3] != 100 || fireDiscoveryUnixDate > (dateNow - threeDays)) {
                    return true;
                }
                return false;
            })
            table.draw();
        })
        $('#reset-button').on('click', function(e) {
            // e.preventDefault();
            $.fn.dataTableExt.afnFiltering.length = 0;
            table.draw();
        });
    })
})