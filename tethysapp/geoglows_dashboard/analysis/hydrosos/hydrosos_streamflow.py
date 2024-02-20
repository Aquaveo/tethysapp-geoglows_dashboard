import os
import pandas as pd
import pyogrio
import geopandas as gpd
import json


def compute_hydrosos_streamflow_layer(year, month):
    app_workspace_dir = os.path.join(os.path.dirname(__file__), "../../workspaces/app_workspace")
    filename = f"{year}-{0 if month < 10 else ''}{month}-01.json"
    filepath = f"{app_workspace_dir}/hydrosos_streamflow_by_month/{filename}"
    file = open(filepath, "r")
    return file.read()


def compute_hydrosos_streamflow_layer_no_geo(year, month):
    app_workspace_dir = os.path.join(os.path.dirname(__file__), "../../workspaces/app_workspace")
    filename = f"{year}-{0 if month < 10 else ''}{month}-01.csv"
    filepath = f"{app_workspace_dir}/hydrosos_streamflow_by_month_no_geo/{filename}"
    df_river = pd.read_csv(filepath)
    df_geometry = pyogrio.read_dataframe(f"{app_workspace_dir}/hydrosos_streamflow_geometry.geojson")
    merged_df = df_river[["rivid", "strmOrder", "classification"]].merge(df_geometry[["rivid", "geometry"]], how="inner")
    gdf = gpd.GeoDataFrame(merged_df)
    grouped = gdf.groupby("strmOrder")
    geojson_lst = []
    for strmOrder, group_df in grouped:
        geojson_lst.append(group_df.to_json())
    return json.dumps(geojson_lst)
