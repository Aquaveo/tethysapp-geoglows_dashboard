import ee
import datetime
from datetime import timedelta
import pandas as pd
import numpy as np
import calendar
import plotly.graph_objs as go
from plotly.subplots import make_subplots
from plotly.offline import plot as offline_plot


class GEEPlots:
    def __init__(self, start, end, area):
        self.start = start
        self.end = end
        self.area = area
        self.has_gldas_data = False
        
    
    def clip_to_bounds(self, img):
        return img.updateMask(ee.Image.constant(1).clip(self.area).mask())
    
    
    def avg_in_bounds(self, img):
        return img.set('avg_value', img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=self.area,
        ))
        
    
    def get_gldas_data(self):
        gldas_ic = ee.ImageCollection("NASA/GLDAS/V021/NOAH/G025/T3H")
        gldas_monthly = ee.ImageCollection(
            [f'users/rachelshaylahuber55/gldas_monthly/gldas_monthly_avg_{i:02}' for i in range(1, 13)])
        gldas_monthly = gldas_monthly.map(self.avg_in_bounds)

        gldas_avg_df = pd.DataFrame(
            gldas_monthly.aggregate_array('avg_value').getInfo(),
        )
        # TODO start date or only the year?
        gldas_avg_df['datetime'] = [datetime.datetime(year=int(self.start[:4]), month=gldas_avg_df.index[i] + 1, day=15)
                                        for i in gldas_avg_df.index]
        gldas_avg_df['date'] = gldas_avg_df['datetime'].dt.strftime("%Y-%m-%d")
        gldas_avg_df.index = pd.to_datetime(gldas_avg_df["date"])
        gldas_avg_df['Rainf_tavg'] = gldas_avg_df['Rainf_tavg']
        days_in_month = np.array([calendar.monthrange(int(self.start[:4]), i)[1] for i in range(1, 13)])
        gldas_avg_df['Rainf_tavg'] = gldas_avg_df['Rainf_tavg'].cumsum() * days_in_month * 86400
        
        gldas_ytd = gldas_ic.select(["Rainf_tavg", "RootMoist_inst"]).filterDate(self.start, self.end).map(self.clip_to_bounds).map(self.avg_in_bounds)
        gldas_ytd_df = pd.DataFrame(
            gldas_ytd.aggregate_array('avg_value').getInfo(),
            index=pd.to_datetime(np.array(gldas_ytd.aggregate_array('system:time_start').getInfo()) * 1e6)
        )
        gldas_ytd_df['Rainf_tavg'] = (gldas_ytd_df['Rainf_tavg'] * 10800).cumsum()
        gldas_ytd_df.index = pd.to_datetime(gldas_ytd_df.index)
        gldas_ytd_df = gldas_ytd_df.groupby(gldas_ytd_df.index.date).mean()
        
        date_generated_gldas = pd.date_range(self.start, periods=365)
        cum_df_gldas = pd.DataFrame(date_generated_gldas)
        values_list = []
        for date in cum_df_gldas[0]:
            i = 1
            for val in gldas_avg_df["Rainf_tavg"]:
                if date.month == i:
                    values_list.append(val * 86400)  # it is a rate per second - 86400 seconds in day convert to per day
                i = i + 1
        cum_df_gldas['val_per_day'] = values_list
            # code will look for columns names 'date' and 'data_values' so rename to those
        cum_df_gldas['date'] = cum_df_gldas[0].dt.strftime("%Y-%m-%d")
        cum_df_gldas["data_values"] = cum_df_gldas['val_per_day']
        
        self.gldas_ytd_df = gldas_ytd_df
        self.gldas_avg_df = gldas_avg_df
        self.cum_df_gldas = cum_df_gldas
        self.has_gldas_data = True
        
    
    def plot_gldas_precip_and_soil_moisture(self):
        if not self.has_gldas_data:
            self.get_gldas_data()
        self.gldas_avg_df['date'] = pd.to_datetime(self.gldas_avg_df['date'])
        self.cum_df_gldas['date'] = pd.to_datetime(self.cum_df_gldas['date'])
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        fig.add_trace(go.Bar(x=self.cum_df_gldas['date'], y=-self.cum_df_gldas['data_values'], marker_color="#0d61cb", opacity=0.7, name="Precipitation"))
        fig.update_yaxes(title_text='Precipitation (mm)')

        fig.add_trace(go.Scatter(x=self.gldas_avg_df['date'], y=self.gldas_avg_df['RootMoist_inst'], marker_color="rgb(0.2, 0.2, 0.2)", name='Soil Moisture'), secondary_y=True)
        fig.update_layout(
            yaxis2=dict(
                title='Soil Moisture (kg/m^2)',
                overlaying='y',
                side='right',
                # range=[100, 300] # TODO don't hardcode
            )
        )

        # Set x-axis date formatting
        fig.update_xaxes(
            tickformat='%Y-%m-%d',
            dtick='M1',
            tickangle=-45
        )

        # Add title and legend
        fig.update_layout(
            title=None,
            margin={"t": 0},
            xaxis={'title': 'Date'},
            legend=dict(x=0.05, y=0.05)
        )

        return offline_plot(
            fig,
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
        
    
    def plot_gldas_precipitation(self):
        if not self.has_gldas_data:
            self.get_gldas_data()
            
        scatter_plots = []
        scatter_plots.append(go.Scatter(x=self.gldas_ytd_df.index, y=self.gldas_ytd_df['Rainf_tavg'], name='Values from the last 12 months'))
        scatter_plots.append(go.Scatter(x=self.gldas_avg_df.index, y=self.gldas_avg_df['Rainf_tavg'], name='Average Values since 2000'))

        layout = go.Layout(
            title=None,
            margin={"t": 0, "b": 0, "r": 0, "l": 0},
            # title=f"Precipitation in Kasungu, Malawi using GLDAS",
            yaxis={'title': 'Precipitation (mm)'},
            xaxis={'title': 'Date'},
            legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01, bgcolor='rgba(255, 255, 255, 0.6)')
        )
        
        return offline_plot(
            go.Figure(scatter_plots, layout),
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
        
        
    def plot_gldas_soil_moisture(self):
        if not self.has_gldas_data:
            self.get_gldas_data()
            
        scatter_plots = []
        scatter_plots.append(go.Scatter(x=self.gldas_ytd_df.index, y=self.gldas_ytd_df['RootMoist_inst'], name='Values from the last 12 months'))
        scatter_plots.append(go.Scatter(x=self.gldas_avg_df.index, y=self.gldas_avg_df['RootMoist_inst'], name='Average Values since 2000'))

        layout = go.Layout(
            title=None,
            # title=f"Root Zone Soil Moisture in Kasungu, Malawi using GLDAS",
            yaxis={'title': 'Soil Moisture (kg/m^2)'},
            xaxis={'title': 'Date'},
            margin={"t": 0, "b": 0, "r": 0, "l": 0},
            legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01, bgcolor='rgba(255, 255, 255, 0.6)')
        )
        
        return offline_plot(
            go.Figure(scatter_plots, layout),
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
        
        
    def get_imerg_data(self):
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


    def plot_imerg_precipitation(self):
        self.get_imerg_data()
        scatter_plots = []
        scatter_plots.append(go.Scatter(x=self.imerg_ytd_df.index, y=self.imerg_ytd_df['data_values'], name='Values from the last 12 months'))
        scatter_plots.append(go.Scatter(x=self.imerg_df.index, y=self.imerg_df['data_values'], name='Average Values since 2000'))
        layout = go.Layout(
            # title=f"Precipitation in Kasungu, Malawi using IMERG",
            title=None,
            yaxis={'title': 'Precipitation (mm)'},
            xaxis={'title': 'Date'},
            margin={"t": 0, "b": 0, "r": 0, "l": 0},
            legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01, bgcolor='rgba(255, 255, 255, 0.6)')
        )
        return offline_plot(
            go.Figure(scatter_plots, layout),
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
        
        
    def get_era5_data(self):
        # read in img col of averages
        img_col_avg = ee.ImageCollection(
            [f'users/rachelshaylahuber55/era5_monthly_avg/era5_monthly_updated_{i:02}' for i in range(1, 13)])

        # get year-to-date averages
        era_ic = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY")
        era_ytd_values_ic = era_ic.select(["total_precipitation"]).filterDate(self.start, self.end).map(self.avg_in_bounds)

        # create dataframe from image collection
        era_ytd_df = pd.DataFrame(
            era_ytd_values_ic.aggregate_array('avg_value').getInfo(),
            index=pd.to_datetime(np.array(era_ytd_values_ic.aggregate_array('system:time_start').getInfo()) * 1e6),
        )

        # group  hourly values by date
        era_ytd_df = era_ytd_df.groupby(era_ytd_df.index.date).mean()
        avg_img = img_col_avg.select(["total_precipitation"]).map(self.avg_in_bounds)
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
        self.era5_avg_df = avg_df


    def plot_era5_precipitation(self):
        self.get_era5_data()
        scatter_plots = []
        scatter_plots.append(go.Scatter(x=self.era_ytd_df.index, y=self.era_ytd_df['data_values'], name='Values from the last 12 months'))
        scatter_plots.append(go.Scatter(x=self.era5_avg_df.index, y=self.era5_avg_df['data_values'], name='Average Values since 2000'))
        layout = go.Layout(
            title=None,
            # title=f"Precipitation in Kasungu, Malawi using ERA5",
            yaxis={'title': 'Precipitation (mm)'},
            xaxis={'title': 'Date'},
            margin={"t": 0, "b": 0, "r": 0, "l": 0},
            legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01, bgcolor='rgba(255, 255, 255, 0.6)')
        )
        return offline_plot(
            go.Figure(scatter_plots, layout),
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )


    def plot_gfs_forecast_data(self):
        current_date = datetime.datetime.now().date()
        one_week_ago = current_date - timedelta(days=7)
        future_date = current_date + timedelta(days=2)
        future_date_string = future_date.strftime("%Y-%m-%d")
        one_week_ago_string = one_week_ago.strftime("%Y-%m-%d")
        ic = ee.ImageCollection("NOAA/GFS0P25").filterDate(one_week_ago_string, future_date_string)
        last_time = ic.sort('system:time_start', False).first()
        data_collection = ee.ImageCollection("NOAA/GFS0P25");
        forecast_date = ee.Date(last_time.get('system:time_start'))
        forecast00 = data_collection.filterDate(forecast_date,forecast_date.advance(6,'hour'))#.filter(ee.Filter.lt('forecast_time',forecast_date.advance(1,'day').millis()))
        new_ic = forecast00.filterMetadata('forecast_hours', 'greater_than', 0).select("total_precipitation_surface").map(self.avg_in_bounds)
        df = pd.DataFrame(
            new_ic.aggregate_array('avg_value').getInfo(),
            index = pd.to_datetime(np.array(new_ic.aggregate_array('forecast_time').getInfo())*1e6)
        )
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=df.index, y = df["total_precipitation_surface"]))
        fig.update_layout(
            xaxis={'title': 'Date'},
            margin={"t": 0, "b": 0, "r": 0, "l": 0}
        )
        return offline_plot(
            fig,
            config={'autosizable': True, 'responsive': True},
            output_type='div',
            include_plotlyjs=False
        )
        
        
    def get_plot(self, plot_name):
        # TODO cache the gldas data so it can be reused
        match plot_name:
            case "gldas-precip-soil":
                return self.plot_gldas_precip_and_soil_moisture()
            case "gldas-soil":
                return self.plot_gldas_soil_moisture()
            case "gldas-precip":
                return self.plot_gldas_precipitation()
            case "imerg-precip":
                return self.plot_imerg_precipitation()
            case "era5-precip":
                return self.plot_era5_precipitation()
            case "gfs-forecast":
                return self.plot_gfs_forecast_data()
            
