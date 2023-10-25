import ee
import datetime
import pandas as pd
import numpy as np
import calendar
import plotly.graph_objs as go
from plotly.offline import plot as offline_plot


class ERA5Precipitation:
    def __init__(self, area, start, end):
        self.area = ee.Geometry.Point(area)
        self.start = start
        self.end = end


    def avg_era(self, img):
        return img.set('avg_value', img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=self.area,
        ))


    def get_data(self):
        # read in img col of averages
        img_col_avg = ee.ImageCollection(
            [f'users/rachelshaylahuber55/era5_monthly_avg/era5_monthly_updated_{i:02}' for i in range(1, 13)])

        # get year-to-date averages
        era_ic = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY")
        era_ytd_values_ic = era_ic.select(["total_precipitation"]).filterDate(self.start, self.end).map(self.avg_era)

        # create dataframe from image collection
        era_ytd_df = pd.DataFrame(
            era_ytd_values_ic.aggregate_array('avg_value').getInfo(),
            index=pd.to_datetime(np.array(era_ytd_values_ic.aggregate_array('system:time_start').getInfo()) * 1e6),
        )

        # group  hourly values by date
        era_ytd_df = era_ytd_df.groupby(era_ytd_df.index.date).mean()
        avg_img = img_col_avg.select(["total_precipitation"]).map(self.avg_era)
        avg_df = pd.DataFrame(
            avg_img.aggregate_array('avg_value').getInfo(),
        )

        # set date and data values columns that the js code will look for
        avg_df.columns = ["data_values"]
        avg_df['datetime'] = [datetime.datetime(year=int(self.start[:4]), month=avg_df.index[i] + 1, day=15) for i in avg_df.index]
        avg_df.reset_index(drop=True, inplace=True)
        # set year to date values
        era_ytd_df.columns = ["data_values"]
        # loop through the dataframe and move necessary dates for averages in new order if doing last 12 months. Current
        # month is assumed 12 (meaning it will not be moved), but is reset to be the current month if the last 12 months
        # were selected.
        curr_month = 12
        # change date to be a string value that can be easily graphed.
        era_ytd_df['date'] = era_ytd_df.index
        era_ytd_df['date'] = pd.to_datetime(era_ytd_df["date"])
        era_ytd_df['date'] = era_ytd_df['date'].dt.strftime("%Y-%m-%d")

        avg_df.sort_values(by='datetime', inplace=True)
        avg_df.reset_index(inplace=True)
        avg_df['date'] = avg_df['datetime'].dt.strftime("%Y-%m-%d")

        # rearrange dataframe to account for last 12 months if necessary
        # Then sum the values for precipitation
        days_in_month = np.array([calendar.monthrange(int(self.start[:4]), i)[1] for i in range(1, 13)])
        for i in range(12 - curr_month):
            extra_val = days_in_month[11]
            days_in_month = np.delete(days_in_month, 11, 0)
            days_in_month = np.insert(days_in_month, 0, extra_val)
        avg_df['data_values'] = avg_df['data_values'] * days_in_month * 1000
        avg_df['data_values'] = avg_df['data_values'].cumsum()

        era_ytd_df["data_values"] = (era_ytd_df["data_values"] * 1000).cumsum()
        avg_df.index = pd.to_datetime(avg_df["date"])

        self.era_ytd_df = era_ytd_df
        self.avg_df = avg_df


    def plot_data(self):
        scatter_plots = []
        scatter_plots.append(go.Scatter(x=self.era_ytd_df.index, y=self.era_ytd_df['data_values'], name='Values from the last 12 months'))
        scatter_plots.append(go.Scatter(x=self.avg_df.index, y=self.avg_df['data_values'], name='Average Values since 2000'))
        layout = go.Layout(
            title=f"Precipitation in Kasungu, Malawi using ERA5",
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
    
