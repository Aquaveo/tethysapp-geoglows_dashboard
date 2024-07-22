import io
import os
import requests
import json
from datetime import datetime, timezone
import geoglows
import pandas as pd
from django.http import JsonResponse

from tethys_sdk.routing import controller
from tethys_sdk.workspaces import get_app_workspace
from tethysapp.geoglows_dashboard.app import GeoglowsDashboard as app

from .helpers import need_new_data, format_plot, parse_coordinates_string
from ..analysis.streamflow.flow_regime import plot_flow_regime
from ..analysis.streamflow.annual_discharge import plot_annual_discharge_volumes
from ..analysis.streamflow.ssi_plots import plot_ssi_each_month_since_year, plot_ssi_one_month_each_year
from ..analysis.gee.gee_plots import GEEPlots


cache_dir_path = os.path.join(get_app_workspace(app).path, "streamflow_plots_cache/")
if not os.path.exists(cache_dir_path):
    os.makedirs(cache_dir_path)


@controller(url='get_geoserver_endpoint')
def get_geoserver_endpoint(request):
    endpoint = app.get_spatial_dataset_service('primary_geoserver', as_endpoint=True)
    return JsonResponse(dict(endpoint=endpoint.split('/rest')[0]))


@controller(url='get_reach_latlon')
def get_reach_latlon(request):
    reach_id = int(request.GET['reach_id'])
    lat, lon = geoglows.streams.river_to_latlon(int(reach_id))
    return JsonResponse({'lat': lat, 'lon': lon})


@controller(name='get_forecast_plot', url='get_forecast_plot')
def get_forecast_plot(request):
    reach_id = int(request.GET['reach_id'])
    current_date = datetime.now(timezone.utc).strftime('%Y%m%d')
    plot_type = 'forecast'
    new_data_needed, cached_data_path = need_new_data(reach_id, current_date, plot_type)
    if new_data_needed:
        url = f'https://geoglows.ecmwf.int/api/v2/forecast/{reach_id}'
        response = requests.get(url)
        if response.status_code != 200:
            raise RuntimeError(f'Failed to fetch data for the river {reach_id}: ' + response.text)
        df_forecast = pd.read_csv(io.StringIO(response.text), index_col=[0])
        new_data_path = os.path.join(cache_dir_path, f'{plot_type}-{reach_id}-{current_date}.csv')
        df_forecast.to_csv(new_data_path)
        os.remove(cached_data_path)
    else:
        df_forecast = pd.read_csv(cached_data_path, parse_dates=['datetime'], index_col=[0])

    plot = geoglows.plots.forecast(df=df_forecast)
    return JsonResponse(dict(forecast=format_plot(plot)))


@controller(name='get_historical_plot', url='get_historical_plot')
def get_historical_plot(request):
    reach_id = int(request.GET['reach_id'])
    selected_year = int(request.GET['selected_year'])

    current_date = datetime.now(timezone.utc).strftime('%Y%m%d')
    plot_type = 'retro'
    new_data_needed, cached_data_path = need_new_data(reach_id, current_date, plot_type)
    if new_data_needed:
        df_retro = geoglows.data.retrospective(reach_id)
        new_data_path = os.path.join(cache_dir_path, f'{plot_type}-{reach_id}-{current_date}.csv')
        df_retro.to_csv(new_data_path)
        os.remove(cached_data_path)
    else:
        df_retro = pd.read_csv(cached_data_path, parse_dates=['time'], index_col=[0])
        df_retro.columns.name = 'rivid'
        df_retro.columns = df_retro.columns.astype('int64')

    historical_plot = geoglows.plots.retrospective(df=df_retro)
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
    current_date = datetime.now(timezone.utc).strftime('%Y%m%d')

    plot_type = 'retro'
    new_data_needed, cached_data_path = need_new_data(reach_id, current_date, plot_type)
    new_data_path = os.path.join(cache_dir_path, f'{plot_type}-{reach_id}-{current_date}.csv')
    if new_data_needed:
        df_retro = geoglows.data.retrospective(reach_id)
        df_retro.to_csv(new_data_path)
        os.remove(cached_data_path)
    else:
        df_retro = pd.read_csv(cached_data_path, parse_dates=['time'], index_col=[0])
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
