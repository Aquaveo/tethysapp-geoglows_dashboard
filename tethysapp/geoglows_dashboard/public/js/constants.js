const forecastPlotID = "forecast", 
        historicalPlotID = "historical", 
        flowDurationPlotID = "flow-duration",
        flowRegimePlotID = "flow-regime",
        annualDischargePlotID = "annual-discharge",
        SSIMonthlyPlotID = "ssi-monthly",
        SSIOneMonthPlotID = "ssi-one-month";

const plotsData = {
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
};