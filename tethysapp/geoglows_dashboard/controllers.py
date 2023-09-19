from django.shortcuts import render
from django.http import JsonResponse
from tethys_sdk.routing import controller
from tethys_sdk.gizmos import Button
import geoglows.streamflow as gsf
import geoglows.plots as gpp
import requests
import hydrostats.data


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
    # get data
    s = requests.Session()
    reach_id = request.GET['reach_id']
    start_date = request.GET['start_date']
    end_date = request.GET['end_date']
    records = gsf.forecast_records(reach_id, start_date=start_date.split('.')[0], end_date=end_date.split('.')[0], s=s)
    stats = gsf.forecast_stats(reach_id, forecast_date=end_date, s=s)
    ensembles = gsf.forecast_ensembles(reach_id, forecast_date=end_date, s=s)
    rperiods = gsf.return_periods(reach_id, s=s)

    s.close()
    # return json of plot html
    plot = gpp.hydroviewer(records, stats, ensembles, rperiods, outformat='plotly')
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
    hist = gsf.historic_simulation(reach_id, s=s)
    rper = gsf.return_periods(reach_id, s=s)
    s.close()
    # process data
    title_headers = {'Reach ID': reach_id}
    # return json of plot html
    plot = gpp.historic_simulation(hist, rper, titles=title_headers, outformat='plotly')
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