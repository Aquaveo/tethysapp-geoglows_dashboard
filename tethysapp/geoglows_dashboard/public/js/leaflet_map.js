const isTest = true;
let isDrawing = false;

let mapObj;
let mapMarker, selectedStream, selectedCountry;
let esriLayer;

let countries = {};

const currentYear = new Date().getFullYear();
let selectedYear;

const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0)); // TODO must be 4 0s?
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);

let plotData = {
    "forecast": null,
    "historical": null,
    "flow-duration": null,
    "flow-regime": null
};

let drawnFeatures;

$(function() {
    loadCountries();
    initMap();
    initDrawControl();
})

let initMap = function() {
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
    selectedStream = L.geoJSON(false, {weight: 5, color: '#00008b'}).addTo(mapObj);
    selectedCountry = L.geoJSON().addTo(mapObj);

    $("#country-selector").on("change", function() {
        selectedCountry.clearLayers();
        selectedCountry.addData(countries[$(this).val()].geometry);
        mapObj.fitBounds(selectedCountry.getBounds());
    })

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

    $('#yearpicker').datepicker({
        minViewMode: 2,
        format: 'yyyy',
        endDate: currentYear.toString()
    });
    $('#yearpicker').on('changeDate', function(e) {
        selectedYear = e.date.getFullYear();
        if (plotData["flow-regime"] != null) {
            updateFlowRegime(selectedYear)
        }
        $('#yearpicker').datepicker('hide');
    });

    mapObj.on('click', function(event) {
        if (!isDrawing && !isYearPickerEmpty()) {
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
                    drawPlots();
                })
                .catch(error => {
                    alert(error);
                    showStreamSelectionMessage();
                })
        }        
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
        console.log("Searching stream id...");
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
        if (!isYearPickerEmpty()) {
            findReachIDByID()
            .then(function(reachID) {
                showPlots(false);
                return setupDatePicker(reachID);
            })
            .then(function(data) {
                return Promise.all([getForecastData(data), getHistoricalData(data)])
            })
            .then(function() {
                drawPlots();
            })
            .catch(error => {
                alert(error);
                showStreamSelectionMessage();
            })
        }
    }
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
                selectedStream.clearLayers();
                selectedStream.addData(featureCollection.features[0].geometry);
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
                reach_id: reachID,
                is_test: isTest.toString()
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
                start_date: getFormattedDate(startDate),
                is_test: isTest.toString()
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
                reach_id: reachID,
                selected_year: selectedYear,
                is_test: isTest.toString()
            }),
            success: function(response) {
                historicalData = response["hist"]
                plotData["historical"] = response["plot"];
                plotData["flow-duration"] = response["fdp"];
                plotData["flow-regime"] = response["flow_regime"];
                console.log("success in getting historical data!");
                resolve("success in getting historical data!");
            },
            error: function() {
                console.error("fail to get historical data");
                reject("fail to get historical data")
            }
        })
    })
}


function updateFlowRegime(year) {
    $.ajax({
        type: "GET",
        async: false,
        url: URL_updateFlowRegime + L.Util.getParamString({
            selected_year: year
        }),
        success: function(response) {
            plotData["flow-regime"] = response["flow_regime"];
            drawPlots();
            console.log("success in drawing new flow regime plot");
        },
        error: function() {
            console.error("fail to draw new flow regime plot");
        }
    })
}


function clearPlots() {
    $(".plot-container").empty();
}

function drawPlots() {
    showPlots(true);
    clearPlots();
    $(".plot-card").each(function(index, card) {
        let plotSelect = $(card).find(".plot-select");
        let plotContainer = $(card).find(".plot-container");
        let plotContent = plotData[plotSelect.val()]; // Assuming plotData is an object with values based on select options
        plotContainer.html(plotContent);
    });
}


function showPlots(show) {
    $(".plot-container").css("display", show ? "flex" : "none");
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


function isYearPickerEmpty() {
    let isEmpty = $("#yearpicker").val() == "";
    if (isEmpty) {
        alert("Please pick a year!");
    }
    return isEmpty;
}


function loadCountries() {
    fetch("/static/geoglows_dashboard/data/geojson/countries.geojson")
        .then((response) => {
            if (!response.ok) {
                throw new Error("countries.geojson was not ok");
            }
            return response.json();
        })
        .then((data) => {
            data = JSON.parse(JSON.stringify(data));
            console.log(data);
            for (let country of data.features) {
                let name = country.properties.ADMIN;
                let geometry = country.geometry;
                countries[name] = {"name": name, "geometry": geometry};
                $("#country-selector").append($("<option>", {
                    value: name,
                    text: name
                }))
            }
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}


// Plot Methods
function initDrawControl() {
    // Initialize layer for drawn features
    drawnFeatures = new L.FeatureGroup();
    mapObj.addLayer(drawnFeatures);

    // Initialize draw controls
    let drawControl = new L.Control.Draw({
        draw: {
            // polyline: false,
            // polygon: false,
            // circle: false,
            // rectangle: false,
        }
    });

    mapObj.addControl(drawControl);

    mapObj.on("draw:drawstart", function(e) {
        isDrawing = true;
    })

    // Bind to draw event
    mapObj.on("draw:created", function(e) {
        drawnFeatures.clearLayers();
        drawnFeatures.addLayer(e.layer);
        isDrawing = false;
    });
};