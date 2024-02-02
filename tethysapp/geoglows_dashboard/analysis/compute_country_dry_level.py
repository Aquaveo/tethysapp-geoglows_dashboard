import pandas as pd
from pandas.api.types import CategoricalDtype
import geopandas as gpd
import os
import json
from functools import reduce

from ..model import get_country

def compute_country_dry_level(country, year, month, type):
    # get data
    country_data = get_country(country).hydrosos
    features = country_data["features"]
    if type == "soil":
        property = "soil moisture"
    else:
        property = "precipitation"
    dfs = []
    for i in range(len(features)):
        properties = features[i]["properties"]
        area_name = properties["ADM1_ES"]
        area_soil_data = properties[property]
        dfs.append(pd.DataFrame(area_soil_data, columns=["month", area_name]))
    hist = reduce(lambda left, right: pd.merge(left, right, on="month"), dfs)
    hist["month"] = pd.to_datetime(hist["month"])
    
    # TODO better way? don't cache in the file
    app_workspace_dir = os.path.join(os.path.dirname(__file__), "../workspaces/app_workspace")
    file_path = f"{app_workspace_dir}/hydrosos_storage_temp.json"
    with open(file_path, 'w') as file:
        json.dump(country_data, file)
    area = gpd.read_file(file_path).drop(columns=["classification"])


    cuencas = []
    classification = []
    for region in hist.columns[1:]:
        hist_df = pd.DataFrame(hist.set_index("month")[region])
        avg_df = hist_df[(hist_df.index.year >= 2001) & (hist_df.index.year <= 2020)]
        filtered_month = pd.DataFrame(hist_df[hist_df.index.month == month])
        avg = avg_df.groupby(avg_df.index.month).mean()[region][month]
        filtered_month["ratio"] = filtered_month[region] / avg
        filtered_month["rank"] = filtered_month["ratio"].rank()
        filtered_month.loc[:, "percentile"] = filtered_month.loc[:, "rank"] / (len(filtered_month["rank"]) + 1)
        df_subset = filtered_month.loc[filtered_month.index.year == year]
        
        val = df_subset["percentile"][0]
        if val >= 0.87:
            category = "extremely wet"
        elif val >= 0.72:
            category = "wet"
        elif val >= 0.28:
            category = "normal range"
        elif val >= 0.13:
            category = "dry"
        else:
            category = "extremely dry"

        classification.append(category)
        cuencas.append(region)
            
    dict_cuencas = {"classification": classification, "ADM1_ES": cuencas}
    vals_df = pd.DataFrame(dict_cuencas)
    map_this = area.merge(vals_df, on="ADM1_ES")
    gdf = gpd.GeoDataFrame(map_this, geometry='geometry')

    dry_level = CategoricalDtype(["extremely dry", "dry", "normal range", "wet", "extremely wet"], ordered=True)
    gdf['classification'] = gdf['classification'].astype(dry_level)
    gdf = gdf.sort_values(by='classification')

    # Convert the GeoDataFrame to GeoJSON
    return gdf.to_json()
