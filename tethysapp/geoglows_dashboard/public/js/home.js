const isTest = false;
const currentYear = new Date().getFullYear();
let selectedReachId;
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
            "flow-regime": null,
            "annual-discharge": null
        },
        "selectedYear": { // only flow-regime need year
            "flow-regime": null,
        }, 
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
        },
        "selectedYear": {
            "gldas-precip-soil": null, 
            "gldas-soil": null, 
            "gldas-precip": null, 
            "imerg-precip": null, 
            "era5-precip": null,
        }
    }
}


$(function() {
    initTabs();
    initPlotCards();
    initMapCard();
})


/////////////////// Initialize the Page ///////////////////


let cardBodyInitialHeight = $(".plot-div").height();
let resize = function() {
    $(".plotly-graph-div").each(function(index, div) {
        Plotly.relayout(div, {
            "height": cardBodyInitialHeight,
            "width": $(".plot-div").width()
        });
    })
}
window.addEventListener("resize", resize);


let initTabs = function() {
    for (let tab in tabs) {
        $(tab).on('click', function(event) {
            event.preventDefault();
            selectedTab = tab;
            // highlight the selected tab
            $('.nav-link').removeClass('active');
            $(this).addClass('active');
            
            // init month picker and draw control for Other tab
            if (selectedTab == streamTabId) {
                $('#month-picker-div').hide();
            } else {
                $('#month-picker-div').show();
            } 

            initPlotCards();
            initMapCardBody();
        })
    }
}

let countries = {};
let selectedMonth = $('#month-picker').val();
let initMapCard = function() {
    let initCountrySelector = function() {
        // load countries
        fetch("/static/geoglows_dashboard/data/geojson/countries.geojson")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("countries.geojson was not ok");
                }
                return response.json();
            })
            .then((data) => {
                data = JSON.parse(JSON.stringify(data));
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
        
        $("#country-selector").on("change", function() {
            selectedCountry.clearLayers();
            selectedCountry.addData(countries[$(this).val()].geometry);
            mapObj.fitBounds(selectedCountry.getBounds());
        })
    }

    
    let initStreamSearchBox = function() {
        $('#search-addon').click(findReachIDByID);
        $('#reach-id-input').keydown(event => {
            if (event.keyCode === 13) {
                showSpinners();
                findReachIDByID()
                .then(function() {
                    return setupDatePicker();
                })
                .then(function() {
                    initSelectedPlots(update=true);
                })
                .catch(error => {
                    alert(error);
                    showPlotContainerMessages();
                })
            }
        })
    }


    let initMonthPicker = function() {
        $('#month-picker').datepicker({
            minViewMode: 1,
            format: 'yyyy-mm-01',
            startDate: '2001-01',
            endDate: '2023-05'
        });

        if (selectedTab == streamTabId) {
            $('#month-picker-div').hide();
        }
    
        $('#month-picker').on('changeDate', function(e) {
            $(this).datepicker('hide');
            if ($(this).val() != selectedMonth) {
                addHydroSOSLayer($(this).val(), false);
                selectedMonth = $(this).val();
            }
        }) 
    }

    initCountrySelector();
    initStreamSearchBox();
    initMonthPicker();
    initMapCardBody();
}


const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0));
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);
let mapObj, resetButton, mapMarker, selectedStream, selectedCountry;
let streamflowLayer = L.esri.dynamicMapLayer({
    url: "https://livefeeds2.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer",
    layers: [0],
    from: startDateTime,
    to: endDateTime,
    opacity: 0.7
});
const basemaps = {
    "Open Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),    
    "ESRI Topographic": L.esri.basemapLayer('Topographic'),
    "ESRI Terrain": L.layerGroup(
        [L.esri.basemapLayer('Terrain'), 
        L.esri.basemapLayer('TerrainLabels')]
    ),
    "ESRI Grey": L.esri.basemapLayer('Gray'),
}
let layerControl, hydroSOSLayer, dryLevelLegend;
let firstOtherTab = true; // the first time switch to other tab
let isDrawing = false;
let drawControl, drawnFeatures, drawnType, drawnCoordinates;


let initMapCardBody = function() {
    function refreshMapLayer() {
        let sliderTime = new Date(mapObj.timeDimension.getCurrentTime());
        streamflowLayer.setTimeRange(sliderTime, endDateTime);
    }

    let initDrawControl = function() {
        // Initialize layer for drawn features
        drawnFeatures = new L.FeatureGroup();
        mapObj.addLayer(drawnFeatures);

        // Initialize draw controls
        drawControl = new L.Control.Draw({
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
            initSelectedPlots(update=true);
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

    // init map object
    if (mapObj == null) {
        mapObj = L.map('leaflet-map', {
            zoom: 3,
            center: [0, 0],
            fullscreenControl: true,
            timeDimension: true
        });
    }

    if (resetButton == null) {
        resetButton = L.easyButton('fa-home', function(){
            // Set the map view to its original area
            mapObj.setView([0, 0], 3);
        }, 'Reset Map');
        resetButton.addTo(mapObj);
    }

    // init time control and drawing control
    if (selectedTab == streamTabId) {
        mapObj.timeDimension = L.timeDimension({
            timeInterval: startDateTime.toString() + "/" + endDateTime.toString(),
            period: "PT3H",
            currentTime: startDateTime
        });
    
        mapObj.timeDimensionControl = L.control.timeDimension({
            autoPlay: false,
                loopButton: true,
                timeSteps: 1,
                limitSliders: true,
                playerOptions: {
                    buffer: 0,
                    transitionTime: 500,
                }
        }).addTo(mapObj);
    
        mapObj.timeDimension.on('timeload', refreshMapLayer);
        $('.timecontrol-play').on('click', refreshMapLayer);

        if (drawControl != null) {
            mapObj.removeControl(drawControl);
        }
    } else {
        if (drawControl == null) {
            initDrawControl();
        } else {
            mapObj.addControl(drawControl);
        }
    }

    // init map layers
    basemaps["Open Street Map"].addTo(mapObj);

    // init map markers & layers for different tabs
    if (selectedTab == streamTabId) {
        // remove markers for other tab
        if (drawnFeatures) {
            mapObj.removeLayer(drawnFeatures);
        }
        if (mapMarker != null) {
            mapMarker.addTo(mapObj);
        }
        // add markers for this tab
        if (selectedStream != null) {
            selectedStream.addTo(mapObj);
        }
        // streamflow layer
        addStreamflowLayer();
    } else {
        // remove markers for other tab
        if (mapMarker) {
            mapObj.removeLayer(mapMarker);
        }
        if (selectedStream) {
            mapObj.removeLayer(selectedStream);
        }
        // add markers for this tab
        if (drawnFeatures != null) {
            drawnFeatures.addTo(mapObj);
        }
        selectedCountry = L.geoJSON().addTo(mapObj); // TODO find a better place
        // soil moisture layer
        addHydroSOSLayer($("#month-picker").val(), true);
    }

    mapObj.on('click', function(event) {
        if (!isDrawing) {
            if (mapMarker) {
                mapObj.removeLayer(mapMarker);
            }
            if (selectedStream) {
                selectedStream.clearLayers();
            }
            mapMarker = L.marker(event.latlng).addTo(mapObj);
            mapObj.flyTo(event.latlng, 10);
            showSpinners();
            findReachIDByLatLon(event)
                .then(function() {
                    return setupDatePicker();
                })
                .then(function() {
                    return initSelectedPlots(update=true);
                })
                .catch(error => {
                    alert(error);
                    showPlotContainerMessages();
                })
        }        
    })
};


let addStreamflowLayer = function() {
    if (layerControl != null) {
        layerControl.remove();
    }
    if (hydroSOSLayer != null) {
        hydroSOSLayer.remove();
    }
    if (dryLevelLegend != null) {
        dryLevelLegend.remove();
    }
    streamflowLayer.addTo(mapObj);
    layerControl = L.control.layers(basemaps, {"Streamflow": streamflowLayer} , {
        collapsed: false
    }).addTo(mapObj);
}

// TODO connect to the country selector
let addHydroSOSLayer = function(date, tabSwitched) { // yyyy-mm-01
    function getColor(dryLevel) {
        switch(dryLevel) {
            case "extremely dry":
                return "#CD233F";
            case "dry":
                return "#FFA885";
            case "normal range":
                return "#E7E2BC";
            case "wet":
                return "#8ECEEE";
            case "extremely wet":
                return "#2C7DCD";
        }
    }
    
    function getStyle(feature) {
        return {
            fillColor: getColor(feature.properties.classification),
            weight: 1.5,
            opacity: 1,
            color: "#808080",
            dashArray: '3',
            fillOpacity: 0.7
        };
    }

    function addDryLevelLegend() {
        dryLevelLegend = L.control({position: 'bottomright'});
        dryLevelLegend.onAdd = function() {
            let div = L.DomUtil.create('div', 'legend');
            let dryLevels = ["extremely dry", "dry", "normal range", "wet", "extremely wet"];

            // loop through our dryLevels intervals and generate a label with a colored square for each interval
            for (let i = 0; i < dryLevels.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + getColor(dryLevels[i]) + ';"></i> ' +
                    dryLevels[i] + '<br>';
            }

            return div;
        }
        dryLevelLegend.addTo(mapObj);
    }

    // remove all previous layers
    if (streamflowLayer != null) {
        mapObj.removeLayer(streamflowLayer);
    }
    if (dryLevelLegend != null) {
        dryLevelLegend.remove();
    }
    if (layerControl != null) {
        layerControl.remove();
    }
    mapObj.removeControl(mapObj.timeDimension);
    mapObj.removeControl(mapObj.timeDimensionControl);

    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getCountryDryLevel + L.Util.getParamString({
                date: date
            }),
            success: function(response) {
                if (tabSwitched || mapObj.hasLayer(hydroSOSLayer)) {
                    // remove old hydroSOSLayer
                    if (hydroSOSLayer == null) {
                        hydroSOSLayer = L.geoJSON(JSON.parse(response), {style: getStyle}).addTo(mapObj).addTo(mapObj);
                    }
                    // update hydroSOSLayer data
                    hydroSOSLayer.clearLayers();
                    hydroSOSLayer.addData(JSON.parse(response)).addTo(mapObj);
                }
                overlayMaps = {
                    "HydroSOS Soil Moisture": hydroSOSLayer,
                    // "HydroSOS Precipitation": null,
                };
                layerControl = L.control.layers(basemaps, overlayMaps, {
                    collapsed: false
                }).addTo(mapObj);
                addDryLevelLegend();
                resolve(hydroSOSLayer);
            },
            error: function() {
                reject("fail to get the country dry level");
            }
        })
    })
}

let hasReachId = function() {
    return selectedTab == streamTabId && selectedReachId != null;
}

let hasDrawnArea = function() {
    return selectedTab == otherTabId && drawnFeatures != null && drawnFeatures.getLayers().length !== 0;
}


/////////////////// Utilities for Loading Plots ///////////////////


let yearPickerValues = [$(".year-picker:eq(0)").val(), $(".year-picker:eq(1)").val()];
let initPlotCards = function() {
    //////////// init plot-select /////////
    // add options to the plot-select
    $(".plot-select").each(function(tabIndex) {
        $(this).empty();
        let plots = tabs[selectedTab].plotName;
        let plotIndex = 0;
        for (let key in plots) {
            // when tabIndex == plotIndex, set the option as selected
            $(this).append(new Option(plots[key], key, false, tabIndex == plotIndex));
            plotIndex++;
        }
    })

    // two plot-selects can't choose the same option
    $(".plot-select").each(function() {
        let value = $(this).val();
        $(".plot-select").not(this).find('option[value="' + value + '"]').prop('disabled', true);
    })

    //////////// init year-select ////////////
    if (selectedTab == streamTabId) {
        $(".year-select").prop('disabled', true);
        $(".year-select").addClass("disabled-select")
    } else {
        $(".year-select").prop('disabled', false);
        $(".year-select").removeClass("disabled-select")
    }

    //////////// init yearpicker ////////////
    $('.year-picker').datepicker({
        minViewMode: 2,
        format: 'yyyy',
        endDate: currentYear.toString()
    });

    // update the plot once the year changes
    $(".plot-card").each(function(index, card) {
        let yearPicker = $(card).find(".year-picker");
        // update the plot when selected year changes
        yearPicker.on('changeDate', function() {
            let newYearValue = yearPicker.val();
            if (newYearValue != yearPickerValues[index]) {
                yearPickerValues[index] = newYearValue;
                getSelectedPlot(card, newArea=false, newYear=true);
                $('.year-picker').datepicker('hide');
            }
        })

        let yearSelect = $(card).find(".year-select");
        // update the plot when year option changes
        yearSelect.on("change", function() {
            getSelectedPlot(card, newArea=false, newYear=true);
        })
    })

    //////////// init the plot div ////////////
    if (!hasReachId() && !hasDrawnArea()) {
        showPlotContainerMessages();
    } else {
        initSelectedPlots(newArea=false, newYear=false);
    }

    // load the plot or send a request when the selected value changes
    $(".plot-card").each(function(index, card) {
        let plotSelect = $(card).find(".plot-select");
        plotSelect.on("change", function() {
            let plotName = $(this).val();
            getSelectedPlot(card, newArea=false, newYear=false);
            // disable the option in the other select
            $(".plot-select").not(this).find('option').prop('disabled', false);
            $(".plot-select").not(this).find('option[value="' + plotName + '"]').prop('disabled', true);
        })        
    })
}


let initSelectedPlots = function(newArea=false, newYear=false) {
    $(".plot-card").each(function(index, card) {
        getSelectedPlot(card, newArea, newYear);
    })
}


let getSelectedPlot = function(plotCard, newArea=false, newYear=false) {
    let plotSelect = $(plotCard).find(".plot-select");
    let yearSelect = $(plotCard).find(".year-select");
    let plotContainer = $(plotCard).find(".plot-div");
    let spinner =  $(plotCard).find(".spinner");

    let plotName = plotSelect.val();
    let yearOption = yearSelect.val();
    let selectedYear = Number($(plotCard).find(".year-picker").val());

    let startDate, endDate;
    if (yearOption == "calendar-year") {
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear + 1}-01-01`;
    } else if (yearOption == "water-year") {
        startDate = `${selectedYear - 1}-10-01`;
        endDate = `${selectedYear}-09-30`;
    } else {
        let date = new Date();
        startDate = `${date.getFullYear() - 1}-${date.getMonth() + 1}-${date.getDate()}`;
        endDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    if (newArea) { // new area
        showSpinner(plotContainer, spinner);
        requestPlotData(plotName, selectedYear, startDate, endDate).then(function() {
            drawPlot(plotCard);
        })
    } else if (newYear) { // new year
        let needYear = plotName in tabs[selectedTab].selectedYear;
        let oldYear = tabs[selectedTab].selectedYear[plotName];
        if (needYear && oldYear != selectedYear && (hasReachId() || hasDrawnArea())) {
            showSpinner(plotContainer, spinner);
            requestPlotData(plotName, selectedYear, startDate, endDate).then(function() {
                drawPlot(plotCard);
            })
        }
    } else { // new plot selection
        let plotData = tabs[selectedTab].plotData[plotName];
        if (plotData != null) {
            drawPlot(plotCard);
        } else if (hasReachId() || hasDrawnArea()) {
            showSpinner(plotContainer, spinner);
            requestPlotData(plotName, selectedYear, startDate, endDate).then(function() {
                drawPlot(plotCard);
            })
        }
    }
}


let requestPlotData = function(plotName, selectedYear, startDate, endDate) {
    console.log("sending a request for " + plotName + " plot");
    switch (plotName) {
        case "forecast":
            return getForecastData();
        case "historical":
            return getHistoricalData(selectedYear);
        case "flow-duration":
            return getHistoricalData(selectedYear);
        case "flow-regime":
            if (tabs[selectedTab].plotData[plotName] == null) {
                return getHistoricalData(selectedYear);
            }
            console.log("update flow-regime");
            return updateFlowRegime(selectedYear);
        case "annual-discharge":
            return getAnnualDischarge();
        default:
            return getGeePlot(plotName, startDate, endDate);
    }
}


let drawPlot = function(plotCard) {
    let plotSelect = $(plotCard).find(".plot-select");
    let plotContainer = $(plotCard).find(".plot-div");
    let spinner = $(plotCard).find(".spinner");
    let plotData = tabs[selectedTab].plotData[plotSelect.val()];
    showPlot(plotContainer, spinner);
    plotContainer.html(plotData);
    resize();
}


let showPlots = function() {
    $(".plot-card").each(function(index, card) {
        let plotContainer = $(card).find(".plot-div");
        let spinner = $(card).find(".spinner");
        showPlot(plotContainer, spinner);
    })
}


let showSpinners = function() {
    $(".plot-card").each(function(index, card) {
        let plotContainer = $(card).find(".plot-div");
        let spinner = $(card).find(".spinner");
        showSpinner(plotContainer, spinner);
    })
}

let showPlot = function(plotContainer, spinner) {
    $(plotContainer).css("display", "flex");
    $(spinner).css("display", "none");
}

let showSpinner = function(plotContainer, spinner) {
    $(plotContainer).css("display", "none");
    $(spinner).css("display", "flex");
}

let showPlotContainerMessages = function() {
    showPlots();
    $(".plot-card").each(function(index, card) {
        if (selectedTab == streamTabId) {
            $(card).find(".plot-div").html("Please select a stream");
        } else {
            $(card).find(".plot-div").html("Please draw an area on the map");
        }
    })
}


/////////////////// Requesting Plot Data ///////////////////


let findReachIDByID = function() {
    return new Promise(function (resolve, reject) {
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
                    mapObj.removeLayer(mapMarker);
                }
                mapMarker = L.marker(L.latLng(response["lat"], response["lon"])).addTo(mapObj);
                mapObj.flyTo(L.latLng(response["lat"], response["lon"]), 9);
                selectedReachId = $('#reach-id-input').val();
                resolve("success in getting the reach id!");
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
                if (selectedStream == null) {
                    selectedStream = L.geoJSON(false, {weight: 5, color: '#00008b'}).addTo(mapObj);
                }
                selectedStream.clearLayers();
                selectedStream.addData(featureCollection.features[0].geometry);
                selectedReachId = featureCollection.features[0].properties["COMID (Stream Identifier)"];
                $('#reach-id-input').val(selectedReachId);
                resolve("success in getting the reach id!");
            }
        })
    })
}

let forecastPlotDate;

let setupDatePicker = function() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getAvailableDates + L.Util.getParamString({
                reach_id: selectedReachId,
                is_test: isTest.toString()
            }),
            success: function(response) {
                let dates = response["dates"]
                let latestAvailableDate = dates.sort(
                    (a, b) => parseFloat(b) - parseFloat(a)
                )[0]
                forecastPlotDate = new Date(
                    latestAvailableDate.slice(0, 4),
                    parseInt(latestAvailableDate.slice(4, 6)) - 1,
                    latestAvailableDate.slice(6, 8)
                )
                // TODO add feature: the user can change the forecast_date
                resolve("success in getting forecast date!");
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


let getForecastData = function() {
    return new Promise(function(resolve, reject) {  // get forecast date first TODO
        let selectedDate = forecastPlotDate;
        let startDate = new Date();
        let dateOffset = 24 * 60 * 60 * 1000 * 7;
        startDate.setTime(selectedDate.getTime() - dateOffset);
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getForecastData + L.Util.getParamString({
                reach_id: selectedReachId,
                end_date: getFormattedDate(forecastPlotDate),
                start_date: getFormattedDate(startDate),
                is_test: isTest.toString()
            }),
            success: function(response) {
                tabs[streamTabId].plotData["forecast"] = response["forecast"];
                console.log("success in getting forecast data!");
                resolve("success in getting forecast data!")
            },
            error: function() {
                console.error("fail to get forecast data");
                reject("fail to get forecast data");
            }
        })
    })
}


let getHistoricalData = function(selectedYear) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getHistoricalData + L.Util.getParamString({
                reach_id: selectedReachId,
                selected_year: selectedYear,
                is_test: isTest.toString()
            }),
            success: function(response) {
                tabs[streamTabId].plotData["historical"] = response["historical"];
                tabs[streamTabId].plotData["flow-duration"] = response["flow_duration"];
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


let getAnnualDischarge = function() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getAnnualDischarge + L.Util.getParamString({
                reach_id: selectedReachId
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
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "GET",
            async: false,
            url: URL_updateFlowRegime + L.Util.getParamString({
                selected_year: year
            }),
            success: function(response) {
                tabs[streamTabId].plotData["flow-regime"] = response["flow_regime"];
                console.log("success in drawing new flow regime plot");
                resolve("success in drawing new flow regime plot")
            },
            error: function() {
                console.error("fail to draw new flow regime plot");
                reject("fail to draw new flow regime plot");
            }
        })
    })
}


let getGeePlot = function(plotName, startDate, endDate) {
    console.log("Get GEE plot: " + plotName + " " + startDate + " " + endDate);
    let data = {
        areaType: drawnType,
        coordinates: drawnCoordinates,
        startDate: startDate,
        endDate: endDate,
        plotName: plotName
    }
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: URL_getGEEPlot,
            data: JSON.stringify(data),
            dataType: "json",
            success: function(response) {
                tabs[otherTabId].plotData[plotName] = response["plot"];
                console.log("success in getting GEE plot: " + plotName);
                resolve("success in getting GEE plot: " + plotName);
            },
            error: function() {
                console.error("fail to draw GEE plot: " + plotName);
                reject("fail to draw GEE plot: " + plotName);
            }
        })
    })
}
