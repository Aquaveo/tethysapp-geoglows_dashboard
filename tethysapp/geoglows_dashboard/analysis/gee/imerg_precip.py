import ee
import datetime
import pandas as pd
import numpy as np
import calendar
import plotly.graph_objs as go
from plotly.offline import plot as offline_plot


class IMERGPrecipitation:
    def __init__(self, area, start, end):
        self.area = ee.Geometry.Point(area) 
        self.start = start
        self.end = end


    def avg_in_bounds(self, img):
        return img.set('avg_value', img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=self.area,
        ))


    def get_data(self):
        # get IMERG image collection from assets and then turn it into a dataframe
        imerg_1m_ic = ee.ImageCollection(
            [f'users/rachelshaylahuber55/imerg_monthly_avg/imerg_monthly_avg_{i:02}' for i in range(1, 13)])

        imerg_1m_values_ic = imerg_1m_ic.select('HQprecipitation').map(self.avg_in_bounds)

        imerg_df = pd.DataFrame(
            imerg_1m_values_ic.aggregate_array('avg_value').getInfo(),
        ).dropna()
        days_in_month = np.array([calendar.monthrange(int(self.start[:4]), i)[1] for i in range(1, 13)])

        imerg_df['datetime'] = [datetime.datetime(year=int(self.start[:4]), month=imerg_df.index[i] + 1, day=15) for i in
                                imerg_df.index]

        imerg_df['data_values'] = imerg_df['HQprecipitation']

        imerg_df['data_values'] = imerg_df['data_values'] * 24
        imerg_df['data_values'] = imerg_df['data_values'].cumsum() * days_in_month

        #imerg_df['date'] = imerg_df['datetime'].dt.strftime("%Y-%m-%d")
        imerg_df.index = pd.to_datetime(imerg_df["datetime"])

        # get IMERG values - they are grouped in 30 minute intervals
        imerg_30min_ic = ee.ImageCollection("NASA/GPM_L3/IMERG_V06")

        imerg_ytd_values_ic = imerg_30min_ic.select('HQprecipitation').filterDate(self.start, self.end).map(self.avg_in_bounds)

        imerg_ytd_df = pd.DataFrame(
            imerg_ytd_values_ic.aggregate_array('avg_value').getInfo(),
            index=pd.to_datetime(np.array(imerg_ytd_values_ic.aggregate_array('system:time_start').getInfo()) * 1e6),
        )
        # group half hourly values by day of the year
        imerg_ytd_df = imerg_ytd_df.groupby(imerg_ytd_df.index.date).mean()
        test_date = datetime.datetime.strptime(self.start, "%Y-%m-%d")

        # initializing K
        K = len(imerg_ytd_df.index)
        date_generated = pd.date_range(test_date, periods=K)
        # convert day-of-year to datetime, add 1 to day so it is plotted at self.end of day it represents
        imerg_ytd_df.index = date_generated
        imerg_ytd_df['data_values'] = imerg_ytd_df['HQprecipitation'].cumsum() * 24
        imerg_ytd_df['date'] = imerg_ytd_df.index.strftime("%Y-%m-%d")
        self.imerg_ytd_df = imerg_ytd_df
        self.imerg_df = imerg_df


    def plot_data(self):
        scatter_plots = []
        scatter_plots.append(go.Scatter(x=self.imerg_ytd_df.index, y=self.imerg_ytd_df['data_values'], name='Values from the last 12 months'))
        scatter_plots.append(go.Scatter(x=self.imerg_df.index, y=self.imerg_df['data_values'], name='Average Values since 2000'))
        layout = go.Layout(
            title=f"Precipitation in Kasungu, Malawi using IMERG",
            yaxis={'title': 'Precipitation (mm)'},
            xaxis={'title': 'Date'},
        )
        return offline_plot(
            go.Figure(scatter_plots, layout),
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
        
    def run(self):
        self.get_data()
        return self.plot_data()
    