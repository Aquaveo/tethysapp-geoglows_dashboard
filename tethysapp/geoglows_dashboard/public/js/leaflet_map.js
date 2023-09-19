let mapObj;
let SelectedSegment;
let esriLayer;
const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0)); // TODO must be 4 0s?
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);
let mapMarker = null;


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
        findReachIDByLatLon(event)
            .then(function(reachID) {
                return setupDatePicker(reachID);
            })
            .then(function(data) {
                getForecastData(data);
                getHistoricalData(data);
            })
            .catch(error => {
                console.error("Error: ", error);
            })
    })
};


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


$('#search-addon').click(findReachIDByID);
$('#reach-id-input').keydown(event => {
    if (event.keyCode === 13) {
        findReachIDByID();
    }
})


$(function() {
    init_map();
})


let findReachIDByLatLon = function(event) {
    return new Promise(function(resolve, reject) {
        L.esri.identifyFeatures({
            url: 'https://livefeeds2.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
        })
        .on(mapObj)
        // querying point with tolerance
        .at([event.latlng['lat'], event.latlng['lng']])
        .tolerance(10)  // map pixels to buffer search point
        .precision(3)  // decimals in the returned coordinate pairs
        .run(function (error, featureCollection) {
            if (error) {
                reject('Error finding the reach_id');
            } else {
                // draw the stream on the map
                SelectedSegment.clearLayers();
                SelectedSegment.addData(featureCollection.features[0].geometry);
                let reachID = featureCollection.features[0].properties["COMID (Stream Identifier)"];
                console.log("reach_id: " + reachID);
                resolve(reachID);
            }
        })
    })
}

////////////////////////////

function setupDatePicker(reachID) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getAvailableDates + L.Util.getParamString({
                reach_id: reachID
            }),
            success: function(response) {
                let dates = response["dates"]
                let latestAvailableDate = dates.sort(
                    (a, b) => parseFloat(b) - parseFloat(a)
                )[0]
                let selectedDate = new Date(
                    latestAvailableDate.slice(0, 4),
                    parseInt(latestAvailableDate.slice(4, 6)) - 1,
                    latestAvailableDate.slice(6, 8)
                )
                console.log(selectedDate);
                // TODO add feature: the user can change the forecast_date
                resolve({'reachID': reachID, 'selectedDate': selectedDate});
            },
            error: function() {
                console.log("fail to get available dates");
                reject("fail to get available dates");
            }
        })
    })
}

function getFormattedDate(date) {
    return `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${(
        "0" + date.getDate()
    ).slice(-2)}.00`
}


function getForecastData(data) {
    let reachID = data.reachID, selectedDate = data.selectedDate;
    let startDate = new Date();
    let dateOffset = 24 * 60 * 60 * 1000 * 7;
    startDate.setTime(selectedDate.getTime() - dateOffset);
    console.log(reachID, selectedDate, startDate);
    $.ajax({
        type: "GET",
        async: true,
        url: URL_getForecastData + L.Util.getParamString({
            reach_id: reachID,
            end_date: getFormattedDate(selectedDate),
            start_date: getFormattedDate(startDate)
        }),
        success: function(response) {
            console.log("success in getting forecast data!");
            $("#plot1").html(response["plot"]);
        },
        error: function() {
            console.error("fail to get forecast data");
        }
    })
}


function getHistoricalData(data) {
    let reachID = data.reachID;
    $.ajax({
        type: "GET",
        async: true,
        url: URL_getHistoricalData + L.Util.getParamString({
            reach_id: reachID
        }),
        success: function(response) {
            $("#plot2").html(response["plot"]);
        },
        error: function() {
            console.error("fail to get historical data");
        }
    })
}