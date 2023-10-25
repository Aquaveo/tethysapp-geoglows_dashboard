from django.shortcuts import render
from django.http import JsonResponse
from tethys_sdk.routing import controller
from tethys_sdk.gizmos import Button
import geoglows.streamflow as gsf
import geoglows.plots as gpp
from plotly.offline import plot as offline_plot
import requests
import pandas as pd
import json

from .analysis.flow_regime import flow_regime
from .analysis.gee.average_precip_soil import AveragePrecipitationAndSoilMoisture
from .analysis.gee.gldas_precip_soil import GLDASSoilMoistureAndPrecipitation
from .analysis.gee.imerg_precip import IMERGPrecipitation
from .analysis.gee.era5_precipitation import ERA5Precipitation


test_folder_path = "tethysapp/geoglows_dashboard/public/data/test/"
cache_folder_path = "tethysapp/geoglows_dashboard/public/data/cache/"


@controller
def home(request):
    """
    Controller for the app home page.
    """
    save_button = Button(
        display_text='',
        name='save-button',
        icon='save',
        style='success',
        attributes={
            'data-bs-toggle':'tooltip',
            'data-bs-placement':'top',
            'title':'Save'
        }
    )

    edit_button = Button(
        display_text='',
        name='edit-button',
        icon='pen',
        style='warning',
        attributes={
            'data-bs-toggle':'tooltip',
            'data-bs-placement':'top',
            'title':'Edit'
        }
    )

    remove_button = Button(
        display_text='',
        name='remove-button',
        icon='trash',
        style='danger',
        attributes={
            'data-bs-toggle':'tooltip',
            'data-bs-placement':'top',
            'title':'Remove'
        }
    )

    previous_button = Button(
        display_text='Previous',
        name='previous-button',
        attributes={
            'data-bs-toggle':'tooltip',
            'data-bs-placement':'top',
            'title':'Previous'
        }
    )

    next_button = Button(
        display_text='Next',
        name='next-button',
        attributes={
            'data-bs-toggle':'tooltip',
            'data-bs-placement':'top',
            'title':'Next'
        }
    )

    context = {
        'save_button': save_button,
        'edit_button': edit_button,
        'remove_button': remove_button,
        'previous_button': previous_button,
        'next_button': next_button
    }

    return render(request, 'geoglows_dashboard/home.html', context)


@controller(url='findReachID')
def find_reach_id(request):
    # breakpoint()
    reach_id = request.GET['reach_id']
    lat, lon = gsf.reach_to_latlon(int(reach_id))
    return JsonResponse({'lat': lat, 'lon': lon})


@controller(name='getAvailableDates', url='getAvailableDates')
def get_available_dates(request):
    reach_id = request.GET['reach_id']
    is_test = request.GET['is_test'] == 'true'
    if is_test:
        dates = json.load(open(test_folder_path + "dates.json"))
    else:
        s = requests.Session()
        dates = gsf.available_dates(reach_id, s=s)
        s.close()
        
    # cache the data
    with open(cache_folder_path + "dates.json", "w") as file: 
        json.dump(dates, file)
        
    return JsonResponse(dict(
        dates=list(map(lambda x: x.split(".")[0], dates["available_dates"])),
    ))
    
    
@controller(name='getForecastData', url='getForecastData')
def get_forecast_data(request):
    s = requests.Session()
    reach_id = request.GET['reach_id']
    start_date = request.GET['start_date']
    end_date = request.GET['end_date']
    is_test = (request.GET['is_test'] == 'true')
    
    files = {"records": None, "stats": None, "ensembles": None, "rperiods": None}
    if is_test:
        for file in files.keys():
            if file == "rperiods":
                files[file] = pd.read_csv(test_folder_path + file + ".csv", index_col=[0])
            else:
                files[file] = pd.read_csv(test_folder_path + file + ".csv", parse_dates=['datetime'], index_col=[0])
    else:
        files["records"] = gsf.forecast_records(reach_id, start_date=start_date.split('.')[0], end_date=end_date.split('.')[0], s=s)
        files["stats"] = gsf.forecast_stats(reach_id, forecast_date=end_date, s=s)
        files["ensembles"] = gsf.forecast_ensembles(reach_id, forecast_date=end_date, s=s)
        files["rperiods"] = gsf.return_periods(reach_id, s=s)
    
    # cache the data
    for file in files.keys():
        files[file].to_csv(cache_folder_path + file + ".csv")
        
            
    s.close()
    # return json of plot html
    plot = gpp.hydroviewer(files["records"], files["stats"], files["ensembles"], files["rperiods"], outformat='plotly')
    plot.update_layout(
        title=None,
        margin={"t": 0},
    )
    return JsonResponse(dict(
        plot = offline_plot(
            plot,
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
    ))
    

@controller(name='getHistoricalData', url='getHistoricalData')
def get_historical_data(request):
    # get data
    s = requests.Session()
    reach_id = request.GET['reach_id']
    selected_year = request.GET['selected_year']
    is_test = (request.GET['is_test'] == 'true')
    
    files = {"hist": None, "rperiods": None}
    if is_test:
        for file in files.keys():
            if file == "rperiods":
                files[file] = pd.read_csv(test_folder_path + file + ".csv", index_col=[0])
            else:
                files[file] = pd.read_csv(test_folder_path + file + ".csv", parse_dates=['datetime'], index_col=[0])
    else:
        files["hist"] = gsf.historic_simulation(reach_id, s=s)
        files["rperiods"] = gsf.return_periods(reach_id, s=s)  # TODO read rperiods from cache folder if it exists
    
    # cache the data
    for file in files.keys():
        files[file].to_csv(cache_folder_path + file + ".csv")
            
    s.close()
    # process data
    title_headers = {'Reach ID': reach_id}
    # return json of plot html
    plot = gpp.historic_simulation(files["hist"], files["rperiods"], titles=title_headers, outformat='plotly')
    plot.update_layout(
        title=None,
        margin={"t": 0},
    )
    return JsonResponse(dict(
        plot = offline_plot(
            plot,
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        ),
        fdp=gpp.flow_duration_curve(files["hist"], titles=title_headers, outformat='plotly_html'),
        flow_regime=flow_regime(files["hist"], int(selected_year)) 
    ))
    

@controller(name='updateFlowRegime', url='updateFlowRegime')
def update_flow_regime(request):
    selected_year = request.GET['selected_year']
    hist = pd.read_csv(cache_folder_path + "hist.csv", parse_dates=['datetime'], index_col=[0])
    return JsonResponse(dict(flow_regime=flow_regime(hist, int(selected_year))))


@controller(name='get_average_precipitation_and_soil_moisture', url='get_average_precipitation_and_soil_moisture')
def get_average_precipitation_and_soil_moisture(request):
    data = json.loads(request.body.decode('utf-8'))
    area = data['area']
    plot = AveragePrecipitationAndSoilMoisture(area).run()
    return JsonResponse(dict(plot=plot))


@controller(name="get_gldas_soil_moisture_and_precipitation", url="get_gldas_soil_moisture_and_precipitation")
def get_gldas_soil_moisture_and_precipitation(request):
    data = json.loads(request.body.decode('utf-8'))
    area = data['area']
    start_date = data['startDate']
    end_date = data['endDate']
    plotter = GLDASSoilMoistureAndPrecipitation(area, start_date, end_date)
    plotter.get_gldas_data()
    soil = plotter.plot_soil_moisture()
    precip = plotter.plot_precipitation()
    return JsonResponse(dict(soil=soil, precip=precip))


@controller(name="get_imerg_precipitation", url="get_imerg_precipitation")
def get_imerg_precipitation(request):
    data = json.loads(request.body.decode('utf-8'))
    area = data['area']
    start_date = data['startDate']
    end_date = data['endDate']
    return JsonResponse(dict(imerg_precip=IMERGPrecipitation(area, start_date, end_date).run()))


@controller(name="get_era5_precipitation", url="get_era5_precipitation")
def get_era5_precipitation(request):
    data = json.loads(request.body.decode('utf-8'))
    area = data['area']
    start_date = data['startDate']
    end_date = data['endDate']
    return JsonResponse(dict(era5_precip=ERA5Precipitation(area, start_date, end_date).run()))
    
    