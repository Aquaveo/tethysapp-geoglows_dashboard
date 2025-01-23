/************************************************************************
*                        Elements & Constants
*************************************************************************/

///// Elements /////

const $yearMonthPicker = $("#year-month-picker");
const $countrySelect = $("#country-select");
const $countryListUl = $("#country-list-ul");

///// Constants /////

// map settings
const MIN_QUERY_ZOOM = 15;
const COLOR_BLUE = "#3388ff";
const COLOR_ORANGE = "#ff7800"

// map layers
const HYDROSOS_STREAMFLOW_LAYER_NAME = "HydroSOS Streamflow";
const GEOGLOWS_STREAMFLOW_LAYER_NAME = "Geoglows Streamflow";
const NILE_SUBBASIN_LAYER_NAME = "Nile Subbasins";

const MAP_LAYERS = {
    [GEOGLOWS_STREAMFLOW_LAYER_NAME]: null,
    [HYDROSOS_STREAMFLOW_LAYER_NAME]: null,
    [NILE_SUBBASIN_LAYER_NAME]: null,
}

// region
const REGION_NILE_BASIN = "Nile Basin";
const REGION_CENTRAL_AMERICA = "Central America";

let region = $('#region-data').data('region').toLowerCase();
if (region.includes('america')) {
    region = REGION_CENTRAL_AMERICA;
} else {
    region = REGION_NILE_BASIN;
}

// countries

const ALL_COUNTRIES_OPTION_VALUE = "All Countries";
const SELECT_A_COUNTRY_OPTION_VALUE = "";


/************************************************************************
*                             LOAD THE APP
*************************************************************************/

$(async function() {
    initPlotCards();
    initMapCardHeader();
    await initMapCardBody();
    initAdminSettings();
})

/************************************************************************
*                       INITIALIZE MAP CARD HEADER
*************************************************************************/

let updateSelectedRiverByID = function(reachID, isSubbasinOutlet=false) {
    $('#reach-id-input').val(reachID);
    findLatLonByReachID(reachID, isSubbasinOutlet)
        .then(initSelectedPlots)
        .catch(error => {
            alert(error);
            showPlotContainerMessages();
        })
}


let selectedYearMonth = $yearMonthPicker.val();
let initMapCardHeader = function() {
    let initStreamSearchBox = function() {
        $('#search-addon').click(function() {
            updateSelectedRiverByID($('#reach-id-input').val(), isSubbasinOutlet=false)
        });
        $('#reach-id-input').keydown(event => {
            if (event.keyCode === 13) {
                updateSelectedRiverByID($('#reach-id-input').val(), isSubbasinOutlet=false);
            }
        })
    }
    
    let initYearMonthPicker = function() {
        $yearMonthPicker.datepicker({
            minViewMode: 1,
            format: 'yyyy-mm-01',
            startDate: '1940-01',
            endDate: '2022-12'
        });
    
        $yearMonthPicker.on('changeDate', function() {
            $(this).datepicker('hide');
            let date = $(this).val();
            if (date != selectedYearMonth) {
                updateHydroSOSStreamflowLayer(date, $countrySelect.val());
                selectedYearMonth = date;
            }
        }) 
    }

    initStreamSearchBox();
    initYearMonthPicker();
}


let updateYearMonthPicker = function() {
    if (selectedYearMonth > plotsData.endDate) {  // TODO check if this is possible
        $yearMonthPicker.datepicker('update', plotsData.endDate);
    } else {
        $yearMonthPicker.datepicker('setStartDate', plotsData.startDate);
        $yearMonthPicker.datepicker('setEndDate', plotsData.endDate);
    }
}


/************************************************************************
*                       INITIALIZE MAP CARD BODY
*************************************************************************/

const startDateTime = new Date(new Date().setUTCHours(0, 0, 0, 0));
const endDateTime = new Date(startDateTime);
endDateTime.setDate(endDateTime.getDate() + 5);
let mapObj, resetButton, mapMarker;
MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME] = L.esri.dynamicMapLayer({
    url: "https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer",
    layers: [0],
    layerDefs: {0: "vpu = 122"},
    from: startDateTime,
    to: endDateTime,
    opacity: 0.7
});
let refreshGeoglowsStreamflowLayer = function() {
    let sliderTime = new Date(mapObj.timeDimension.getCurrentTime());
    MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME].setTimeRange(sliderTime, endDateTime);
}
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

// map layers
let $layerControl;
let geoglowsLegend, hydroSOSLegend;
let selectedCountry = {name: null, subbasinsLayer: null, hydrostationsLayer: null};
let selectedReachID, selectedStream, selectedCountryLayer, selectedStreamflowLayer,
    selectedNileSubbasinLayer, selectedSubbasinLayer, selectedStationLayer;

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

let layerIsInLayerControl = function(layerControl, layer) {
    for (let i of layerControl._layers) {
        if (i.layer === layer) {
            return true;
        }
    }
    return false;
}

let addLayerToMapAndLayerControl = function(layer, name, showLayer=true) {
    if (!layerIsInLayerControl($layerControl, layer)) {
        if (showLayer) {
            layer.addTo(mapObj);
            mapObj.fitBounds(layer.getBounds());
        }
        $layerControl.addOverlay(layer, name);
    }
}

let removeLayerFromMapAndLayerControl = function(layer) {
    if (layer) {
        mapObj.removeLayer(layer);
        $layerControl.removeLayer(layer);   
    }
}

let addGeoJSONLayerFomFile = function(layerName, dataJSON, showLayer=true, options) {
    layer = MAP_LAYERS[layerName]; 
    if (!layer) {
        MAP_LAYERS[layerName] = L.geoJSON(dataJSON, options);
    }
    addLayerToMapAndLayerControl(MAP_LAYERS[layerName], layerName, showLayer);
    return MAP_LAYERS[layerName];
}

let addSubbasinLayer = function(layerName, dataJSON) {
    function onEachFeature(feature, layer) {
        let riverID = feature.properties['LINKNO'];
        layer.on('click', function() {
            if (selectedSubbasinLayer) { // clear the old selected layer
                selectedSubbasinLayer.setStyle({'fillOpacity': 0}); 
            }
            layer.setStyle({'fillOpacity': 0.1});
            selectedSubbasinLayer = layer;
            updateSelectedRiverByID(riverID, isSubbasinOutlet=true);
        })
    };

    style = {
        "color": COLOR_BLUE,
        "weight": 2,
        "opacity": 1,
        "fillColor": COLOR_BLUE,
        "fillOpacity": 0
    };

    return addGeoJSONLayerFomFile(
        layerName=layerName,
        data=dataJSON,
        showLayer=true,
        options={style: style, onEachFeature: onEachFeature}
    );
}

let addHydroStationLayer = function(layerName, dataJSON) {
    function onEachFeature(feature, layer) {
        let riverID = feature.properties['LINKNO'];
        let popupContent = `
            <table class="popup-table">
                <tr><td><b>Water Body</b></td><td>${feature.properties['Water Body']}</td></tr>
                <tr><td><b>Sub Region</b></td><td>${feature.properties['Sub-Region']}</td></tr>
            </table>
            <div style="text-align: center; margin-top: 5px">
                <button type="button" class="btn btn-primary btn-sm popup-btn" id="popup-btn-${feature.properties.NAT_ID}">Show Plot</button>
            </div>
        `;
        layer.bindPopup(popupContent);
        layer.on('click', function() {
            if (selectedStationLayer) {
                selectedStationLayer.setStyle({'fillColor': COLOR_BLUE});
            }
            layer.setStyle({'fillColor': COLOR_ORANGE});
            selectedStationLayer = layer;
        });
        layer.on('popupopen', function() {
            const $button = $(`#popup-btn-${feature.properties.NAT_ID}`);
            if ($button) {
                $button.on('click', function() {
                    updateSelectedRiverByID(riverID, isSubbasinOutlet=true);
                })
            }
        });
    };

    return addGeoJSONLayerFomFile(
        layerName=layerName,
        filePath=dataJSON,
        showLayer=true,
        options={
            style: {
                radius: 6,
                fillColor: COLOR_BLUE,
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            },
            onEachFeature: onEachFeature,
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, style);
            }
        }
    );
}

let addNileSubbasinLayer = function() {
    function onEachFeature(feature, layer) {
        let riverID = feature.properties['River ID'];
        layer.bindPopup('<b>Name:</b> ' + feature.properties.Name);
        layer.on('click', function() {
            if (selectedNileSubbasinLayer) {
                selectedNileSubbasinLayer.setStyle({'fillOpacity': 0});
            }
            layer.setStyle({'fillOpacity': 0.1});
            selectedNileSubbasinLayer = layer;
            updateSelectedRiverByID(riverID, isSubbasinOutlet=true);
        })
    }

    let filePath = "/static/geoglows_dashboard/data/geojson/nile_sub_basins.geojson";
    fetch(filePath)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`${filePath} was not ok`);
            }
            return response.json();
        })
        .then((data) => {
            addGeoJSONLayerFomFile(
                layerName=NILE_SUBBASIN_LAYER_NAME,
                data=data,
                showLayer=false,
                options={
                    style: {
                        "color": COLOR_BLUE,
                        "weight": 2,
                        "opacity": 1,
                        "fillColor": COLOR_BLUE,
                        "fillOpacity": 0
                    },
                    onEachFeature: onEachFeature
                }
            )
        })

}

let addMapLayers = async function() {
    await updateHydroSOSStreamflowLayer($("#year-month-picker").val(), $countrySelect.val());
    $layerControl = L.control.layers(
        basemaps,
        {"Geoglows Streamflow": MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME], "HydroSOS Streamflow": MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME]},
        {collapsed: true, position: 'topleft'}
    ).addTo(mapObj);
    const webMapId = "a69f14ea2e784e019f4a4b6835ffd376";
    const webMapUrl = `https://www.arcgis.com/sharing/rest/content/items/${webMapId}/data?f=json`;
    fetch(webMapUrl)
      .then(response => response.json())
      .then(data => {
        let layerGroup = [];
        data.baseMap.baseMapLayers.forEach((basemap) => {
            let layer;
            if (basemap.layerType === 'ArcGISTiledMapServiceLayer') {
                layer = L.esri.tiledMapLayer({url: basemap.url, opacity: basemap.opacity || 1,})
            } else if (basemap.layerType === 'VectorTileLayer') {
                layer = L.esri.Vector.vectorTileLayer(basemap.itemId, {opacity: basemap.opacity || 1})
            }
            layerGroup.push(layer);
        })
        let environmentMap = L.layerGroup(layerGroup).addTo(mapObj);
        $layerControl.addBaseLayer(environmentMap, "ESRI Environment");
      })
      .catch(error => {
        console.error("Error loading Web Map:", error);
      });

    MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME].addTo(mapObj);
    if (region == REGION_NILE_BASIN) {
        addNileSubbasinLayer();
    }
}

let getSelectedArea = function() {
    let area;
    if (selectedCountryLayer && selectedCountryLayer.getLayers().length != 0) {
        area = selectedCountryLayer.toGeoJSON();
    } else if(mapObj.hasLayer(MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME])) {
        area = MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME].toGeoJSON();
    }
    return area;
}

let isPointInSelectedArea = function(point) {
    let area = getSelectedArea();
    if (!area) return true;

    let inside = false;
    area.features.forEach(function(feature) {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            if (turf.booleanPointInPolygon(point, feature.geometry)) {
                inside = true;
            }
        }
    })
    return inside;
}

let initMapCardBody = async function() {
    // init map object
    mapObj = L.map('leaflet-map', {
        zoom: 3,
        center: [0, 0],
        fullscreenControl: true,
        timeDimension: true
    });
    initHydroSOSLegend();
    initGeoglowsStreamflowLegend();

    mapObj.on("overlayadd", function(e) {
        // make geoglows and hydrosos streamflow mutually exclusive
        if (e.layer == MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME]) {
            if (selectedStreamflowLayer == MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME]) {
                removeWithTimeout(selectedStreamflowLayer);
            }
            $('#year-month-picker-div').css('display', 'none');
            geoglowsLegend.addTo(mapObj);
            selectedStreamflowLayer = MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME];
        } else if (e.layer == MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME]) {
            if (selectedStreamflowLayer == MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME]) {
                removeWithTimeout(selectedStreamflowLayer);
                // TODO also remove the time slider
            }
            $('#year-month-picker-div').css('display', 'flex')
            hydroSOSLegend.addTo(mapObj);
            selectedStreamflowLayer = MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME];
        } else if (e.layer == MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME]) {
            selectedCountryLayer.clearLayers();
            mapObj.fitBounds(MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME].getBounds());
            MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME].setLayerDefs({0: 'vpu = 122'});
            $countrySelect.val(SELECT_A_COUNTRY_OPTION_VALUE);
            removeLayerFromMapAndLayerControl(selectedCountry.subbasinsLayer);
            removeLayerFromMapAndLayerControl(selectedCountry.hydrostationsLayer);
        }
    })

    mapObj.on("overlayremove", function(e) {
        if (e.layer == MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME]) {
            geoglowsLegend.remove();
        } else if (e.layer == MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME]) {
            hydroSOSLegend.remove();
            $('#year-month-picker-div').css('display', 'none')
        }
        if (selectedStreamflowLayer == e.layer) {
            selectedStreamflowLayer = null;
        }
    })

    mapObj.on('click', function(event) {
        let point = turf.point([event.latlng.lng, event.latlng.lat]);
        // If subbasinsLayer is on, don't find the river id 
        if (isPointInSelectedArea(point) && (!selectedCountry.subbasinsLayer || !mapObj.hasLayer(selectedCountry.subbasinsLayer))) {
            let zoom = mapObj.getZoom();
            if (zoom < MIN_QUERY_ZOOM) {
                mapObj.setView(event.latlng, MIN_QUERY_ZOOM);
            } else {
                if (mapMarker) {
                    mapObj.removeLayer(mapMarker);
                }
                mapMarker = L.marker(event.latlng).addTo(mapObj);
                mapObj.flyTo(event.latlng, MIN_QUERY_ZOOM);
                findReachIDByLatLng(event.latlng.lat, event.latlng.lng)
                    .then(initSelectedPlots)
                    .catch(error => {
                        alert(error);
                        mapObj.removeLayer(mapMarker);
                        showPlotContainerMessages();
                    })
            }    
        } 
    })

    // update the HydroSOS Streamflow layer every time zooming in/out
    mapObj.on("zoomend", function() {
        let date = $yearMonthPicker.val();
        let newMinStreamOrder = getMinStreamOrder();
        let isVPU = MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME] && mapObj.hasLayer(MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME]);
        let country = $countrySelect.val();
        let vparams = `selected_month:${date};min_stream_order:${getMinStreamOrder()};is_vpu:${isVPU};country:${country}`;
        if (newMinStreamOrder != minStreamOrder) {
            minStreamOrder = newMinStreamOrder;
            MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME].setParams({viewparams: vparams});
        }
    })

    selectedStream = L.geoJSON(false, {weight: 5, color: COLOR_BLUE}).addTo(mapObj);

    if (resetButton == null) {
        resetButton = L.easyButton('fa-home', function(){
            mapObj.setView([0, 0], 3);
        }, 'Reset Map');
        resetButton.addTo(mapObj);
    }

    // init time control
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

    // init map layers
    await addMapLayers();
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

let getMinStreamOrder = function() {
    let zoom = mapObj.getZoom();
    if (zoom <= 2) {
        return 8;
    }
    if (zoom >= 15) {
        return 2;
    }
    return 7 - Math.floor((zoom - 3) / 2);
}

let minStreamOrder;
let updateHydroSOSStreamflowLayer = async function(date, country) {
    let isVPU = country == ALL_COUNTRIES_OPTION_VALUE ? 'True' : 'False';
    let countryValue = isVPU === 'True' ? '' : country;
    let vparams = `selected_month:${date};min_stream_order:${getMinStreamOrder()};is_vpu:${isVPU};country:${countryValue}`;

    if (!MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME]) {
        try {
            await getGeoserverEndpoint();
            MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME] = L.tileLayer.wms(`${geoserverEndpoint}/geoglows_dashboard/wms`, {
                layers: 'geoglows_dashboard:hydrosos_streamflow_layer',
                format: 'image/png',
                transparent: true,
                viewparams: vparams
            });
        } catch(error) {
            console.error("Error occurred while fetching Geoserver endpoint:", error);
        }
    } else {
        MAP_LAYERS[HYDROSOS_STREAMFLOW_LAYER_NAME].setParams({viewparams: vparams});
    }
}

let removeWithTimeout = function(layer) {
    setTimeout(() => mapObj.removeLayer(layer), 10);
}

let hasReachId = function() {
    return selectedReachID != null;
}


/************************************************************************
*                       INITIALIZE PLOT CARDS
*************************************************************************/


let yearPickerValues = [$(".year-picker:eq(0)").val(), $(".year-picker:eq(1)").val()];
let monthPickerValues = [$(".month-picker:eq(0)").val(), $(".month-picker:eq(1)").val()];
let initPlotCards = function() {
    let initPlotSelects = function(plotCard) {
        let plotSelect = $(plotCard).find(".plot-select");
        let plotID = $(plotSelect).val();
        if (plotsData.plots[plotID].needYear) {
            $(plotCard).find('.year-picker-div').removeClass('d-none').addClass('d-flex');
        } else {
            $(plotCard).find('.year-picker-div').addClass('d-none');
        }
        if (plotsData.plots[plotID].needMonth) {
            $(plotCard).find('.month-picker-div').removeClass('d-none').addClass('d-flex');
        } else {
            $(plotCard).find('.month-picker-div').addClass('d-none');
        }
    }

    //////////// init plot-select /////////
    // add options to the plot-select
    $(".plot-select").each(function(tabIndex) {
        $(this).empty();
        let plots = plotsData.plots;
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
        initPlotSelects(card);

        // update the plot once the year/month changes
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
    })

    //////////// init the plot div ////////////
    if (!hasReachId()) {
        showPlotContainerMessages();
    } else {
        initSelectedPlots();
    }

    // load the plot & add selectors when the selected plotID changes
    $(".plot-card").each(function(_index, card) {
        let plotSelect = $(card).find(".plot-select");
        plotSelect.on("change", function() {
            initPlotSelects(card);
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
    let $plotSelect = $(plotCard).find(".plot-select");
    let $plotDiv = $(plotCard).find(".plot-div");
    let $spinner =  $(plotCard).find(".spinner");

    let plotID = $plotSelect.val();
    let selectedYear = Number($(plotCard).find(".year-picker").val());
    let selectedMonth = monthToNumber[$(plotCard).find(".month-picker").val()];

    if (isNewArea) { // new area
        showSpinner($plotDiv, $spinner);
        requestPlotData(plotID, selectedReachID, selectedYear, selectedMonth).then(function(data) {
            plotsData.plots[plotID].data = data;
            drawPlot(plotCard);
        })
    } else if (isNewYear) { // new year
        let needYear =  plotsData.plots[plotID].needYear;
        let oldYear = plotsData.plots[plotID].selectedYear;
        if (needYear && oldYear != selectedYear && hasReachId()) {
            plotsData.plots[plotID].selectedYear = selectedYear;
            showSpinner($plotDiv, $spinner);
            requestPlotData(plotID, selectedReachID, selectedYear, selectedMonth).then(function(data) {
                plotsData.plots[plotID].data = data;
                drawPlot(plotCard);
            })
        }
    } else if (isNewMonth) {  // new month
        let needMonth = plotsData.plots[plotID].needMonth;
        let oldMonth = plotsData.plots[plotID].selectedMonth;
        if (needMonth && oldMonth != selectedMonth && hasReachId()) {
            plotsData.plots[plotID].selectedMonth = selectedMonth;
            showSpinner($plotDiv, $spinner);
            requestPlotData(plotID, selectedReachID, selectedYear, selectedMonth).then(function(data) {
                plotsData.plots[plotID].data = data;
                drawPlot(plotCard);
            })
        }
    } else { // new plot selection
        let plotData = plotsData.plots[plotID].data;
        if (plotData != null) {
            drawPlot(plotCard);
        } else if (hasReachId()) {
            showSpinner($plotDiv, $spinner);
            requestPlotData(plotID, selectedReachID, selectedYear, selectedMonth).then(function(data) {
                plotsData.plots[plotID].data = data;
                drawPlot(plotCard);
            })
        }
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
    let plotData = plotsData.plots[plotSelect.val()].data;
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
        $(card).find(".plot-div").html("Please select a stream");
    })
}


/////////////////// Requesting Plot Data ///////////////////


let findLatLonByReachID = function(reachID, isSubbasinOutlet=false) {
    showSpinners();
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

let findReachIDByLatLng = function(lat, lng) {
    return new Promise(function(resolve, reject) {
        L.esri.identifyFeatures({
            url: "https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer"
        })
        .on(mapObj)
        .at([lat, lng])
        .run(function(error, featureCollection) {
            const ERROR_RIVER_NOT_FOUND = "River not found. Try to zoom in and be precise when clicking the stream";
            if (error || featureCollection.features.length === 0) {
                reject(error || ERROR_RIVER_NOT_FOUND);
                return;
            }

            let feature = featureCollection.features[0];
            selectedReachID = feature.properties["TDX Hydro Link Number"];
            $('#reach-id-input').val(selectedReachID);
            selectedStream.clearLayers();
            selectedStream.addData(feature.geometry);

            resolve("Find river_id " + selectedReachID);
        })
    })
}


/************************************************************************
*                       ADMIN SETTINGS
*************************************************************************/

let allCountries, existingCountries, countryToRemove;

let initAdminSettings = function() {
    initAllCountries();
}

allCountries = {};
let initAllCountries = function() {
    filename = 'nb_countries.geojson';
    if (region === REGION_CENTRAL_AMERICA) {
        filename = 'central_america_countries.geojson'
    }
    fetch(`/static/geoglows_dashboard/data/geojson/${filename}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error("countries.geojson was not ok");
            }
            return response.json();
        })
        .then((data) => {
            data = JSON.parse(JSON.stringify(data));
            allCountries[ALL_COUNTRIES_OPTION_VALUE] = data.features;
            for (let feature of data.features) {
                let name = feature.properties.Name_label;
                if (name) {
                    allCountries[name] = feature;
                }
            }
            initCountryList();
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

///// Get all countries /////

// Dispaly all existing countries in the country list
let initCountryList = function() {
    $.ajax({
        type: "GET",
        url: URL_country + L.Util.getParamString({region: region}),
        success: function(response) {
            existingCountries = JSON.parse(response["data"]);
            // add existing countries to the country-list and country-select
            $countryListUl.empty(); 
            $countrySelect.empty();
            $countrySelect.append(new Option("-- Select a Country --", SELECT_A_COUNTRY_OPTION_VALUE));

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
                $countryListUl.append(newListItem);

                // show conformation modal once the remove button is clicked
                newListItem.find(".remove-btn").on("click", function() {
                    countryToRemove = country;
                    $("#remove-confirmation-message").html(`Are you sure you want to remove ${country}?`);
                    $("#remove-confirmation-modal").modal("show");
                    $("#admin-modal").modal("hide");
                })

                // put existing countries in the country selector
                $countrySelect.append($("<option>", {
                    value: country,
                    text: country,
                    selected: isDefault ? true : false
                }));

                // update default country in the database when default radio button is clicked
                newListItem.find("input[type='radio']").on("click", function() {
                    $.ajax({
                        type: "POST",
                        url: URL_updateDefaultCountry,
                        data: JSON.stringify({"country": country}),
                        success: function(success) {
                            console.log(success);
                            zoomInToCountry(country);
                        },
                        error: function(error) {
                            console.log(error);
                        }
                    })
                })

                if (isDefault) {
                    zoomInToCountry(country);
                }
            }
            
            $countryListUl.append($(
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
            $("#new-country-select").empty();
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

$countrySelect.on("change", function() {
    zoomInToCountry($(this).val());
});

// Zoom into the selectedCountry
let zoomInToCountry = function(country) {
    if (!country) return;
    if (country == ALL_COUNTRIES_OPTION_VALUE) {
        countryGeoJSON = allCountries[country];
    } else {
        countryGeoJSON = allCountries[country].geometry;
    }

    if (!selectedCountryLayer) {
        selectedCountryLayer = L.geoJSON([], {
            style: {opacity: 1, fillOpacity: 0}
        }).addTo(mapObj);
    }
    selectedCountryLayer.clearLayers();
    selectedCountryLayer.addData(countryGeoJSON);
    mapObj.fitBounds(selectedCountryLayer.getBounds())

    // clear NileSubbasin layer
    if (MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME]) {
        mapObj.removeLayer(MAP_LAYERS[NILE_SUBBASIN_LAYER_NAME]);
    }

    // update streamflow layers
    MAP_LAYERS[GEOGLOWS_STREAMFLOW_LAYER_NAME].setLayerDefs(country == ALL_COUNTRIES_OPTION_VALUE ? null : {0: `rivercountry = '${country}'`});
    updateHydroSOSStreamflowLayer($("#year-month-picker").val(), country);

    // remove old layers
    removeLayerFromMapAndLayerControl(selectedCountry.subbasinsLayer);
    removeLayerFromMapAndLayerControl(selectedCountry.hydrostationsLayer);
    // add new layers
    let subbasinsData = existingCountries[country]["subbasinsData"];
    let hydrostationsData = existingCountries[country]["hydrostationsData"];
    let newSubbasinsLayer, newHydrostationsLayer;
    if (subbasinsData) {
        newSubbasinsLayer = addSubbasinLayer(`${country} Subbasins`, JSON.parse(subbasinsData));
    }
    if (hydrostationsData) {
        newHydrostationsLayer = addHydroStationLayer(`${country} Hydrostations`, JSON.parse(hydrostationsData));
    }
    //update selectedCountry
    selectedCountry.name = country;
    selectedCountry.subbasinsLayer = newSubbasinsLayer;
    selectedCountry.hydrostationsLayer = newHydrostationsLayer;
}


// switch between "country list" row and "add new country" row

let showCountryList = function() {
    $("#remove-confirmation-modal").modal('hide');
    $("#admin-modal").modal('show');    
    initCountryList(); // refresh the country list
    $("#country-list-div").css("display", "flex");
    $("#add-country-form").css("display", "none");
}

let showAddCountryForm = function() {
    $("#remove-confirmation-modal").modal('hide');
    $("#admin-modal").modal('show');
    initCountryList();
    $("#country-list-div").css("display", "none");
    $("#add-country-form").css("display", "flex");
}

///// add new country /////

let addCountry = function(subbasinsData, hydrostationsData) {
    let data = {
        country: $("#new-country-select").val(),
        region: region,
        isDefault: $("#default-check").is(":checked"),
        subbasinsData: subbasinsData,
        hydrostationsData: hydrostationsData
    };
    console.log("country data size: ", new Blob([JSON.stringify(data)]).size); // Size in bytes

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

let readFile = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};


$("#submit-btn").on("click", async function() {
    $(this).prop("disabled", true);
    $(this).find(".spinner-border").removeClass("d-none");
    let subbasinFile = $('#subbasins-file-input')[0].files[0];
    let hydrostationFile =  $('#hydrostations-file-input')[0].files[0];
    let subbasinsData, hydrostationsData;
    if (subbasinFile) {
        subbasinsData = await readFile(subbasinFile);
    }
    if (hydrostationFile) {
        hydrostationsData = await readFile(hydrostationFile);
    }
    // TODO check file size before send it to the backend
    addCountry(subbasinsData, hydrostationsData);
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
