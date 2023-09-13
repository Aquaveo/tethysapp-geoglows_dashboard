let mapObj;
let startDateTime = new Date(new Date().setHours(0, 0, 0));
let endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);
let mapMarker = null;


let init_map = function() {
    mapObj = L.map('leaflet-map', {
        zoom: 3,
        center: [0, 0],
        fullscreenControl: true,
        // Time Dimension
        timeDimension: true,
        timeDimensionOptions: {
            timeInterval: startDateTime.toString() + "/" + endDateTime.toString(),
            period: "PT3H",
            currentTime: new Date().getTime()
        },
        timeDimensionControl: true,
        timeDimensionControlOptions: {
            autoPlay: false,
            loopButton: true,
            timeSteps: 1,
            playReverseButton: true,
            limitSliders: true,
            playerOptions: {
                buffer: 0,
                transitionTime: 250,
                loop: true,
            }
        },
    });

    // Add Basemap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapObj);


    L.esri.dynamicMapLayer({
        url: "https://livefeeds2.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer",
        layers: [0],
        // from: startDateTime,
        // to: endDateTime,
        opacity: 0.7
    })
    .addTo(mapObj);
};


function findReachID() {
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
