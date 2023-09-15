let mapObj;
let SelectedSegment;
let esriLayer;
const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0)); // TODO must be 4 0s?
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);
let mapMarker = null;
let reachID;


let init_map = function() {
    mapObj = L.map('leaflet-map', {
        zoom: 3,
        center: [0, 0],
        fullscreenControl: true,
       // Add Time Dimension
        timeDimension: true,
        timeDimensionOptions: {
            timeInterval: startDateTime.toString() + "/" + endDateTime.toString(),
            period: "PT3H",
            currentTime: startDateTime
        },
        timeDimensionControl: true,
        timeDimensionControlOptions: {
            autoPlay: false,
            loopButton: true,
            timeSteps: 1,
            limitSliders: true,
            playerOptions: {
                buffer: 0,
                transitionTime: 500,
            }
        },
    });

    mapObj.timeDimension.on('timeload', refreshLayer);
    SelectedSegment = L.geoJSON(false, {weight: 5, color: '#00008b'}).addTo(mapObj);

    const basemaps = {
        "Open Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapObj),    
        "ESRI Topographic": L.esri.basemapLayer('Topographic'),
        "ESRI Terrain": L.layerGroup(
            [L.esri.basemapLayer('Terrain'), 
            L.esri.basemapLayer('TerrainLabels')]
        ),
        "ESRI Grey": L.esri.basemapLayer('Gray'),
    }

    L.control.layers(basemaps, null, {
        collapsed: false
    }).addTo(mapObj);

    // Add Esri layer
    esriLayer = L.esri.dynamicMapLayer({
        url: "https://livefeeds2.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer",
        layers: [0],
        from: startDateTime,
        to: endDateTime,
        opacity: 0.7
    })
    .addTo(mapObj);

    $('.timecontrol-play').on('click', refreshLayer);

    mapObj.on('click', function(event) {
        if (mapMarker) {
            mapObj.removeLayer(mapMarker);
        }
        mapMarker = L.marker(event.latlng).addTo(mapObj);
        mapObj.flyTo(event.latlng, 10);
        findReachIDByLatLon(event);
    })
};

let findReachIDByLatLon = function(event) {
    console.log("finding reach id ...");
    L.esri.identifyFeatures({
        url: 'https://livefeeds2.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
    })
    .on(mapObj)
    // querying point with tolerance
    .at([event.latlng['lat'], event.latlng['lng']])
    .tolerance(10)  // map pixels to buffer search point
    .precision(3)  // decimals in the returned coordinate pairs
    .run(function (error, featureCollection) {
        console.log(error);
        console.log(featureCollection);
        if (error) {
            alert('Error finding the reach_id');
            return
        }
        SelectedSegment.clearLayers();
        SelectedSegment.addData(featureCollection.features[0].geometry);
        reachID = featureCollection.features[0].properties["COMID (Stream Identifier)"];
        console.log(reachID);

        // $.ajax({
        //     type: 'GET',
        //     url: URL_findUpstreamBoundaries,
        //     data: {reachid: REACHID, project: project},
        //     dataType: 'json',
        //     success: function (response) {

        //     },
        //     error: function (response) {

        //     },
        // })
    })
}


let refreshLayer = function() {
    let sliderTime = new Date(mapObj.timeDimension.getCurrentTime());
    esriLayer.setTimeRange(sliderTime, endDateTime);
}


let findReachIDByID = function() {
    $.ajax({
        type: "GET",
        async: true,
        url:
            URL_find_reach_id + 
            L.Util.getParamString({
                reach_id: $('#reach-id-input').val()
            }),
        success: function(response) {
            if (mapMarker) {
                mapObj.removeLayer(mapMarker)
            }
            mapMarker = L.marker(L.latLng(response["lat"], response["lon"])).addTo(mapObj)
            mapObj.flyTo(L.latLng(response["lat"], response["lon"]), 9)
        },
        error: function() {
            alert("Unable to find the reach_id specified")
        }
    })
}


$('#search-addon').click(findReachID);
$('#reach-id-input').keydown(event => {
    if (event.keyCode === 13) {
        findReachID();
    }
})


$(function() {
    init_map();
})
