import pyogrio
import xarray
import scipy.stats as stats
import numpy as np

from  tethysapp.geoglows_dashboard.model import add_new_river_bulk, add_new_river_hydrosos_bulk


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
    merged_df = month_df.merge(average_df[['rivid', 'monthly_average']], on='rivid', how='left').drop_duplicates(["rivid"]).reset_index()
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
    
    return merged_df
            

app_workspace_dir = "../../workspaces/app_workspace"

# TODO how to put if __name__ == '__main__': in this file?

# randomly select 1000 rivers for year 2012 ~ 2022

# insert river samples
df_river = pyogrio.read_dataframe(f"{app_workspace_dir}/hydrosos_streamflow_geometry.geojson")
df_river_sample = df_river.sample(1000)
df_river_sample['geometry'] = df_river_sample['geometry'].astype(str)
df_river_sample.rename(columns={'rivid': 'id'}, inplace=True)
river_sample_dict = df_river_sample.to_dict(orient='records')
add_new_river_bulk(river_sample_dict)
print("all river geometry is inserted!")

# insert hydrosos data for above river samlples
all_data = xarray.open_dataset(f"{app_workspace_dir}/combined_all_data_101.nc")
monthly_data = xarray.open_dataset(f"{app_workspace_dir}/combined_monthly_data.nc")
rivids = df_river_sample['id'].tolist()
start_year, end_year = 2012, 2022
for year in range(start_year, end_year + 1):
    for month in range(1, 13):
        df_hydrosos_data_sample = get_hydrosos_data_sample(all_data, monthly_data, year, month, rivids)
        add_new_river_hydrosos_bulk(df_hydrosos_data_sample.to_dict(orient='records'))
    print(f"{year}-{0 if month < 10 else ''}{month}-01 is done!")
