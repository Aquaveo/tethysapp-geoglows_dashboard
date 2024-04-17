import xarray
import scipy.stats as stats
import numpy as np
import json
from shapely.geometry import shape
import pandas as pd

from tethysapp.geoglows_dashboard.model import add_new_river_bulk, add_new_river_hydrosos_bulk


def get_hydrosos_data_sample(all_data, monthly_data, year, month, rivids):
    filtered_data = all_data["ds_grouped_avg"].sel(
        variable="Qout",
        time=(all_data["ds_grouped_avg"]["time"].dt.month == month) &
             (all_data["ds_grouped_avg"]["time"].dt.year == year)
    )
    month_df = filtered_data.to_dataframe().reset_index()
    average_df = monthly_data["monthly_average"].to_dataframe().reset_index()
    average_df = average_df[(average_df["variable"] == "Qout") & (average_df["month"] == month)]
    std_df = monthly_data["monthly_std_dev"].to_dataframe().reset_index()
    std_df = std_df[(std_df["variable"] == "Qout") & (std_df["month"] == month)]
    merged_df = month_df.merge(average_df[['rivid', 'monthly_average']], on='rivid', how='left'). \
        drop_duplicates(["rivid"]).reset_index()
    merged_df = merged_df.merge(std_df[['rivid', 'monthly_std_dev']], on='rivid', how='left')
    # Calculate Z-score for ds_grouped_avg using mean and standard deviation
    merged_df['z_score'] = (merged_df['ds_grouped_avg'] - merged_df['monthly_average']) / merged_df['monthly_std_dev']

    # Calculate exceedance probability using the cumulative distribution function (CDF)
    merged_df['probability'] = stats.norm.cdf(merged_df['z_score'])
    # Define the categories and corresponding colors
    categories = ["extremely dry", "dry", "normal range", "wet", "extremely wet"]

    # Map the exceedance_probability values to categories
    merged_df['category'] = np.select(
        [merged_df['probability'] >= 0.87,
         (merged_df['probability'] >= 0.72) & (merged_df['probability'] < 0.87),
         (merged_df['probability'] >= 0.28) & (merged_df['probability'] < 0.72),
         (merged_df['probability'] >= 0.13) & (merged_df['probability'] < 0.28),
         merged_df['probability'] < 0.13],
        categories, default="unknown"
    )

    merged_df = merged_df[merged_df["rivid"].isin(rivids)].rename(columns={'time': 'month'})
    merged_df['month'] = merged_df['month'].dt.strftime('%Y-%m-01')

    return merged_df[["rivid", "month", "category"]]


app_workspace_dir = "../../workspaces/app_workspace"

# TODO how to put if __name__ == '__main__': in this file?
# insert river samples
rivers_geojson = json.load(open(f"{app_workspace_dir}/hydrosos_streamflow_geometry.geojson"))
rivers, rivids = [], []
for river in rivers_geojson["features"]:
    properties = river["properties"]
    rivid = properties["rivid"]
    rivers.append({
        'id': rivid,
        'stream_order': properties["strmOrder"],
        'geometry': f"SRID=4326;{shape(river['geometry']).wkt}"
    })
    rivids.append(rivid)
add_new_river_bulk(rivers)
print("all river geometry is inserted!")

# insert hydrosos data for above river samlples
all_data = xarray.open_dataset(f"{app_workspace_dir}/combined_all_data_101.nc")
monthly_data = xarray.open_dataset(f"{app_workspace_dir}/combined_monthly_data.nc")
start_year, end_year = 1940, 2022
df_hydrosos_data = pd.DataFrame()
for year in range(start_year, end_year + 1):
    for month in range(1, 13):
        df_hydrosos_data_sample = get_hydrosos_data_sample(all_data, monthly_data, year, month, rivids)
        df_hydrosos_data = pd.concat([df_hydrosos_data, df_hydrosos_data_sample], ignore_index=True)
    print(f"{year} is done with processing!")
    if year % 10 == 0 or year == end_year:
        add_new_river_hydrosos_bulk(df_hydrosos_data.to_dict(orient='records'))
        df_hydrosos_data = pd.DataFrame()
        print(f"{year} is inserted!")
