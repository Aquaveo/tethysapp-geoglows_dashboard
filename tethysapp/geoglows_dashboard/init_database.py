import xarray
import scipy.stats as stats
import numpy as np
import json
from shapely.geometry import shape

from tethysapp.geoglows_dashboard.model import add_new_river_bulk, add_new_river_hydrosos_bulk, add_new_country


class HydroSOSRiverDataInitializer:
    def __init__(self, data_dir, vpu):
        self.data_dir = data_dir
        self.vpu = vpu

    def insert_geometry_data(self):
        rivers_features = json.load(open(self.data_dir + f"river_features_{self.vpu}.geojson"))
        rivers = []
        for river in rivers_features["features"]:
            properties = river["properties"]
            rivid = properties["rivid"]
            rivers.append({
                'id': rivid,
                'stream_order': properties["strmOrder"],
                'geometry': f"SRID=4326;{shape(river['geometry']).wkt}",
                'river_country': properties['RiverCountry']
            })
        add_new_river_bulk(rivers)
        print("all river geometry is inserted!")

    def insert_hydrosos_data(self):
        all_data = xarray.open_dataset(self.data_dir + f"combined_all_data_{self.vpu}.nc")
        monthly_data = xarray.open_dataset(self.data_dir + f"combined_monthly_data_{self.vpu}.nc")
        df_avg = monthly_data.monthly_average.sel(variable="Qout").to_dataframe().reset_index()
        df_std = monthly_data.monthly_std_dev.sel(variable="Qout").to_dataframe().reset_index()
        df_stat = df_avg[['rivid', 'month', 'monthly_average']].merge(
            df_std[['rivid', 'month', 'monthly_std_dev']], on=['rivid', 'month'], how='outer'
        )

        def get_hydrosos_data_sample(start_year, end_year):
            df_filtered_data = all_data["ds_grouped_avg"].sel(
                variable="Qout",
                time=(all_data["ds_grouped_avg"]["time"].dt.year >= start_year) &
                (all_data["ds_grouped_avg"]["time"].dt.year < end_year)
            ).to_dataframe().reset_index()
            df_filtered_data = df_filtered_data.drop_duplicates(['time', 'rivid'])
            df_filtered_data['year'] = df_filtered_data['time'].dt.year
            df_filtered_data['month'] = df_filtered_data['time'].dt.month
            df_filtered_data = df_filtered_data[['time', 'year', 'month', 'rivid', 'ds_grouped_avg']]

            df_merge = df_filtered_data.merge(
                df_stat[['rivid', 'month', 'monthly_average', 'monthly_std_dev']], on=['rivid', 'month'], how='left'
            )
            df_merge['z_score'] = (
                (df_merge['ds_grouped_avg'] - df_merge['monthly_average']) / df_merge['monthly_std_dev']
            )
            df_merge['probability'] = stats.norm.cdf(df_merge['z_score'])

            # Map the exceedance_probability values to categories
            categories = ["extremely dry", "dry", "normal range", "wet", "extremely wet"]
            df_merge['category'] = np.select(
                [df_merge['probability'] >= 0.87,
                    (df_merge['probability'] >= 0.72) & (df_merge['probability'] < 0.87),
                    (df_merge['probability'] >= 0.28) & (df_merge['probability'] < 0.72),
                    (df_merge['probability'] >= 0.13) & (df_merge['probability'] < 0.28),
                    df_merge['probability'] < 0.13],
                categories, default="unknown"
            )
            df_merge['time'] = df_merge['time'].dt.strftime('%Y-%m-01')
            df_merge = df_merge.drop(columns=['year', 'month']).rename(columns={'time': 'month'})
            return df_merge[["rivid", "month", "category"]]

        df_time = all_data['time'].to_dataframe()
        df_time['year'] = df_time['time'].dt.year
        years = np.sort(df_time['year'].unique())

        for i in range(len(years)):
            year = years[i]
            print(f"processing year {year} ...")
            df_hydrosos_data = get_hydrosos_data_sample(year, year + 1)
            print(f"inserting year {year} ...")
            add_new_river_hydrosos_bulk(df_hydrosos_data.to_dict(orient='records'))
            print(f"year {year} is inserted!")
            
    def insert_default_country(self):
        add_new_country("All Countries", True)
        print("Set 'All Countries' as default")

    def insert_all_data(self):
        self.insert_default_country()
        self.insert_geometry_data()
        self.insert_hydrosos_data()


vpu = 122
data_dir = f"workspaces/app_workspace/hydrosos/streamflow/vpu_{vpu}/"
initializer = HydroSOSRiverDataInitializer(data_dir, vpu)
initializer.insert_all_data()
