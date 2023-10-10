let mapObj;
let SelectedSegment;
let esriLayer;
const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0)); // TODO must be 4 0s?
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);
let mapMarker = null;
let plotData = {
    "forecast": null,
    "historical": null,
    "flow-duration": null
};


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

    mapObj.timeDimension.on('timeload', refreshMapLayer);
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

    $('.timecontrol-play').on('click', refreshMapLayer);

    initializeSelects();
    $(".plot-card").each(function(index, card) {
        let plotSelect = $(card).find(".plot-select");
        let plotContainer = $(card).find(".plot-container");
        plotSelect.on("change", function() {
            let value = $(this).val();
            plotContainer.html(plotData[value]);
            $(".plot-select").not(this).find('option').prop('disabled', false);
            $(".plot-select").not(this).find('option[value="' + value + '"]').prop('disabled', true);
        })        
    })

    mapObj.on('click', function(event) {
        if (mapMarker) {
            mapObj.removeLayer(mapMarker);
        }
        mapMarker = L.marker(event.latlng).addTo(mapObj);
        mapObj.flyTo(event.latlng, 10);
        showPlots(false);
        findReachIDByLatLon(event)
            .then(function(reachID) {
                $('#reach-id-input').val(reachID);
                return setupDatePicker(reachID);
            })
            .then(function(data) {
                return Promise.all([getForecastData(data), getHistoricalData(data)])
            })
            .then(function() {
                showPlots(true);
                clearPlots();
                drawPlots();
            })
            .catch(error => {
                alert(error);
                showStreamSelectionMessage();
            })
    })
};

function initializeSelects() {
    $(".plot-select").each(function() {
        let value = $(this).val();
        $(".plot-select").not(this).find('option[value="' + value + '"]').prop('disabled', true);
    })
}


let refreshMapLayer = function() {
    let sliderTime = new Date(mapObj.timeDimension.getCurrentTime());
    esriLayer.setTimeRange(sliderTime, endDateTime);
}


function findReachIDByID() {
    return new Promise(function (resolve, reject) {
        console.log("Searching ...");
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
                resolve($('#reach-id-input').val())
            },
            error: function() {
                alert("Unable to find the reach_id specified")
                reject("Unable to find the reach_id specified")
            }
        })
    })
}


$('#search-addon').click(findReachIDByID);
$('#reach-id-input').keydown(event => {
    if (event.keyCode === 13) {
        findReachIDByID()
        .then(function(reachID) {
            showPlots(false);
            return setupDatePicker(reachID);
        })
        .then(function(data) {
            return Promise.all([getForecastData(data), getHistoricalData(data)])
        })
        .then(function() {
            showPlots(true);
            clearPlots();
            drawPlots();
        })
        .catch(error => {
            alert(error);
            showStreamSelectionMessage();
        })
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
            if (error || featureCollection.features.length == 0) {
                reject(new Error("Fail to find the reach_id"));
            } else {
                // draw the stream on the map
                SelectedSegment.clearLayers();
                SelectedSegment.addData(featureCollection.features[0].geometry);
                let reachID = featureCollection.features[0].properties["COMID (Stream Identifier)"];
                resolve(reachID);
            }
        })
    })
}


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
    return new Promise(function(resolve, reject) {
        let reachID = data.reachID, selectedDate = data.selectedDate;
        let startDate = new Date();
        let dateOffset = 24 * 60 * 60 * 1000 * 7;
        startDate.setTime(selectedDate.getTime() - dateOffset);
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
                plotData["forecast"] = response["plot"];
                resolve("success in getting forecast data!")
            },
            error: function() {
                console.error("fail to get forecast data");
                reject("fail to get forecast data");
            }
        })
    })
}


function getHistoricalData(data) {
    return new Promise(function (resolve, reject) {
        let reachID = data.reachID;
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getHistoricalData + L.Util.getParamString({
                reach_id: reachID
            }),
            success: function(response) {
                plotData["historical"] = response["plot"];
                plotData["flow-duration"] = response["fdp"];
                console.log("success in getting historical and flow duration data!");
                resolve("success in getting historical and flow duration data!");
            },
            error: function() {
                console.error("fail to get historical and flow duration data");
                reject("fail to get historical and flow duration data")
            }
        })
    })
}

function clearPlots() {
    $(".plot-container").empty();
}

function drawPlots() {
    $(".plot-card").each(function(index, card) {
        let plotSelect = $(card).find(".plot-select");
        let plotContainer = $(card).find(".plot-container");
        let plotContent = plotData[plotSelect.val()]; // Assuming plotData is an object with values based on select options
        plotContainer.html(plotContent);
    });
}


function showPlots(show) {
    if (show) {
        $(".plot-container").css("display", "flex");
    } else {
        $(".plot-container").css("display", "none");
    }
    showSpinners(!show);
}


function showSpinners(show) {
    if (show) {
        $(".spinner").css("display", "flex");
    } else {
        $(".spinner").css("display", "none");
    }
}


function showStreamSelectionMessage() {
    $(".plot-card").each(function(index, card) {
        $(card).find(".plot-container").html("Please select a stream");
    })
    showPlots(true);
}