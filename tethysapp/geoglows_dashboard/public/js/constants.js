const forecastPlotID = "forecast", 
        historicalPlotID = "historical", 
        flowDurationPlotID = "flow-duration",
        flowRegimePlotID = "flow-regime",
        annualDischargePlotID = "annual-discharge",
        SSIMonthlyPlotID = "ssi-monthly",
        SSIOneMonthPlotID = "ssi-one-month";

const plotsData = {
    "startDate": "2000-01",
    "endDate": "2024-12",
    "plots": {
        [forecastPlotID]: {
            "name": "Forecast",
            "data": null,
            "needYear": false,
            "needMonth": false,
        },
        [historicalPlotID]: {
            "name": "Historical",
            "data": null,
            "needYear": false,
            "needMonth": false,
        },
        [flowDurationPlotID]: {
            "name": "Flow Duration",
            "data": null,
            "needYear": false,
            "needMonth": false,
        },
        [flowRegimePlotID]: {
            "name": "Flow Regime",
            "data": null,
            "needYear": true,
            "selectedYear": null,
            "needMonth": false,
        },
        [annualDischargePlotID]: {
            "name": "Annual Discharge",
            "data": null,
            "needYear": false,
            "needMonth": false,
        },
        [SSIMonthlyPlotID]: {
            "name": "SSI Monthly",
            "data": null,
            "needYear": false,
            "needMonth": false,
        },
        [SSIOneMonthPlotID]: {
            "name": "SSI One Month",
            "data": null,
            "needYear": false,
            "needMonth": true,
            "selectedMonth": null,
        }
    }
};