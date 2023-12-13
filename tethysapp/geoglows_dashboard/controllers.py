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
import ast
import ee
import os

from .analysis.flow_regime import plot_flow_regime
from .analysis.annual_discharge import plot_annual_discharge_volumes
from .analysis.gee.gee_plots import GEEPlots
from .analysis.compute_country_dry_level import compute_country_dry_level


test_dir = "test/"
cache_dir = "cache/"


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


@controller(name='get_available_dates', url='get_available_dates', user_workspace=True)
def get_available_dates(request, user_workspace):
    reach_id = request.GET['reach_id']
    is_test = request.GET['is_test'] == 'true'
    if is_test:
        dates = json.load(open(os.path.join(user_workspace.path, test_dir, "dates.json")))
    else:
        s = requests.Session()
        dates = gsf.available_dates(reach_id, s=s)
        s.close()
        
    # cache the data
    with open(os.path.join(user_workspace.path, cache_dir, "dates.json"), "w") as file: 
        json.dump(dates, file)
        
    return JsonResponse(dict(
        dates=list(map(lambda x: x.split(".")[0], dates["available_dates"])),
    ))
    
    
### Streamflow Plots ###
        
@controller(name='get_forecast_data', url='get_forecast_data', user_workspace=True)
def get_forecast_data(request, user_workspace):
    s = requests.Session()
    reach_id = request.GET['reach_id']
    start_date = request.GET['start_date']
    end_date = request.GET['end_date']
    is_test = (request.GET['is_test'] == 'true')
    
    files = {"records": None, "stats": None, "ensembles": None, "rperiods": None}
    cache_folder_path = os.path.join(user_workspace.path, cache_dir)
    test_folder_path = os.path.join(user_workspace.path, test_dir)
    if is_test:
        for file in files.keys():
            if file == "rperiods":
                files[file] = pd.read_csv(os.path.join(test_folder_path, file + ".csv"), index_col=[0])
            else:
                files[file] = pd.read_csv(os.path.join(test_folder_path, file + ".csv"), parse_dates=['datetime'], index_col=[0])
    else:
        files["records"] = gsf.forecast_records(reach_id, start_date=start_date.split('.')[0], end_date=end_date.split('.')[0], s=s)
        files["stats"] = gsf.forecast_stats(reach_id, forecast_date=end_date, s=s)
        files["ensembles"] = gsf.forecast_ensembles(reach_id, forecast_date=end_date, s=s)
        files["rperiods"] = gsf.return_periods(reach_id, s=s)
    
    # cache the data
    for file in files.keys():
        files[file].to_csv(os.path.join(cache_folder_path, file + ".csv"))
            
    s.close()
    
    # return json of plot html
    plot = gpp.hydroviewer(files["records"], files["stats"], files["ensembles"], files["rperiods"], outformat='plotly')
    plot.update_layout(
        title=None,
        margin={"t": 0, "b": 0, "r": 0, "l": 0},
    )
    return JsonResponse(dict(
        forecast=offline_plot(
            plot,
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
    ))
    

@controller(name='get_historical_data', url='get_historical_data', user_workspace=True)
def get_historical_data(request, user_workspace):
    # get data
    s = requests.Session()
    reach_id = request.GET['reach_id']
    selected_year = request.GET['selected_year']
    is_test = (request.GET['is_test'] == 'true')
    
    files = {"hist": None, "rperiods": None}
    cache_folder_path = os.path.join(user_workspace.path, cache_dir)
    test_folder_path = os.path.join(user_workspace.path, test_dir)
    if is_test:
        for file in files.keys():
            if file == "rperiods":
                files[file] = pd.read_csv(os.path.join(test_folder_path, file + ".csv"), index_col=[0])
            else:
                files[file] = pd.read_csv(os.path.join(test_folder_path, file + ".csv"), parse_dates=['datetime'], index_col=[0])
    else:
        files["hist"] = gsf.historic_simulation(reach_id, s=s)
        files["rperiods"] = gsf.return_periods(reach_id, s=s)  # TODO read rperiods from cache folder if it exists
    
    # cache the data
    for file in files.keys():
        path = os.path.join(cache_folder_path, file + ".csv")
        files[file].to_csv(path)
            
    s.close()
    
    # process data
    title_headers = {'Reach ID': reach_id}
    historical_plot = gpp.historic_simulation(files["hist"], files["rperiods"], titles=title_headers, outformat='plotly')
    historical_plot.update_layout(
        title=None,
        margin={"t": 0, "b": 0, "r": 0, "l": 0},
    )
    
    flow_duration_plot = gpp.flow_duration_curve(files["hist"], titles=title_headers, outformat='plotly')
    flow_duration_plot.update_layout(
        title=None,
        margin={"t": 0, "b": 0, "r": 0, "l": 0}
    )
    
    return JsonResponse(dict(
        historical=format_plot(historical_plot),
        flow_duration=format_plot(flow_duration_plot),
        flow_regime=plot_flow_regime(files["hist"], int(selected_year))  # TODO
    ))
    
    
def format_plot(plot):
    return offline_plot(
        plot,
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )
    

@controller(name='update_flow_regime', url='update_flow_regime', user_workspace=True)
def update_flow_regime(request, user_workspace):
    selected_year = request.GET['selected_year']
    hist = pd.read_csv(os.path.join(user_workspace.path, cache_dir, "hist.csv"), parse_dates=['datetime'], index_col=[0])
    return JsonResponse(dict(flow_regime=plot_flow_regime(hist, int(selected_year))))


@controller(name='get_annual_discharge', url='get_annual_discharge')
def get_annual_discharge(request):
    reach_id = request.GET['reach_id']
    plot = plot_annual_discharge_volumes(110229254) # TODO use reach_id after switching to Geoglows-v2
    return JsonResponse(dict(plot=plot))
    

def parse_coordinates_string(area_type, coordinate_string):
    coordinates = ast.literal_eval(coordinate_string)
    if (area_type == "point"):
        return ee.Geometry.Point([coordinates['lng'], coordinates['lat']])
    else:
        result = [[]]
        for point in coordinates[0]:
            result[0].append([point['lng'], point['lat']])
        return ee.Geometry.Polygon(result)    
    

@controller(name='get_gee_plot', url='get_gee_plot')
def get_gee_plot(request):
    data = json.loads(request.body.decode('utf-8'))
    area_type = data['areaType']
    coordinates = str(data['coordinates'])
    area = parse_coordinates_string(area_type, coordinates)
    start_date = data['startDate']
    end_date = data['endDate']
    plot_name = data['plotName']
    plot = GEEPlots(start_date, end_date, area).get_plot(plot_name)  
    return JsonResponse(dict(plot=plot))


@controller(name='get_country_dry_level', url='get_country_dry_level')
def get_country_dry_level(request):
    date = request.GET["date"]
    type = request.GET["type"]
    year, month, _ = date.split("-")
    return JsonResponse(compute_country_dry_level(int(year), int(month), type), safe=False)
    
    