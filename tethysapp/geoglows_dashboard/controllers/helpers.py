import os
import io
import ee
import ast
import json
import requests
import geoglows
from datetime import datetime, timezone

import pandas as pd
from plotly.offline import plot as offline_plot

from tethys_sdk.workspaces import get_app_workspace
from tethysapp.geoglows_dashboard.app import GeoglowsDashboard as app


cache_dir_path = os.path.join(get_app_workspace(app).path, "streamflow_plots_cache/")
if not os.path.exists(cache_dir_path):
    os.makedirs(cache_dir_path)


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


def get_newest_plot_data(reach_id, plot_type='forecast'):
    """Get newest forecast or retrospective data.

    Args:
        reach_id (int or str): river id
        plot_type (str, optional): The plot type. Options are forecast and retrospective. Defaults to 'forecast'.

    Returns:
        df: the dataframe of the newest plot data
    """
    files = os.listdir(cache_dir_path)
    cache_file = None
    for file in files:
        if file.startswith(f'{plot_type}-{reach_id}'):
            cache_file = file

    current_date = datetime.now(timezone.utc).strftime('%Y%m%d')
    need_new_data, cached_data_path = True, None
    if cache_file:
        cached_date = cache_file.split('-')[-1].split('.')[0]
        need_new_data = current_date != cached_date
        cached_data_path = os.path.join(cache_dir_path, cache_file)
    new_data_path = os.path.join(cache_dir_path, f'{plot_type}-{reach_id}-{current_date}.csv')

    if plot_type == 'forecast':
        if need_new_data:
            url = f'https://geoglows.ecmwf.int/api/v2/forecast/{reach_id}'
            response = requests.get(url)
            if response.status_code != 200:
                raise RuntimeError(f'Failed to fetch data for the river {reach_id}: ' + response.text)
            df = pd.read_csv(io.StringIO(response.text), index_col=[0])
        else:
            df = pd.read_csv(cached_data_path, parse_dates=['datetime'], index_col=[0])
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

    return df


def parse_coordinates_string(area_type, coordinate_string):
    coordinates = ast.literal_eval(coordinate_string)
    if (area_type == "point"):
        return ee.Geometry.Point([coordinates['lng'], coordinates['lat']])
    else:
        result = [[]]
        for point in coordinates[0]:
            result[0].append([point['lng'], point['lat']])
        return ee.Geometry.Polygon(result)


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
