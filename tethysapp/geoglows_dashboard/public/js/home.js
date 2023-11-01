const isTest = false;
let isDrawing = false;

let mapObj;
let mapMarker, selectedStream, selectedCountry;
let esriLayer;

let countries = {};

const currentYear = new Date().getFullYear();
let selectedYear = $("#yearpicker").val();

const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0)); // TODO must be 4 0s?
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);

let streamTabId = "#stream-tab", otherTabId = "#other-tab";
let selectedTab = streamTabId;
let tabs = {
    [streamTabId]: {
        "plotName": { 
            "forecast": "Forecast",
            "historical": "Historical",
            "flow-duration": "Flow Duration",
            "flow-regime": "Flow Regime",
            "annual-discharge": "Annual Discharge"
        }, 
        "plotData": {
            "forecast": null,
            "historical": null,
            "flow-duration": null,
            "flow-regime": null
        }
    }, 
    [otherTabId]: {
        "plotName": {
            "gldas-precip-soil": "Average Precipitation and Soil Moisture", 
            "gldas-soil": "GLDAS Soil Moisture", 
            "gldas-precip": "GLDAS Precipitation", 
            "imerg-precip": "IMERG Precipitation", 
            "era5-precip": "ERA5 Precipitation",
            "gfs-forecast": "GFS Forecast Precipitation"
        }, 
        "plotData": {
            "gldas-precip-soil": null, 
            "gldas-soil": null, 
            "gldas-precip": null, 
            "imerg-precip": null, 
            "era5-precip": null,
            "gfs-forecast": null
        }
    }
}



$(function() {
    initTabs();
    initMap();
    initYearPeaker();
    initSearchBox();
    initCountrySelector();
    initDrawControl();
})


let initTabs = function() {
    for (let tab in tabs) {
        $(tab).on('click', function(event) {
            event.preventDefault();
            selectedTab = tab;
            initPlotSelects();
            drawPlots();
            // if (tab == otherTabId && tabs[tab].plotData["gldas-precip-soil"] == null) {
            //     initPrecipitationPlots();
            // } else {
            //     drawPlots();
            // }
        })
    }
    $('.nav-link').click(function() {
        // Remove 'active' class from all tabs
        $('.nav-link').removeClass('active');
        // Add 'active' class to the clicked tab
        $(this).addClass('active');
    });
    initPlotSelects();
    drawPlots();
}

let initPrecipitationPlots = function() {
    showPlots(false);
    getGeePlots().then(function() {
        drawPlots();
    })
}

let initPlotSelects = function() {
    // add options to the select
    $(".plot-select").each(function(tabIndex) {
        $(this).empty();
        let plots = tabs[selectedTab].plotName;
        let plotIndex = 0;
        for (let key in plots) {
            $(this).append(new Option(plots[key], key, false, tabIndex == plotIndex));
            plotIndex++;
        }
    })

    // two selects can't choose the same option
    $(".plot-select").each(function() {
        let value = $(this).val();
        $(".plot-select").not(this).find('option[value="' + value + '"]').prop('disabled', true);
    })

    // load plot when the select value changes
    $(".plot-card").each(function(index, card) {
        let plotSelect = $(card).find(".plot-select");
        let plotContainer = $(card).find(".plot-container");
        plotSelect.on("change", function() {
            let value = $(this).val();
            plotContainer.html(tabs[selectedTab].plotData[value]);
            $(".plot-select").not(this).find('option').prop('disabled', false);
            $(".plot-select").not(this).find('option[value="' + value + '"]').prop('disabled', true);
        })        
    })
}


let initYearPeaker = function() {
    $('#yearpicker').datepicker({
        minViewMode: 2,
        format: 'yyyy',
        endDate: currentYear.toString()
    });
    $('#yearpicker').on('changeDate', function(e) {
        selectedYear = e.date.getFullYear();
        if (selectedTab == streamTabId && tabs[streamTabId].plotData["flow-regime"] != null) {
            updateFlowRegime(selectedYear)
        }
        $('#yearpicker').datepicker('hide');
    });
}


let initSearchBox = function() {
    $('#search-addon').click(findReachIDByID);
    $('#reach-id-input').keydown(event => {
        if (event.keyCode === 13) {
            findReachIDByID()
            .then(function(reachID) {
                showPlots(false);
                return setupDatePicker(reachID);
            })
            .then(function(data) {
                return Promise.all([getForecastData(data), getHistoricalData(data), getAnnualDischarge(data)])
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
}


// TODO change map layer when the tab changes
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

    mapObj.on('click', function(event) {
        if (!isDrawing) {
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
                    return Promise.all([getForecastData(data), getHistoricalData(data), getAnnualDischarge(data)])
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


let loadCountries = function() {
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


let initCountrySelector = function() {
    loadCountries();
    selectedCountry = L.geoJSON().addTo(mapObj);

    $("#country-selector").on("change", function() {
        selectedCountry.clearLayers();
        selectedCountry.addData(countries[$(this).val()].geometry);
        mapObj.fitBounds(selectedCountry.getBounds());
    })
}


let refreshMapLayer = function() {
    let sliderTime = new Date(mapObj.timeDimension.getCurrentTime());
    esriLayer.setTimeRange(sliderTime, endDateTime);
}


function clearPlots() {
    $(".plot-container").empty();
}


function drawPlots() {
    console.log("calling drawPlots()!");
    showPlots(true);
    clearPlots();
    $(".plot-card").each(function(index, card) {
        let plotSelect = $(card).find(".plot-select");
        let plotContainer = $(card).find(".plot-container");
        let plotContent = tabs[selectedTab].plotData[plotSelect.val()]; // Assuming plotData is an object with values based on select options
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

let drawnFeatures, drawnType, drawnCoordinates;

// Plot Methods
function initDrawControl() {
    // Initialize layer for drawn features
    drawnFeatures = new L.FeatureGroup();
    mapObj.addLayer(drawnFeatures);

    // Initialize draw controls
    let drawControl = new L.Control.Draw({
        draw: {
            polyline: false,
            // polygon: false,
            circle: false,
            rectangle: false,
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
        readAreaOfDrawnFeature();
        initPrecipitationPlots();
        // TODO switch to Other tab automatically after the user finished drawing
    });
};


// Read the area of the drawn feature
let readAreaOfDrawnFeature = function() {
    if (drawnFeatures.getLayers().length === 0) {
        console.log("No features drawn.");
        return;
    }

    const drawnFeature = drawnFeatures.getLayers()[0]; // Assuming there's only one drawn feature

    // if (drawnFeature instanceof L.Circle) {
    //     const center = drawnFeature.getLatLng();
    //     const radius = drawnFeature.getRadius();
    //     console.log("Circle center:", center);
    //     console.log("Circle radius:", radius);
    // } 
    // else if (drawnFeature instanceof L.Rectangle) {
    //     const bounds = drawnFeature.getBounds();
    //     console.log("Rectangle bounds:", bounds);
    // } 
    // else 
    if (drawnFeature instanceof L.Polygon) {
        drawnType = "polygone";
        drawnCoordinates = drawnFeature.getLatLngs();
        console.log("Polygon coordinates:", drawnCoordinates);
    } 
    else if (drawnFeature instanceof L.Marker) {
        drawnType = "point";
        drawnCoordinates = drawnFeature.getLatLng();
        console.log("Marker coordinates:", drawnCoordinates);
    }
}


/////////////////// Draw Plots ///////////////////


let findReachIDByID = function() {
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


let setupDatePicker = function(reachID) {
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
                // TODO add feature: the user can change the forecast_date
                resolve({'reachID': reachID, 'selectedDate': selectedDate});
            },
            error: function() {
                reject("fail to get available dates");
            }
        })
    })
}


let getFormattedDate = function(date) {
    return `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${(
        "0" + date.getDate()
    ).slice(-2)}.00`
}


let getForecastData = function(data) {
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
                tabs[streamTabId].plotData["forecast"] = response["plot"];
                resolve("success in getting forecast data!")
            },
            error: function() {
                console.error("fail to get forecast data");
                reject("fail to get forecast data");
            }
        })
    })
}


let getHistoricalData = function(data) {
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
                tabs[streamTabId].plotData["historical"] = response["plot"];
                tabs[streamTabId].plotData["flow-duration"] = response["fdp"];
                tabs[streamTabId].plotData["flow-regime"] = response["flow_regime"];
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

let getAnnualDischarge = function(data) {
    return new Promise(function(resolve, reject) {
        let reachID = data.reachID;
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getAnnualDischarge + L.Util.getParamString({
                reach_id: reachID
            }),
            success: function(response) {
                plot = response["plot"]
                tabs[streamTabId].plotData["annual-discharge"] = response["plot"];
                console.log("success in getting annual discharge!");
                resolve("success in getting annual discharge!");
            },
            error: function() {
                console.error("fail to get annual discharge!");
                reject("fail to get annual discharge!")
            }
        })
    })
}


let updateFlowRegime = function(year) {
    $.ajax({
        type: "GET",
        async: false,
        url: URL_updateFlowRegime + L.Util.getParamString({
            selected_year: year
        }),
        success: function(response) {
            tabs[streamTabId].plotData["flow-regime"] = response["flow_regime"];
            drawPlots();
            console.log("success in drawing new flow regime plot");
        },
        error: function() {
            console.error("fail to draw new flow regime plot");
        }
    })
}


let getGeePlots = function() {
    console.log("Get GEE plots...");
    let areaData = {
        type: drawnType,
        coordinates: drawnCoordinates,
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear + 1}-01-01`
    }
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: URL_getGEEPlots,
            data: JSON.stringify(areaData),
            dataType: "json",
            success: function(response) {
                tabs[otherTabId].plotData["gldas-precip-soil"] = response["gldas_precip_soil"];
                tabs[otherTabId].plotData["gldas-soil"] = response["gldas_soil"];
                tabs[otherTabId].plotData["gldas-precip"] = response["gldas_precip"];
                tabs[otherTabId].plotData["imerg-precip"] = response["imerg_precip"];
                tabs[otherTabId].plotData["era5-precip"] = response["era5_precip"];
                tabs[otherTabId].plotData["gfs-forecast"] = response["gfs_forecast"];
                console.log("success in getting GEE plots");
                resolve("success in getting GEE plots");
            },
            error: function() {
                console.error("fail to draw GEE plots");
                reject("fail to draw GEE plots");
            }
        })
    })
}
