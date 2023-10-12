from django.shortcuts import render
from django.http import JsonResponse
from tethys_sdk.routing import controller
from tethys_sdk.gizmos import Button
import geoglows.streamflow as gsf
import geoglows.plots as gpp
import requests
from .gee.plots import flow_regime
import os
import pandas as pd


from plotly.offline import plot as offline_plot


# from .plots import hydroviewer

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
    reach_id = request.GET['reach_id']
    lat, lon = gsf.reach_to_latlon(int(reach_id))
    return JsonResponse({'lat': lat, 'lon': lon})


@controller(name='getAvailableDates', url='getAvailableDates')
def get_available_dates(request):
    reach_id = request.GET['reach_id']
    s = requests.Session()
    dates = gsf.available_dates(reach_id, s=s)
    s.close()

    return JsonResponse(dict(
        dates=list(map(lambda x: x.split(".")[0], dates["available_dates"])),
    ))
    
    
@controller(name='getForecastData', url='getForecastData')
def get_forecast_data(request):
    print(os.getcwd())
    # get data
    s = requests.Session()
    reach_id = request.GET['reach_id']
    start_date = request.GET['start_date']
    end_date = request.GET['end_date']
    isTest = (request.GET['test'] == 'True')
    
    folder_path = "tethysapp/geoglows_dashboard/public/data/test/"
    files = {"records": None, "stats": None, "ensembles": None, "rperiods": None}
    if isTest:
        for file in files.keys():
            if file == "rperiods":
                files[file] = pd.read_csv(folder_path + file + ".csv", index_col=[0])
            else:
                files[file] = pd.read_csv(folder_path + file + ".csv", parse_dates=['datetime'], index_col=[0])
        print("all forecast data is read!")
    else:
        files["records"] = gsf.forecast_records(reach_id, start_date=start_date.split('.')[0], end_date=end_date.split('.')[0], s=s)
        files["stats"] = gsf.forecast_stats(reach_id, forecast_date=end_date, s=s)
        files["ensembles"] = gsf.forecast_ensembles(reach_id, forecast_date=end_date, s=s)
        files["rperiods"] = gsf.return_periods(reach_id, s=s)
        # for file in files.keys():
        #     files[file].to_csv(folder_path + file + ".csv")
        
            
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
    isTest = request.GET['test'] == 'True'
    
    files = {"hist": None, "rperiods": None}
    folder_path = "tethysapp/geoglows_dashboard/public/data/test/"
    if isTest:
        for file in files.keys():
            if file == "rperiods":
                files[file] = pd.read_csv(folder_path + file + ".csv", index_col=[0])
            else:
                files[file] = pd.read_csv(folder_path + file + ".csv", parse_dates=['datetime'], index_col=[0])
        print("all historical data is read!")
    else:
        files["hist"] = gsf.historic_simulation(reach_id, s=s)
        files["rperiods"] = gsf.return_periods(reach_id, s=s)
        # for file in files.keys():
        #     files[file].to_csv(folder_path + file + ".csv")
            
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
        hist=files["hist"],
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
    hist = request['hist']
    selected_year = request['selected_year']
    return JsonResponse(dict(flow_regime=flow_regime(hist, int(selected_year))))