import scipy.stats as stats
import xarray
import numpy as np
import xarray
import geopandas as gpd
import pyogrio
import json


def compute_hydrosos_streamflow_layer(year, month):
    app_workspace_dir = "../../workspaces/app_workspace"
    # time range: 1940-01 ~ 2022-12
    all_data = xarray.open_dataset(f"{app_workspace_dir}/combined_all_data_101.nc")
    monthly_data = xarray.open_dataset(f"{app_workspace_dir}/combined_monthly_data.nc")
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
    merged_df = month_df.merge(average_df[['rivid', 'monthly_average']], on='rivid', how='left').drop_duplicates(["rivid"]).reset_index()
    merged_df = merged_df.merge(std_df[['rivid', 'monthly_std_dev']], on='rivid', how='left')
    # Calculate Z-score for ds_grouped_avg using mean and standard deviation
    merged_df['z_score'] = (merged_df['ds_grouped_avg'] - merged_df['monthly_average']) / merged_df['monthly_std_dev']

    # Calculate exceedance probability using the cumulative distribution function (CDF)
    merged_df['probability'] = stats.norm.cdf(merged_df['z_score'])
    # Define the categories and corresponding colors
    categories = ["extremely dry", "dry", "normal range", "wet", "extremely wet"]

    # Map the exceedance_probability values to categories
    merged_df['classification'] = np.select(
        [merged_df['probability'] >= 0.87,
        (merged_df['probability'] >= 0.72) & (merged_df['probability'] < 0.87),
        (merged_df['probability'] >= 0.28) & (merged_df['probability'] < 0.72),
        (merged_df['probability'] >= 0.13) & (merged_df['probability'] < 0.28),
        merged_df['probability'] < 0.13],
        categories, default="unknown"
    )

    df_geometry = pyogrio.read_dataframe(f"{app_workspace_dir}/hydrosos_streamflow_geometry.geojson")
    merged_df = merged_df[["rivid", "classification"]].merge(df_geometry, how="inner")
    gdf = gpd.GeoDataFrame(merged_df)
    gdf = gdf.sort_values(by="strmOrder")
    grouped = gdf.groupby("strmOrder")
    geojson_lst = []
    for strmOrder, group_df in grouped:
        geojson_lst.append(group_df.to_json())
    output_path = f"{app_workspace_dir}/hydrosos_streamflow_by_month/{year}-{0 if month < 10 else ''}{month}-01.json"
    with open(output_path, "w") as file:
        json.dump(geojson_lst, file)
    print(f"{year}-{0 if month < 10 else ''}{month}-01 is done!")
    
    
if __name__ == "__main__":
    for year in range(1940, 2023):
        for month in range(1, 13):
            compute_hydrosos_streamflow_layer(year, month)
    print("Data Preprocessing is Done!")
