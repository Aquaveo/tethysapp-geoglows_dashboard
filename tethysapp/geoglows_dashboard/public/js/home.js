/************************************************************************
*                       TAB DATA
*************************************************************************/

const streamTabID = "#stream-tab", otherTabID = "#other-tab";
const forecastPlotID = "forecast", 
    historicalPlotID = "historical", 
    flowDurationPlotID = "flow-duration",
    flowRegimePlotID = "flow-regime",
    annualDischargePlotID = "annual-discharge",
    SSIMonthlyPlotID = "ssi-monthly",
    SSIOneMonthPlotID = "ssi-one-month",
    GLDASPrecipSoilPlotID = "gldas-precip-soil",
    GLDASSoilPlotID = "gldas-soil",
    GLDASPrecipPlotID = "gldas-precip",
    IMERGPrecipPlotID = "imerg-precip",
    ERA5PrecipPlotID = "era5-precip",
    GFSForecasePlotID = "gfs-forecast";

const tabsData = {
    [streamTabID]: {
        "startDate": "1940-01",
        "endDate": "2022-12",
        "plots": {
            [forecastPlotID]: {
                "name": "Forecast",
                "data": null,
                "needYear": false,
                "needMonth": false,
                "needYearOption": false,
            },
            [historicalPlotID]: {
                "name": "Historical",
                "data": null,
                "needYear": false,
                "needMonth": false,
                "needYearOption": false,
            },
            [flowDurationPlotID]: {
                "name": "Flow Duration",
                "data": null,
                "needYear": false,
                "needMonth": false,
                "needYearOption": false,
            },
            [flowRegimePlotID]: {
                "name": "Flow Regime",
                "data": null,
                "needYear": true,
                "selectedYear": null,
                "needMonth": false,
                "needYearOption": false,
            },
            [annualDischargePlotID]: {
                "name": "Annual Discharge",
                "data": null,
                "needYear": false,
                "needMonth": false,
                "needYearOption": false,
            },
            [SSIMonthlyPlotID]: {
                "name": "SSI Monthly",
                "data": null,
                "needYear": false,
                "needMonth": false,
                "needYearOption": false,
            },
            [SSIOneMonthPlotID]: {
                "name": "SSI One Month",
                "data": null,
                "needYear": false,
                "needMonth": true,
                "selectedMonth": null,
                "needYearOption": false,
            }
        }
    },
    [otherTabID]: {
        "startDate": "2001-01",
        "endDate": "2023-05",
        "plots": {
            [GLDASPrecipSoilPlotID]: {
                "name": "Average Precipitation and Soil Moisture",
                "data": null,
                "needYear": true,
                "selectedYear": null,
                "needMonth": false,
                "needYearOption": true,
            },
            [GLDASSoilPlotID]: {
                "name": "GLDAS Soil Moisture",
                "data": null,
                "needYear": true,
                "selectedYear": null,
                "needMonth": false,
                "needYearOption": true,
            },
            [IMERGPrecipPlotID]: {
                "name": "IMERG Precipitation",
                "data": null,
                "needYear": true,
                "selectedYear": null,
                "needMonth": false,
                "needYearOption": true,
            },
            [ERA5PrecipPlotID]: {
                "name": "ERA5 Precipitation",
                "data": null,
                "needYear": true,
                "selectedYear": null,
                "needMonth": false,
                "needYearOption": true,
            },
            [GFSForecasePlotID]: {
                "name": "GFS Forecast Precipitation",
                "data": null,
                "needYear": true,
                "selectedYear": null,
                "needMonth": false,
                "needYearOption": true,
            }
        }
    }
}


let selectedTab = streamTabID;
let selectedReachID;


/************************************************************************
*                       INITIALIZE THE PAGE
*************************************************************************/

$(function() {
    initTabs();
    initPlotCards();
    initMapCard();
    initAdminSettings();
})


let initTabs = function() {
    for (let tab in tabsData) {
        $(tab).on('click', function(event) {
            event.preventDefault();
            if (selectedTab != tab) {
                selectedTab = tab;
                // highlight the selected tab
                $('.nav-link').removeClass('active');
                $(this).addClass('active');
                
                updateYearMonthPicker();
                initPlotCards();
                initMapCardBody();
            }
        })
    }
}

let initMapCard = function() {
    initMapCardHeader();
    initMapCardBody();
}


/************************************************************************
*                       INITIALIZE MAP CARD HEADER
*************************************************************************/

let updateSelectedReachByID = function(reachID, isSubbasinOutlet=false) {
    $('#reach-id-input').val(reachID);
    findLatLonByReachID(reachID, isSubbasinOutlet)
        .then(initSelectedPlots)
        .catch(error => {
            alert(error);
            showPlotContainerMessages();
        })
}


let selectedYearMonth = $('#year-month-picker').val();
let initMapCardHeader = function() {
    let initStreamSearchBox = function() {
        $('#search-addon').click(function() {
            updateSelectedReachByID($('#reach-id-input').val(), isSubbasinOutlet=false)
        });
        $('#reach-id-input').keydown(event => {
            if (event.keyCode === 13) {
                showSpinners();
                updateSelectedReachByID($('#reach-id-input').val(), isSubbasinOutlet=false);
            }
        })
    }
    
    let initYearMonthPicker = function() {
        $('#year-month-picker').datepicker({
            minViewMode: 1,
            format: 'yyyy-mm-01',
            startDate: '1940-01',
            endDate: '2022-12'
        });
    
        $('#year-month-picker').on('changeDate', function() {
            $(this).datepicker('hide');
            let date = $(this).val();
            if (date != selectedYearMonth) {
                if (selectedTab == otherTabID) {
                    addOtherTabLayers(date);
                } else {
                    updateHydroSOSStreamflowLayer(date);
                }
                selectedYearMonth = date;
            }
        }) 
    }

    initStreamSearchBox();
    initYearMonthPicker();
}


let updateYearMonthPicker = function() {
    if (selectedTab == streamTabID) {
        $('#year-month-picker').datepicker('setStartDate', tabsData[streamTabID].startDate);
        $('#year-month-picker').datepicker('setEndDate', tabsData[streamTabID].endDate);
    } else {
        $('#year-month-picker').datepicker('setStartDate', tabsData[otherTabID].startDate);
        $('#year-month-picker').datepicker('setEndDate', tabsData[otherTabID].endDate);
    }

    if (selectedTab == streamTabID && selectedYearMonth > tabsData[streamTabID].endDate) {
        $('#year-month-picker').datepicker('update', tabsData[streamTabID].endDate);
    }

    if (selectedTab == otherTabID && selectedYearMonth < tabsData[otherTabID].startDate) {
        $('#year-month-picker').datepicker('update', tabsData[otherTabID].startDate);
    }
}


/************************************************************************
*                       INITIALIZE MAP CARD BODY
*************************************************************************/

const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0));
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);
let mapObj, resetButton, mapMarker, selectedStream, selectedCountry, selectedSubbasin;
const geoglowsStreamflowLayer = L.esri.dynamicMapLayer({
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

let layerControl, soilMoistureLayer, precipitationLayer, hydroSOSStreamflowLayer, subbasinLayer, geeSPILayer;
let currentStreamflowLayer, currentHydroSOSLayer;
let geoglowsLegend, hydroSOSLegend, spiLegend;

let drawControl, drawnFeatures, drawnType, drawnCoordinates;
let isDrawing = false;

let initGeoglowsStreamflowLegend = function() {
    geoglowsLegend = L.control({position: 'bottomright'});
    geoglowsLegend.onAdd = function() {
        let div = L.DomUtil.create('div', 'legend');
        let start =
            '<div><svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg">';
        div.innerHTML =
            '<div class="legend-title">Geoglows Streamflow Legend</div>' + 
            start +
            '<polyline points="19 1, 1 6, 19 14, 1 19" stroke="#ca60f5" fill="transparent" stroke-width="2"/></svg> 20-yr Return Period Flow </div>' +
            start +
            '<polyline points="19 1, 1 6, 19 14, 1 19" stroke="#f67676" fill="transparent" stroke-width="2"/></svg> 10-yr Return Period Flow </div>' +
            start +
            '<polyline points="19 1, 1 6, 19 14, 1 19" stroke="#f3de8b" fill="transparent" stroke-width="2"/></svg> 2-yr Return Period Flow</div>' +
            start +
            '<polyline points="19 1, 1 6, 19 14, 1 19" stroke="#2596be" fill="transparent" stroke-width="2"/></svg> Stream Line </div>';
        return div;
    }
}

let initSPILegend = function() {
    spiLegend = L.control({position: 'bottomright'});
    spiLegend.onAdd = function() {
        let div = L.DomUtil.create('div', 'legend');
        div.innerHTML = 
            '<div class="legend-title">SPI 16 Day Legend</div>' + 
            '<img src="/static/geoglows_dashboard/images/spi-legend.jpg" style="height:40px; width:auto">';
        return div;
    }
}

let initHydroSOSLegend = function() {
    hydroSOSLegend = L.control({position: 'bottomright'});
    hydroSOSLegend.onAdd = function() {
        let div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<div class="legend-title">HydroSOS Streamflow Legend</div>';
        let dryLevels = ["extremely dry", "dry", "normal range", "wet", "extremely wet"];
        for (let i = 0; i < dryLevels.length; i++) {
            div.innerHTML +=
                '<i style="background:' + getColor(dryLevels[i]) + ';"></i> ' +
                dryLevels[i] + '<br>';
        }

        return div;
    }
}

let initMapCardBody = function() {
    let addSubbasinLayer = function() {
        function onEachFeature(feature, layer) {
            let riverID = feature.properties['River ID'];
            layer.bindPopup('<b>Name:</b> ' + feature.properties.Name);
            layer.on('click', function() {
                if (selectedSubbasin != null) {
                    selectedSubbasin.setStyle({'color': '#3388ff'});
                }
                layer.setStyle({'color': 'red'});
                selectedSubbasin = layer;
                updateSelectedReachByID(riverID, isSubbasinOutlet=true);
            })
        }

        if (subbasinLayer == null) {
            fetch("/static/geoglows_dashboard/data/geojson/nile_sub_basins.geojson")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("nile_sub_basins was not ok");
                }
                return response.json()
            })
            .then((data) => {
                data = JSON.parse(JSON.stringify(data));
                subbasinLayer = L.geoJSON(data, {
                    style: {
                        "color": "#3388ff",
                        "weight": 2
                    },
                    onEachFeature: onEachFeature
                });
                subbasinLayer.addTo(mapObj);
                mapObj.fitBounds(subbasinLayer.getBounds());
                layerControl.addOverlay(subbasinLayer, "Subbasins");
            })
            .catch((error) => {
                console.error("Error:", error);
            });
        } else {
            mapObj.fitBounds(subbasinLayer.getBounds());
            layerControl.addOverlay(subbasinLayer, "Subbasins");
        }
    }

    let addGEESPILayer = function() {
        if (geeSPILayer == null) {
            $.ajax({
                type: "GET",
                async: true,
                url: URL_getGEEMapLayer,
                success: function(response) {
                    geeSPILayer = L.tileLayer(response['url']);
                    layerControl.addOverlay(geeSPILayer, "CHIRPS SPI");
                },
                error: function(error) {
                    console.log(error)
                }
            })
        } else {
            layerControl.addOverlay(geeSPILayer, "CHIRPS SPI");
        }
    }

    let addStreamTabLayers = async function() {
        if (layerControl != null) {
            layerControl.remove();
        }
        if (currentHydroSOSLayer) {
            currentHydroSOSLayer.remove();
            hydroSOSLegend.remove();
        }

        await updateHydroSOSStreamflowLayer($("#year-month-picker").val())
        layerControl = L.control.layers(
            basemaps,
            {"Geoglows Streamflow": geoglowsStreamflowLayer, "HydroSOS Streamflow": hydroSOSStreamflowLayer} ,
            {collapsed: false}
        ).addTo(mapObj);
        geoglowsStreamflowLayer.addTo(mapObj);
        addSubbasinLayer(); 
        addGEESPILayer();
    }

    let refreshGeoglowsStreamflowLayer = function() {
        let sliderTime = new Date(mapObj.timeDimension.getCurrentTime());
        geoglowsStreamflowLayer.setTimeRange(sliderTime, endDateTime);
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
            initSelectedPlots();
        });
    };

    // Read the area of the drawn feature
    let readAreaOfDrawnFeature = function() {
        if (drawnFeatures.getLayers().length === 0) {
            console.log("No features drawn.");
            return;
        }

        const drawnFeature = drawnFeatures.getLayers()[0]; // Assuming there's only one drawn feature

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
        initHydroSOSLegend();
        initGeoglowsStreamflowLegend();
        initSPILegend();

        // make geoglows and hydrosos streamflow mutually exclusive
        mapObj.on("overlayadd", function(e) {
            if (e.layer == geoglowsStreamflowLayer) {
                if (currentStreamflowLayer == hydroSOSStreamflowLayer) {
                    removeWithTimeout(currentStreamflowLayer);
                }
                geoglowsLegend.addTo(mapObj);
                currentStreamflowLayer = geoglowsStreamflowLayer;
            } else if (e.layer == hydroSOSStreamflowLayer) {
                if (currentStreamflowLayer == geoglowsStreamflowLayer) {
                    removeWithTimeout(currentStreamflowLayer);
                }
                hydroSOSLegend.addTo(mapObj);
                currentStreamflowLayer = hydroSOSStreamflowLayer;
            } else if (e.layer == geeSPILayer) {
                spiLegend.addTo(mapObj);
            } else if (e.layer == soilMoistureLayer) {
                if (currentHydroSOSLayer == precipitationLayer) {
                    removeWithTimeout(currentHydroSOSLayer);
                }
                setTimeout(() => hydroSOSLegend.addTo(mapObj), 10);
                currentHydroSOSLayer = soilMoistureLayer;
            } else if (e.layer == precipitationLayer) {
                if (currentHydroSOSLayer == soilMoistureLayer) {
                    removeWithTimeout(currentHydroSOSLayer);
                }
                setTimeout(() => hydroSOSLegend.addTo(mapObj), 10);
                currentHydroSOSLayer = precipitationLayer;
            }
        })

        mapObj.on("overlayremove", function(e) {
            if (e.layer == geoglowsStreamflowLayer) {
                geoglowsLegend.remove();
            } else if (e.layer == hydroSOSStreamflowLayer) {
                hydroSOSLegend.remove();
            } else if (e.layer == geeSPILayer) {
                spiLegend.remove();
            } else if (e.layer == precipitationLayer || e.layer == soilMoistureLayer) {
                hydroSOSLegend.remove();
            }
            if (currentStreamflowLayer == e.layer) {
                currentStreamflowLayer = null;
            } else if (currentHydroSOSLayer == e.layer) {
                currentHydroSOSLayer = null;
            }
        })

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
                    .then(initSelectedPlots)
                    .catch(error => {
                        alert(error);
                        showPlotContainerMessages();
                    })
            }        
        })
    }

    if (resetButton == null) {
        resetButton = L.easyButton('fa-home', function(){
            // Set the map view to its original area
            mapObj.setView([0, 0], 3);
        }, 'Reset Map');
        resetButton.addTo(mapObj);
    }

    // init time control and drawing control
    if (selectedTab == streamTabID) {
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
    
        mapObj.timeDimension.on('timeload', refreshGeoglowsStreamflowLayer);
        $('.timecontrol-play').on('click', refreshGeoglowsStreamflowLayer);

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
    if (selectedTab == streamTabID) {
        // remove markers from other tab
        if (drawnFeatures) {
            mapObj.removeLayer(drawnFeatures);
        }
        if (mapMarker != null) {
            mapMarker.addTo(mapObj);
        }
        // add markers to this tab
        if (selectedStream != null) {
            selectedStream.addTo(mapObj);
        }
        addStreamTabLayers();
    } else {
        // remove markers from streamflow tab
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
        // other layer
        addOtherTabLayers($("#year-month-picker").val());
        // zoom in to the selected country
        if (selectedCountry) {
            mapObj.fitBounds(selectedCountry.getBounds());
        }
    }
};

///// HydroSOS Layers /////

let getColor = function(dryLevel) {
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


let getHydroSOSCountryDryLevelStyle = function(feature) {
    return {
        fillColor: getColor(feature.properties.classification),
        weight: 1.5,
        opacity: 1,
        color: "#808080",
        dashArray: '3',
        fillOpacity: 0.7
    };
}

let geoserverEndpoint;
let getGeoserverEndpoint = function() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: 'get_geoserver_endpoint',
            success: function(response) {
                geoserverEndpoint = response['endpoint'];
                resolve("get the geoserver endpoint: " + geoserverEndpoint);
            },
            error: function() {
                reject("fail to get geoserver endpoint");
            }
        })
    });
    
}

let minStreamOrder;
let updateHydroSOSStreamflowLayer = async function(date) {
    let getMinStreamOrder = function() {
        let currentZoom = mapObj.getZoom();
        if (currentZoom <= 2) {
            return 8;
        }
        if (currentZoom >= 15) {
            return 2;
        }
        return 7 - Math.floor((currentZoom - 3) / 2);
    }

    if (!hydroSOSStreamflowLayer) {
        try {
            await getGeoserverEndpoint()
            hydroSOSStreamflowLayer = L.tileLayer.wms(`${geoserverEndpoint}/geoglows_dashboard/wms`, {
                layers: 'geoglows_dashboard:hydrosos_streamflow_layer',
                format: 'image/png',
                transparent: true,
                viewparams: `selected_month:${date};min_stream_order:${getMinStreamOrder()}`
            });
        } catch(error) {
            console.error("Error occurred while fetching Geoserver endpoint:", error);
        }
        // update the layer every time we zoom in/out
        mapObj.on("zoomend", function() {
            let newMinStreamOrder = getMinStreamOrder();
            if (newMinStreamOrder != minStreamOrder) {
                minStreamOrder = newMinStreamOrder;
                hydroSOSStreamflowLayer.setParams({viewparams: `selected_month:${$('#year-month-picker').val()};min_stream_order:${minStreamOrder}`});
            }
        })
    } else {
        hydroSOSStreamflowLayer.setParams({viewparams: `selected_month:${date};min_stream_order:${getMinStreamOrder()}`})
    }
}

let removeWithTimeout = function(layer) {
    setTimeout(() => mapObj.removeLayer(layer), 10);
}

let addOtherTabLayers = function(date) { // yyyy-mm-01
    let getSoilMoistureLayer = function(date) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                type: "GET",
                async: true,
                url: URL_getCountryDryLevel + L.Util.getParamString({
                    date: date,
                    type: "soil",
                    country: $("#country-selector").val()
                }),
                success: function(response) {
                    if (soilMoistureLayer == null) {
                        soilMoistureLayer = L.geoJSON(JSON.parse(response), {style: getHydroSOSCountryDryLevelStyle});
                    } else {
                        soilMoistureLayer.clearLayers();
                        soilMoistureLayer.addData(JSON.parse(response));
                    }
                    resolve("success in getting HydroSOS Soil Moisture layer data");
                },
                error: function() {
                    reject("fail to get HydroSOS Soil Moisture layer dat");
                }
            })
        })
    }

    let getPrecipitationLayer = function(date) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                type: "GET",
                async: true,
                url: URL_getCountryDryLevel + L.Util.getParamString({
                    date: date,
                    type: "precip",
                    country:  $("#country-selector").val()
                }),
                success: function(response) {
                    if (precipitationLayer == null) {
                        precipitationLayer = L.geoJSON(JSON.parse(response), {style: getHydroSOSCountryDryLevelStyle});
                    } else {
                        // update hydroSOSLayer data
                        precipitationLayer.clearLayers();
                        precipitationLayer.addData(JSON.parse(response));
                    }
                    resolve("success in getting HydroSOS Precipitation layer data");
                },
                error: function() {
                    reject("fail to get the HydroSOS Precipitation layer data");
                }
            })
        })
    }

    // remove all previous layers
    if (geoglowsStreamflowLayer != null) {
        mapObj.removeLayer(geoglowsStreamflowLayer);
    }
    if (hydroSOSStreamflowLayer != null) {
        mapObj.removeLayer(hydroSOSStreamflowLayer);
    }
    if (geeSPILayer != null) {
        mapObj.removeLayer(geeSPILayer);
    }

    if (layerControl != null) {
        layerControl.remove();
    }
    mapObj.removeControl(mapObj.timeDimension);
    mapObj.removeControl(mapObj.timeDimensionControl);

    getSoilMoistureLayer(date)
        .then(function() {
            return getPrecipitationLayer(date);
        })
        .then(function() {
            overlayMaps = {
                "HydroSOS Soil Moisture": soilMoistureLayer,
                "HydroSOS Precipitation": precipitationLayer,
            };
            layerControl = L.control.layers(basemaps, overlayMaps, {
                collapsed: false,
            }).addTo(mapObj);

            soilMoistureLayer.addTo(mapObj);
            currentHydroSOSLayer = soilMoistureLayer;
        })
}

let hasReachId = function() {
    return selectedTab == streamTabID && selectedReachID != null;
}

let hasDrawnArea = function() {
    return selectedTab == otherTabID && drawnFeatures != null && drawnFeatures.getLayers().length !== 0;
}


/************************************************************************
*                       INITIALIZE PLOT CARDS
*************************************************************************/


let yearPickerValues = [$(".year-picker:eq(0)").val(), $(".year-picker:eq(1)").val()];
let monthPickerValues = [$(".month-picker:eq(0)").val(), $(".month-picker:eq(1)").val()];
let initPlotCards = function() {
    let initSelectorsForPlot = function(plotCard) {
        let plotSelect = $(plotCard).find(".plot-select");
        let plotID = $(plotSelect).val();
        if (tabsData[selectedTab].plots[plotID].needYear) {
            $(plotCard).find('.year-picker-div').removeClass('d-none').addClass('d-flex');
        } else {
            $(plotCard).find('.year-picker-div').addClass('d-none');
        }
        if (tabsData[selectedTab].plots[plotID].needMonth) {
            $(plotCard).find('.month-picker-div').removeClass('d-none').addClass('d-flex');
        } else {
            $(plotCard).find('.month-picker-div').addClass('d-none');
        }
        if (tabsData[selectedTab].plots[plotID].needYearOption) {
            $(plotCard).find('.year-option-select-div').removeClass('d-none').addClass('d-flex');
        } else {
            $(plotCard).find('.year-option-select-div').addClass('d-none');
        }
    }

    //////////// init plot-select /////////
    // add options to the plot-select
    $(".plot-select").each(function(tabIndex) {
        $(this).empty();
        let plots = tabsData[selectedTab].plots;
        let plotIndex = 0;
        for (let plotID in plots) {
            let plot = plots[plotID];
            let plotName = plot["name"];
            $(this).append(new Option(plotName, plotID, false, tabIndex == plotIndex));
            plotIndex++;
        }
    })

    // two plot-selects can't choose the same option
    $(".plot-select").each(function() {
        let plotID = $(this).val();
        $(".plot-select").not(this).find('option[value="' + plotID + '"]').prop('disabled', true);
    })

    //////////// init datepickers //////////// 
    $('.year-picker').datepicker({
        minViewMode: 'years',
        format: 'yyyy',
        endDate: new Date().getFullYear().toString()
    });

    $('.month-picker').datepicker({
        minViewMode: 'months',
        maxViewMode: 'months',
        format: 'M'
    })

    // init selects
    $(".plot-card").each(function(index, card) {
        initSelectorsForPlot(card);

        // update the plot once the year/month/year-option changes
        let yearPicker = $(card).find(".year-picker");
        yearPicker.on('changeDate', function() {
            let newYearValue = yearPicker.val();
            if (newYearValue != yearPickerValues[index]) {
                yearPickerValues[index] = newYearValue;
                getSelectedPlot(card, isNewArea=false, isNewYear=true, isNewMonth=false);
                $('.year-picker').datepicker('hide');
            }
        })

        let monthPicker = $(card).find(".month-picker");
        monthPicker.on('changeDate', function() {
            newMonthValue = monthPicker.val();
            if (newMonthValue != monthPickerValues[index]) {
                monthPickerValues[index] = newMonthValue;
                getSelectedPlot(card, isNewArea=false, isNewYear=false, isNewMonth=true);
                $('month-picker').datepicker('hide');
            }
        })

        let yearOptionSelect = $(card).find(".year-option-select");
        yearOptionSelect.on("change", function() {
            getSelectedPlot(card, isNewArea=false, isNewYear=true, isNewMonth=false);
        })
    })

    //////////// init the plot div ////////////
    if (!hasReachId() && !hasDrawnArea()) {
        showPlotContainerMessages();
    } else {
        initSelectedPlots();
    }

    // load the plot & add selectors when the selected plotID changes
    $(".plot-card").each(function(_index, card) {
        let plotSelect = $(card).find(".plot-select");
        plotSelect.on("change", function() {
            initSelectorsForPlot(card);
            getSelectedPlot(card);
            // disable the option in the other select
            let plotID = $(this).val();
            $(".plot-select").not(this).find('option').prop('disabled', false);
            $(".plot-select").not(this).find('option[value="' + plotID + '"]').prop('disabled', true);
        })        
    })
}

/************************************************************************
*                       UTILITIES FOR LOADING PLOTS
*************************************************************************/

let initSelectedPlots = function(isNewArea=false, isNewYear=false, isNewMonth=false) {
    $(".plot-card").each(function(_index, card) {
        getSelectedPlot(card, isNewArea, isNewYear, isNewMonth);
    })
}


const monthToNumber = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
};
let getSelectedPlot = function(plotCard, isNewArea=false, isNewYear=false, isNewMonth=false) {
    let plotSelect = $(plotCard).find(".plot-select");
    let yearSelect = $(plotCard).find(".year-option-select");
    let plotContainer = $(plotCard).find(".plot-div");
    let spinner =  $(plotCard).find(".spinner");

    let plotID = plotSelect.val();
    let yearOption = yearSelect.val();
    let selectedYear = Number($(plotCard).find(".year-picker").val());
    let selectedMonth = monthToNumber[$(plotCard).find(".month-picker").val()];

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

    if (isNewArea) { // new area
        showSpinner(plotContainer, spinner);
        requestPlotData(plotID, selectedYear, selectedMonth, startDate, endDate).then(function() {
            drawPlot(plotCard);
        })
    } else if (isNewYear) { // new year
        let needYear =  tabsData[selectedTab].plots[plotID].needYear;
        let oldYear = tabsData[selectedTab].plots[plotID].selectedYear;
        if (needYear && oldYear != selectedYear && (hasReachId() || hasDrawnArea())) {
            tabsData[selectedTab].plots[plotID].selectedYear = selectedYear;
            showSpinner(plotContainer, spinner);
            requestPlotData(plotID, selectedYear, selectedMonth, startDate, endDate).then(function() {
                drawPlot(plotCard);
            })
        }
    } else if (isNewMonth) {  // new month
        let needMonth = tabsData[selectedTab].plots[plotID].needMonth;
        let oldMonth = tabsData[selectedTab].plots[plotID].selectedMonth;
        if (needMonth && oldMonth != selectedMonth && (hasReachId() || hasDrawnArea())) {
            tabsData[selectedTab].plots[plotID].selectedMonth = selectedMonth;
            showSpinner(plotContainer, spinner);
            requestPlotData(plotID, selectedYear, selectedMonth, startDate, endDate).then(function() {
                drawPlot(plotCard);
            })
        }
    } else { // new plot selection
        let plotData = tabsData[selectedTab].plots[plotID].data;
        if (plotData != null) {
            drawPlot(plotCard);
        } else if (hasReachId() || hasDrawnArea()) {
            showSpinner(plotContainer, spinner);
            requestPlotData(plotID, selectedYear, selectedMonth, startDate, endDate).then(function() {
                drawPlot(plotCard);
            })
        }
    }
}


let requestPlotData = function(plotID, selectedYear, selectedMonth, startDate, endDate) {
    console.log("sending a request for " + plotID + " plot");
    switch (plotID) {
        case forecastPlotID:
            return getForecastPlot(selectedReachID);
        case historicalPlotID:
            return getHistoricalPlot(selectedYear, selectedReachID);
        case flowDurationPlotID:
            return getHistoricalPlot(selectedYear, selectedReachID);
        case flowRegimePlotID:
            if (tabsData[selectedTab].plots[plotID].data == null) {
                return getHistoricalPlot(selectedYear, selectedReachID);
            }
            return updateFlowRegimePlot(selectedYear, selectedReachID);
        case annualDischargePlotID:
            return getAnnualDischargePlot(selectedReachID);
        case SSIMonthlyPlotID:
            return getSSIPlot(selectedReachID, -1)
        case SSIOneMonthPlotID:
            return getSSIPlot(selectedReachID, selectedMonth);
        default:
            return getGeePlot(plotID, startDate, endDate);
    }
}

// resize the plot div
const cardBodyInitialHeight = $(".plot-div").height();
let resize = function() {
    $(".plotly-graph-div").each(function(_index, div) {
        Plotly.relayout(div, {
            "height": cardBodyInitialHeight,
            "width": $(".plot-div").width()
        });
    })
}
window.addEventListener("resize", resize);


let drawPlot = function(plotCard) {
    let plotSelect = $(plotCard).find(".plot-select");
    let plotContainer = $(plotCard).find(".plot-div");
    let spinner = $(plotCard).find(".spinner");
    let plotData = tabsData[selectedTab].plots[plotSelect.val()].data;
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
        if (selectedTab == streamTabID) {
            $(card).find(".plot-div").html("Please select a stream");
        } else {
            $(card).find(".plot-div").html("Please draw an area on the map");
        }
    })
}


/////////////////// Requesting Plot Data ///////////////////


let findLatLonByReachID = function(reachID, isSubbasinOutlet=false) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url:
                URL_getReachLatLon + 
                L.Util.getParamString({
                    reach_id: reachID
                }),
            success: function(response) {
                if (mapMarker) {
                    mapObj.removeLayer(mapMarker);
                }
                mapMarker = L.marker(L.latLng(response["lat"], response["lon"])).addTo(mapObj);
                if (!isSubbasinOutlet) {
                    mapObj.flyTo(L.latLng(response["lat"], response["lon"]), 9);
                }
                selectedReachID = reachID;
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
        $.get({
            url: 'https://geoglows.ecmwf.int/api/v2/getReachID',
            data: {'lat': event.latlng['lat'], 'lon': event.latlng['lng']},
            success: function(response) {
                selectedReachID = response.reach_id;
                $('#reach-id-input').val(selectedReachID);
                resolve("success in getting the reach id!");
            },
            error: function() {
                reject(new Error("Fail to find the reach_id"));
            },

        })
    })
}


let getForecastPlot = function(reachID) {
    return new Promise(function(resolve, reject) {  // get forecast date first TODO
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getForecastPlot + L.Util.getParamString({
                reach_id: reachID
            }),
            success: function(response) {
                tabsData[streamTabID].plots[forecastPlotID].data = response["forecast"];
                resolve("success in getting forecast data!")
            },
            error: function() {
                reject("fail to get forecast data");
            }
        })
    })
}


let getHistoricalPlot = function(year, reachID) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getHistoricalPlot + L.Util.getParamString({
                reach_id: reachID,
                selected_year: year
            }),
            success: function(response) {
                tabsData[streamTabID].plots[historicalPlotID].data = response["historical"];
                tabsData[streamTabID].plots[flowDurationPlotID].data = response["flow_duration"];
                tabsData[streamTabID].plots[flowRegimePlotID].data = response["flow_regime"];
                resolve("success in getting historical data!");
            },
            error: function() {
                reject("fail to get historical data")
            }
        })
    })
}


let getAnnualDischargePlot = function(reachID) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getAnnualDischargePlot + L.Util.getParamString({
                reach_id: reachID
            }),
            success: function(response) {
                tabsData[streamTabID].plots[annualDischargePlotID].data = response["plot"];
                resolve("success in getting annual discharge!");
            },
            error: function() {
                reject("fail to get annual discharge!")
            }
        })
    })
}


let getSSIPlot = function(reachID, month) {
    let plotID = month < 0 ? SSIMonthlyPlotID: SSIOneMonthPlotID;
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getSSIPlot + L.Util.getParamString({
                reach_id: reachID,
                month: month
            }),
            success: function(response) {
                tabsData[streamTabID].plots[plotID].data = response["plot"];
                resolve(`success in getting ${plotID}!`);
            },
            error: function() {
                reject(`fail to get ${plotID}!`)
            }
        })
    })
}


let updateFlowRegimePlot = function(year, reachID) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "GET",
            async: false,
            url: URL_updateFlowRegimePlot + L.Util.getParamString({
                selected_year: year,
                reach_id: reachID
            }),
            success: function(response) {
                tabsData[streamTabID].plots[flowRegimePlotID].data = response["flow_regime"];
                resolve("success in drawing new flow regime plot")
            },
            error: function() {
                reject("fail to draw new flow regime plot");
            }
        })
    })
}


let getGeePlot = function(plotID, startDate, endDate) {
    console.log("Get GEE plot: " + plotID + " " + startDate + " " + endDate);
    let data = {
        areaType: drawnType,
        coordinates: drawnCoordinates,
        startDate: startDate,
        endDate: endDate,
        plotName: plotID
    }
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: URL_getGEEPlot,
            data: JSON.stringify(data),
            dataType: "json",
            success: function(response) {
                tabsData[otherTabID].plots[plotID].data = response["plot"];
                resolve("success in getting GEE plot: " + plotID);
            },
            error: function() {
                reject("fail to draw GEE plot: " + plotID);
            }
        })
    })
}


/************************************************************************
*                       ADMIN SETTINGS
*************************************************************************/

let initAdminSettings = function() {
    initAllCountries();
}

let allCountries = {};
let initAllCountries = function() {
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
                allCountries[name] = {"name": name, "geometry": geometry};
            }
            initCountryList();
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

///// add new country /////

const newCountryData = {
    "geoJSON": null,
    "precip": null,
    "soil": null
};


let readFile = function(file, type) {
    const reader = new FileReader();
    reader.onload = (e) => newCountryData[type] = e.target.result;
    reader.readAsText(file);
}


let addCountry = function() {
    // TODO validate the content of each field
    let data = {
        country: $("#new-country-select").val(),
        geoJSON: newCountryData["geoJSON"],
        precip: newCountryData["precip"],
        soil: newCountryData["soil"],
        isDefault: $("#default-check").is(":checked")
    }

    $.ajax({
        type: "POST",
        url: URL_country,
        data: JSON.stringify(data),
        dataType: "json",
        success: function(_response) {
            $("#submit-btn").prop("disabled", false);
            $("#submit-btn").find(".spinner-border").addClass("d-none");
            showCountryList();
        },
        error: function(error) {
            console.log(error);
        }
    })
}


// submit form
$("#submit-btn").on("click", function() {
    $(this).prop("disabled", true);
    $(this).find(".spinner-border").removeClass("d-none");
    addCountry();
})

// disable "reload site" warning
window.onbeforeunload = null;

///// remove country /////

let removeCountry = function() {
    $.ajax({
        type: "DELETE",
        url: URL_country,
        data: JSON.stringify({country: countryToRemove}),
        dataType: "json",
        success: function(success) {
            console.log(success)
            showCountryList();
        },
        error: function(error) {
            console.log(error);
        },
    })
}

///// Get all countries /////

// Dispaly all existing countries in the country list
let existingCountries, countryToRemove;
let initCountryList = function() {

    let zoomInTo = function(countryGeoJSON) {
        selectedCountry.clearLayers();
        selectedCountry.addData(countryGeoJSON);
        mapObj.fitBounds(selectedCountry.getBounds());
    }


    $.ajax({
        type: "GET",
        url: URL_country,
        success: function(response) {
            existingCountries = JSON.parse(response["data"]);
            // add existing countries to the country list
            $("#country-list-ul").empty(); 
            $("#country-selector").empty()
            for (let country in existingCountries) {
                let isDefault = existingCountries[country]["default"];
                let newListItem = $(
                    `<li class="list-group-item" id="${country}-li">
                    <div class="row option-div">
                      <div class="col-md-6">${country}</div>
                      <div class="col-md-4 default-btn">
                        <input type="radio" id="${country}-radio" name="default-country" value="${country}" ${isDefault ? "checked": ""}>
                        <label for="${country}-radio">Default</label>
                      </div>
                      <div class="col-md-2">
                        <button class="remove-btn"><span>&times;</span></button>
                      </div>
                    </div>
                  </li>`
                )
                $("#country-list-ul").append(newListItem);

                // show conformation modal once the remove button is clicked
                newListItem.find(".remove-btn").on("click", function() {
                    countryToRemove = country;
                    $("#remove-confirmation-message").html(`Are you sure you want to remove ${country}?`);
                    $("#remove-confirmation-modal").modal("show");
                    $("#admin-modal").modal("hide");
                })

                // put existing countries in the country selector
                $("#country-selector").append($("<option>", {
                    value: country,
                    text: country,
                    selected: isDefault ? true : false
                }));

                // update default country in the database
                newListItem.find("input[type='radio']").on("click", function() {
                    $.ajax({
                        type: "POST",
                        url: URL_updateDefaultCountry,
                        data: JSON.stringify({"country": country}),
                        success: function(success) {
                            console.log(success);
                            zoomInTo(allCountries[country].geometry);
                        },
                        error: function(error) {
                            console.log(error);
                        }
                    })
                })

                // zoom in to the default country when loading the website
                if (isDefault) {
                    if (selectedCountry) {
                        selectedCountry.clearLayers();
                    } else {
                        selectedCountry = L.geoJSON([], {
                            style: {opacity: 0, fillOpacity: 0}
                        }).addTo(mapObj);
                    }
                    selectedCountry.addData(allCountries[country].geometry);
                }

                $("#country-selector").on("change", function() {
                    zoomInTo(allCountries[$(this).val()].geometry);
                })
            }

            $("#country-list-ul").append($(
                `<li class="list-group-item">
                <div class="row option-div">
                  <div class="col-md-10">Add New Country</div>
                  <div class="col-md-2">
                    <button id="add-country-btn" onclick="showAddCountryForm()"><span>+</span></button>
                  </div>
                </div>
              </li>`
            ))

            // add non-existent countries to the country searchable select
            for (country in allCountries) {
                if (!(country in existingCountries)) {
                    $("#new-country-select").append($("<option>", {
                        value: country,
                        text: country
                    }))
                }
            }
        },
        error: function(error) {
            console.log(error);
        }
    })
};


// switch between "country list" row and "add new country" row

let showCountryList = function() {
    $("#remove-confirmation-modal").hide();
    $("#admin-modal").show();    
    initCountryList(); // refresh the country list
    $("#country-list-div").css("display", "flex");
    $("#add-country-form").css("display", "none");
    
}

let showAddCountryForm = function() {
    $("#remove-confirmation-modal").hide();
    $("#admin-modal").show();
    initCountryList();
    $("#country-list-div").css("display", "none");
    $("#add-country-form").css("display", "flex");
}
