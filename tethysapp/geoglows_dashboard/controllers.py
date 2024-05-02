import pandas as pd
import json
import ast
import ee
import os
import io

from django.shortcuts import render
from django.http import JsonResponse
from plotly.offline import plot as offline_plot
from tethys_sdk.routing import controller
from tethys_sdk.gizmos import Button
from tethys_sdk.workspaces import get_app_workspace
import geoglows

from .analysis.streamflow.flow_regime import plot_flow_regime
from .analysis.streamflow.annual_discharge import plot_annual_discharge_volumes
from .analysis.streamflow.ssi_plots import plot_ssi_each_month_since_year, plot_ssi_one_month_each_year
from .analysis.gee.gee_plots import GEEPlots
from .analysis.hydrosos.compute_country_dry_level import compute_country_dry_level
from .analysis.hydrosos.hydrosos_streamflow import compute_hydrosos_streamflow_layer
from .model import add_new_country, get_all_countries, remove_country, update_default_country_db
from .analysis.gee.gee_map_layer import GEEMapLayer
from .app import GeoglowsDashboard as app


cache_dir_path = os.path.join(get_app_workspace(app).path, "streamflow_plots_cache/")
if not os.path.exists(cache_dir_path):
    os.makedirs(cache_dir_path)


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
            'data-bs-toggle': 'tooltip',
            'data-bs-placement': 'top',
            'title': 'Save'
        }
    )

    edit_button = Button(
        display_text='',
        name='edit-button',
        icon='pen',
        style='warning',
        attributes={
            'data-bs-toggle': 'tooltip',
            'data-bs-placement': 'top',
            'title': 'Edit'
        }
    )

    remove_button = Button(
        display_text='',
        name='remove-button',
        icon='trash',
        style='danger',
        attributes={
            'data-bs-toggle': 'tooltip',
            'data-bs-placement': 'top',
            'title': 'Remove'
        }
    )

    previous_button = Button(
        display_text='Previous',
        name='previous-button',
        attributes={
            'data-bs-toggle': 'tooltip',
            'data-bs-placement': 'top',
            'title': 'Previous'
        }
    )

    next_button = Button(
        display_text='Next',
        name='next-button',
        attributes={
            'data-bs-toggle': 'tooltip',
            'data-bs-placement': 'top',
            'title': 'Next'
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


@controller(url='get_geoserver_endpoint')
def get_geoserver_endpoint(request):
    endpoint = app.get_spatial_dataset_service('primary_geoserver', as_endpoint=True)
    return JsonResponse(dict(endpoint=endpoint.split('/rest')[0]))
    

@controller(url='get_reach_latlon')
def get_reach_latlon(request):
    reach_id = int(request.GET['reach_id'])
    lat, lon = geoglows.streams.river_to_latlon(int(reach_id))
    return JsonResponse({'lat': lat, 'lon': lon})

# Streamflow Plots


def format_plot(plot):
    plot.update_layout(
        title=None,
        margin={"t": 0, "b": 0, "r": 0, "l": 0}
    )
    return offline_plot(
        plot,
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )


@controller(name='get_forecast_plot', url='get_forecast_plot')
def get_forecast_plot(request):
    reach_id = int(request.GET['reach_id'])

    # get forecast data
    forecast_file_path = os.path.join(cache_dir_path, f'forecast-{reach_id}.csv')
    if os.path.exists(forecast_file_path):
        df_forecast = pd.read_csv(forecast_file_path, parse_dates=['time'], index_col=[0])
    else:
        df_forecast = geoglows.data.forecast(river_id=reach_id)
        df_forecast.to_csv(forecast_file_path)

    # get return periods data
    rperiods_file_path = os.path.join(cache_dir_path, f'rperiods-{reach_id}.csv')
    if os.path.exists(rperiods_file_path):
        df_rperiods = pd.read_csv(rperiods_file_path, index_col=[0])
        df_rperiods.columns = df_rperiods.columns.astype('int')
        df_rperiods.columns.name = 'return_period'
    else:
        df_rperiods = geoglows.data.return_periods(river_id=reach_id)
        df_rperiods.to_csv(rperiods_file_path)

    plot = geoglows.plots.forecast(df=df_forecast, rp_df=df_rperiods)
    return JsonResponse(dict(forecast=format_plot(plot)))


@controller(name='get_historical_plot', url='get_historical_plot')
def get_historical_plot(request):
    reach_id = int(request.GET['reach_id'])
    selected_year = int(request.GET['selected_year'])

    # get historical data
    retro_file_path = os.path.join(cache_dir_path, f'retro-{reach_id}.csv')
    if os.path.exists(retro_file_path):
        df_retro = pd.read_csv(retro_file_path, parse_dates=['time'], index_col=[0])
        df_retro.columns.name = 'rivid'
        df_retro.columns = df_retro.columns.astype('int64')
    else:
        df_retro = geoglows.data.retrospective(reach_id)
        df_retro.to_csv(retro_file_path)

    # get return periods data
    rperiods_file_path = os.path.join(cache_dir_path, f'rperiods-{reach_id}.csv')
    if os.path.exists(rperiods_file_path):
        df_rperiods = pd.read_csv(rperiods_file_path, index_col=[0])
        df_rperiods.columns = df_rperiods.columns.astype('int')
        df_rperiods.columns.name = 'return_period'
    else:
        df_rperiods = geoglows.data.return_periods(river_id=reach_id)
        df_rperiods.to_csv(rperiods_file_path)

    historical_plot = geoglows.plots.retrospective(df=df_retro, rp_df=df_rperiods)
    flow_duration_plot = geoglows.plots.flow_duration_curve(df=df_retro)
    return JsonResponse(dict(
        historical=format_plot(historical_plot),
        flow_duration=format_plot(flow_duration_plot),
        flow_regime=plot_flow_regime(df_retro, selected_year, reach_id)
    ))


@controller(name='update_flow_regime_plot', url='update_flow_regime_plot')
def update_flow_regime_plot(request):
    selected_year = int(request.GET['selected_year'])
    reach_id = int(request.GET['reach_id'])
    df_retro = pd.read_csv(os.path.join(cache_dir_path, f"retro-{reach_id}.csv"), parse_dates=['time'], index_col=[0])
    df_retro.columns = df_retro.columns.astype('int64')
    return JsonResponse(dict(flow_regime=plot_flow_regime(df_retro, selected_year, reach_id)))


@controller(name='get_annual_discharge_plot', url='get_annual_discharge_plot')
def get_annual_discharge_plot(request):
    reach_id = int(request.GET['reach_id'])
    plot = plot_annual_discharge_volumes(reach_id)
    return JsonResponse(dict(plot=plot))


@controller(name='get_ssi_plot', url='get_ssi_plot')
def get_ssi_plot(request):
    reach_id = int(request.GET['reach_id'])
    month = int(request.GET['month'])
    if month < 0:
        plot = plot_ssi_each_month_since_year(reach_id, 2010)
    else:
        plot = plot_ssi_one_month_each_year(reach_id, month)
    return JsonResponse(dict(plot=plot))


# GEE Plots


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


def parse_coordinates_string(area_type, coordinate_string):
    coordinates = ast.literal_eval(coordinate_string)
    if (area_type == "point"):
        return ee.Geometry.Point([coordinates['lng'], coordinates['lat']])
    else:
        result = [[]]
        for point in coordinates[0]:
            result[0].append([point['lng'], point['lat']])
        return ee.Geometry.Polygon(result)


# HydroSOS Layers


@controller(name='get_country_dry_level', url='get_country_dry_level')
def get_country_dry_level(request):
    country = request.GET["country"]
    date = request.GET["date"]
    type = request.GET["type"]
    year, month, _ = date.split("-")
    return JsonResponse(compute_country_dry_level(country, int(year), int(month), type), safe=False)


@controller(name="get_hydrosos_streamflow_layer", url="get_hydrosos_streamflow_layer")
def get_hydrosos_streamflow_layer(request):
    year, month, _ = request.GET["date"].split("-")
    return JsonResponse(compute_hydrosos_streamflow_layer(int(year), int(month)), safe=False)


@controller(name="country", url="country")
def add_country(request):
    if request.method == "POST":
        data = json.loads(request.body.decode('utf-8'))
        country = data["country"]
        geojson = data["geoJSON"]
        precip = data["precip"]
        soil = data["soil"]
        is_default = data["isDefault"]
        hydrosos_data = parse_hydrosos_data(geojson, precip, soil)
        add_new_country(country, hydrosos_data, is_default)
        return JsonResponse(dict(res=f"{country} is added!"))
    elif request.method == "GET":
        countries = get_all_countries()
        countries_dict = {}
        for country in countries:
            countries_dict[country.name] = {"hydrosos": country.hydrosos, "default": country.default}
        return JsonResponse(dict(data=json.dumps(countries_dict)))
    elif request.method == "DELETE":
        data = json.loads(request.body.decode('utf-8'))
        country = data["country"]
        remove_country(country)
        return JsonResponse(dict(res=f"{country} is removed!"))


def parse_hydrosos_data(geojson, precip, soil):
    hydrosos_data = json.loads(geojson)
    features = hydrosos_data["features"]

    precip_data = pd.read_csv(io.StringIO(precip), sep=",")
    precip_dict = dict()
    for column in precip_data.columns[1:]:
        precip_dict[column] = precip_data[["month", column]].values.tolist()

    soil_data = pd.read_csv(io.StringIO(soil), sep=",")
    soil_dict = dict()
    for column in soil_data.columns[1:]:
        soil_dict[column] = soil_data[["month", column]].values.tolist()

    for feature in features:
        properties = feature["properties"]
        name = properties["ADM1_ES"]
        properties["precipitation"] = precip_dict[name]
        properties["soil moisture"] = soil_dict[name]

    return hydrosos_data


@controller(name="update_default_country", url="country/default")
def update_default_country(request):
    data = json.loads(request.body.decode('utf-8'))
    country = data["country"]
    update_default_country_db(country)
    return JsonResponse(dict(res=f"{country} is set as default!"))


@controller(name='get_gee_map_layer', url='get_gee_map_layer')
def get_gee_map_layer(request):
    area = ee.Geometry.Polygon(
        [[12.433899230380394, 1.2502984485255044], [15.246399230380394, -10.641022352451941],
         [15.949524230380394, -22.737541753468385], [18.762024230380394, -30.885123250790635],
         [26.496399230380394, -29.057956188967015], [33.87921173038039, -21.434519240512245],
         [37.39483673038039, -14.074627325782883], [36.34014923038039, -5.421182829476382],
         [41.26202423038039, 0.547264369136003], [46.88702423038039, 6.509784171738834],
         [42.31671173038039, 9.988478071051889], [37.39483673038039, 15.472887767295823],
         [34.93389923038039, 22.4497599999652], [30.363586730380394, 30.314223455550316],
         [25.090149230380394, 29.70536422289729], [26.144836730380394, 23.09806434509904],
         [21.222961730380394, 14.794151647354017], [13.840149230380394, 8.252960159280674],
         [12.433899230380394, 1.2502984485255044]]
    )
    url = GEEMapLayer(area).main()
    return JsonResponse(dict(url=url))
