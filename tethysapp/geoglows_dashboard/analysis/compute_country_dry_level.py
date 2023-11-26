import pandas as pd
from pandas.api.types import CategoricalDtype
import geopandas as gpd
import datetime
from datetime import datetime
import os

def compute_country_dry_level(year, month):
    app_workspace_dir = os.path.join(os.path.dirname(__file__), "../workspaces/app_workspace")
    hist = pd.read_excel(f"{app_workspace_dir}/Ecuador_soil_vals_download.xlsx")
    hist["month"] = pd.to_datetime(hist["month"], format="%Y-%m-%d")
    area = gpd.read_file(f"{app_workspace_dir}/combined.geojson")

    cuencas = []
    classification = []
    for region in hist.columns:
        if region == "month":
            continue
        hist_df = pd.DataFrame(hist.set_index("month")[region])
        avg_df = hist_df.copy()
        avg_df = avg_df[avg_df.index.year >= 2001]
        avg_df = avg_df[avg_df.index.year <= 2020]
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
    gdf = gdf.drop(columns=['validOn', 'validTo'])
    gdf['date'] = gdf['date'].dt.date.astype(str)

    dry_level = CategoricalDtype(["extremely dry", "dry", "normal range", "wet", "extremely wet"], ordered=True)
    gdf['classification'] = gdf['classification'].astype(dry_level)
    gdf = gdf.sort_values(by='classification')

    # Convert the GeoDataFrame to GeoJSON
    return gdf.to_json()

    # js_dir = "../public/data/geojson"
    # with open(f"{js_dir}/ecuador.json", "w") as file:
    #     file.write(geojson_to_map)
