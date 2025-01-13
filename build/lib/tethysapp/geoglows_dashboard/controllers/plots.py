import geoglows
from django.http import JsonResponse

from tethys_sdk.routing import controller
from tethysapp.geoglows_dashboard.app import GeoglowsDashboard as app

from .helpers import get_newest_plot_data, format_plot
from ..analysis.streamflow.flow_regime import plot_flow_regime
from ..analysis.streamflow.annual_discharge import plot_annual_discharge_volumes
from ..analysis.streamflow.ssi_plots import plot_ssi_each_month_since_year, plot_ssi_one_month_each_year


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
    df_forecast = get_newest_plot_data(reach_id, 'forecast')
    plot = geoglows.plots.forecast(df=df_forecast)
    return JsonResponse(dict(forecast=format_plot(plot)))


@controller(name='get_historical_plot', url='get_historical_plot')
def get_historical_plot(request):
    reach_id = int(request.GET['reach_id'])
    selected_year = int(request.GET['selected_year'])
    df_retro = get_newest_plot_data(reach_id, 'retrospective')
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
    df_retro = get_newest_plot_data(reach_id, 'retrospective')
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
