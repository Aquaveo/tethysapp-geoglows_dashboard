import os
import io
import ee
import ast
import json

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


def need_new_data(reach_id, current_date, plot_type='forecast'):
    """
    Check if the cached data need to be cleared and get data for a new date.
    Return new_data_needed and cached_data_path.

    Args:
        reach_id: river id
        plot_type (str, optional): the type of the plot. Options are 'forecast' and 'retro'. Defaults to 'forecast'.
    """
    files = os.listdir(cache_dir_path)
    for file in files:
        if file.startswith(f'{plot_type}-{reach_id}'):
            cache_file = file

    new_data_needed = True
    cached_data_path = None
    if cache_file:
        cached_date = cache_file.split('-')[-1].split('.')[0]
        new_data_needed = current_date != cached_date
        cached_data_path = os.path.join(cache_dir_path, cache_file)

    return new_data_needed, cached_data_path


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
