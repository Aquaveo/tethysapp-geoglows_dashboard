import os
import io
import json
import geoglows
from datetime import datetime, timezone
import pandas as pd
from plotly.offline import plot as offline_plot

from tethys_sdk.workspaces import get_app_workspace
from tethysapp.geoglows_dashboard.app import GeoglowsDashboard as app


CACHE_DIR_PATH = os.path.join(get_app_workspace(app).path, "streamflow_plots_cache/")
if not os.path.exists(CACHE_DIR_PATH):
    os.makedirs(CACHE_DIR_PATH)


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


def correct_historical(reach_id, simulated_historical_data):
    path_name = os.path.join(get_app_workspace(app).path, 'kenya_observed_discharge', f'{reach_id}.csv')
    observed_historical = pd.read_csv(path_name, index_col=0)
    observed_historical[observed_historical < 0] = 0
    observed_historical.index = pd.to_datetime(observed_historical.index)
    observed_historical.index = observed_historical.index.to_series().dt.strftime("%Y-%m-%d")
    observed_historical.index = pd.to_datetime(observed_historical.index)
    simulated_historical_data.index = pd.to_datetime(simulated_historical_data.index)
    simulated_historical_data[simulated_historical_data < 0] = 0
    simulated_historical_data.index = simulated_historical_data.index.to_series().dt.strftime("%Y-%m-%d")
    simulated_historical_data.index = pd.to_datetime(simulated_historical_data.index)
    corrected_historical = geoglows.bias.correct_historical(simulated_historical_data, observed_historical)
    corrected_historical.index = pd.to_datetime(corrected_historical.index)
    corrected_historical.index = corrected_historical.index.to_series().dt.strftime("%Y-%m-%d")
    corrected_historical.index = pd.to_datetime(corrected_historical.index)
    return corrected_historical


def get_newest_plot_data(reach_id, plot_type='forecast'):
    """Get newest forecast or retrospective data.

    Args:
        reach_id (int or str): river id
        plot_type (str, optional): The plot type. Options are forecast and retrospective. Defaults to 'forecast'.

    Returns:
        df: the dataframe of the newest plot data
    """
    files = os.listdir(CACHE_DIR_PATH)
    cache_file = None
    for file in files:
        if file.startswith(f'{plot_type}-{reach_id}'):
            cache_file = file

    # Check if we can use the cached data, if not, delete it
    current_date = datetime.now(timezone.utc).strftime('%Y%m%d')
    need_new_data, cached_data_path = True, None
    if cache_file:
        cached_date = cache_file.split('-')[-1].split('.')[0]
        need_new_data = current_date != cached_date
        cached_data_path = os.path.join(CACHE_DIR_PATH, cache_file)
    new_data_path = os.path.join(CACHE_DIR_PATH, f'{plot_type}-{reach_id}-{current_date}.csv')

    if plot_type == 'forecast':
        if need_new_data:
            df = geoglows.data.forecast(reach_id)
        else:
            df = pd.read_csv(cached_data_path, parse_dates=['time'], index_col=[0])
    elif plot_type == 'retrospective':
        if need_new_data:
            df = geoglows.data.retrospective(reach_id)
        else:
            df = pd.read_csv(cached_data_path, parse_dates=['time'], index_col=[0])
            df.columns.name = 'rivid'
            df.columns = df.columns.astype('int64')
    else:
        raise ValueError("plot_type must be 'forecast' or 'retrospective'")

    if need_new_data:
        df.to_csv(new_data_path)
        if cached_data_path:
            os.remove(cached_data_path)

    # Use bias corrected data for the following rivers
    if reach_id in [160215979, 160221792, 160183236] and plot_type == 'retrospective':
        df = correct_historical(reach_id, df)
        df.columns = [reach_id]
        df.columns.name = 'rivid'
        df.index.name = 'time'

    return df


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
