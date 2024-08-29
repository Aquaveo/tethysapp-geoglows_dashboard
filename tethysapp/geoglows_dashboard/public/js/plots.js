let requestPlotData = function(plotID, reachID, year, month) {
    console.log("sending a request for " + plotID + " plot");
    switch (plotID) {
        case forecastPlotID:
            return getForecastPlot(reachID);
        case historicalPlotID:
        case flowDurationPlotID:
            return getHistoricalRelatedPlot(plotID, year, reachID);
        case flowRegimePlotID:
            if (plotsData.plots[plotID].data == null) {
                return getHistoricalRelatedPlot(plotID, year, reachID);
            }
            return updateFlowRegimePlot(year, reachID);
        case annualDischargePlotID:
            return getAnnualDischargePlot(reachID);
        case SSIMonthlyPlotID:
            return getSSIPlot(reachID, -1);
        case SSIOneMonthPlotID:
            return getSSIPlot(reachID, month);
    }
}

let getForecastPlot = function(reachID) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getForecastPlot + L.Util.getParamString({
                reach_id: reachID
            }),
            success: function(response) {
                resolve(response["forecast"]);
            },
            error: function() {
                reject("fail to get forecast data");
            }
        })
    })
}

let getHistoricalRelatedPlot = function(plotID, year, reachID) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            async: true,
            url: URL_getHistoricalPlot + L.Util.getParamString({
                reach_id: reachID,
                selected_year: year
            }),
            success: function(response) {
                resolve(response[plotID.replace(/-/g, "_")]);
            },
            error: function() {
                reject("fail to get historical data")
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
                resolve(response["flow_regime"]);
            },
            error: function() {
                reject("fail to draw new flow regime plot");
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
                resolve(response["plot"]);
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
                resolve(response["plot"]);
            },
            error: function() {
                reject(`fail to get ${plotID}!`)
            }
        })
    })
}