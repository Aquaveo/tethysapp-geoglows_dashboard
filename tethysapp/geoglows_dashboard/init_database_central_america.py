import pandas as pd
import numpy as np
import xarray as xr
import os
import json
from shapely.geometry import shape

from tethysapp.geoglows_dashboard.model import (
    HydroSOSCategory, add_new_river_bulk, add_new_river_hydrosos_bulk, add_new_country
)
from tethysapp.geoglows_dashboard.app import GeoglowsDashboard as app


class HydroSOSDataInitializer:
    def __init__(self, data_path, stdStart, stdEnd):
        self.data_path = data_path
        self.stdStart = stdStart
        self.stdEnd = stdEnd

    def insert_hydrosos_data(self):
        os.environ["AWS_NO_SIGN_REQUEST"] = "YES"
        # Get link numbers
        countries = ["Belize", "Panama", "Costa Rica", "El Salvador", "Guatemala", "Honduras", "Nicaragua"]
        df_river_country = pd.read_parquet(
            "s3://geoglows-v2/tables/v2-countries-table.parquet",
            storage_options={'anon': True}
        )
        df_river_country = df_river_country[df_river_country['RiverCountry'].isin(countries)]
        linkno_benchmark = set(df_river_country["LINKNO"])
        linkno = []
        for vpu in ["716", "614", "701"]:
            linkno_raw = pd.read_parquet(
                f"s3://rfs-v2/routing-configs/vpu={vpu}/routing_parameters.parquet",
                storage_options={"anon": True}
            )["river_id"].to_numpy()
            linkno.extend([x for x in linkno_raw if x in linkno_benchmark])

        # Get flow data
        month_timeseries = xr.open_zarr('s3://rfs-v2/retrospective/monthly-timeseries.zarr',
                                        storage_options={'anon': True})
        flowdata = month_timeseries.sel(river_id=linkno).to_dataframe().unstack(level='river_id')
        flowdata.columns = flowdata.columns.droplevel(0)
        flowdata["month"] = flowdata.index.month
        flowdata["year"] = flowdata.index.year
        flowdata = flowdata.reset_index()
        river_ids = flowdata.columns[1:-2]
        results = []
        for i in range(len(river_ids)):
            river_id = river_ids[i]
            river_df = flowdata[['time', 'year', 'month', river_id]] \
                .rename(columns={river_id: 'flow', 'time': 'date'}).dropna()
            # Calculate Long-Term Average (LTA)
            lta = river_df[(river_df['year'] >= self.stdStart) & (river_df['year'] <= self.stdEnd)] \
                .groupby('month')['flow'].mean()
            # Compute mean monthly flows as a percentage of LTA using transform (vectorized)
            river_df['percentile_flow'] = river_df['flow'] / river_df['month'].map(lta).replace({np.nan: pd.NA}) * 100
            # Compute Weibull rank percentiles in a vectorized way
            river_df['weibell_rank'] = (
                river_df.groupby('month')['percentile_flow']
                .rank(method='average', na_option='keep') /
                (river_df.groupby('month')['percentile_flow'].transform('count') + 1)
            )
            conditions = [
                river_df['weibell_rank'] <= 0.13,
                river_df['weibell_rank'] <= 0.28,
                river_df['weibell_rank'] <= 0.71999,
                river_df['weibell_rank'] <= 0.86999,
                river_df['weibell_rank'] > 0.86999,
            ]
            choices = [HydroSOSCategory('extremely dry'), HydroSOSCategory('dry'),
                       HydroSOSCategory('normal range'), HydroSOSCategory('wet'), HydroSOSCategory('extremely wet')]
            river_df['category'] = np.select(conditions, choices, default=None)
            river_df['river_id'] = river_id
            river_df = river_df.drop(columns=['year', 'month', 'flow', 'percentile_flow', 'weibell_rank'])
            river_df = river_df[river_df['date'] >= '2000-01-01']
            results.append(river_df)
            if i != 0 and (i % 1000 == 0 or i == len(river_ids) - 1):
                df = pd.concat(results, ignore_index=True)
                add_new_river_hydrosos_bulk(df.to_dict(orient='records'))
                results = []
                print(f'Hydrosos data {i} is inserted! (progress: {i / len(river_ids): .1%})')

    def insert_river_data(self):
        rivers_features = json.load(open(self.data_path))
        rivers = []
        for river in rivers_features["features"]:
            properties = river["properties"]
            rivid = properties["LINKNO"]
            rivers.append({
                'id': rivid,
                'stream_order': properties["strmOrder"],
                'geometry': f"SRID=4326;{shape(river['geometry']).wkt}",
                'river_country': properties['RiverCountry'],
                'vpu': int(properties['vpu'])
            })
        add_new_river_bulk(rivers)
        print("All river data is inserted!")

    def insert_default_country(self):
        add_new_country(
            name="All Countries",
            region=app.get_custom_setting('region'),
            is_default=True,
            subbasins_data=None,
            hydrostations_data=None
        )
        print("Set 'All Countries' as default")

    def insert_all_data(self):
        self.insert_default_country()
        self.insert_river_data()
        self.insert_hydrosos_data()


data_path = "workspaces/app_workspace/hydrosos/streamflow/central_america/rivers_central_america.geojson"
initializer = HydroSOSDataInitializer(data_path, 1990, 2020)
initializer.insert_all_data()
