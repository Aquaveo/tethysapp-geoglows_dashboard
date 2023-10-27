import ee
import datetime
import pandas as pd
import numpy as np
import calendar
import plotly.graph_objs as go
from plotly.offline import plot as offline_plot


class GLDASSoilMoistureAndPrecipitation:
  def __init__(self, area, start, end):
    self.area = ee.Geometry.Point(area)
    self.start = start
    self.end = end

  def clip_to_bounds(self, img):  # TODO util method
    return img.updateMask(ee.Image.constant(1).clip(self.area).mask())

  def avg_gldas(self, img):  # TODO util method
    return img.set('avg_value', img.reduceRegion(
          reducer=ee.Reducer.mean(),
          geometry=self.area,
      ))

  def get_gldas_data(self):
    gldas_ic = ee.ImageCollection("NASA/GLDAS/V021/NOAH/G025/T3H")
    gldas_monthly = ee.ImageCollection(
        [f'users/rachelshaylahuber55/gldas_monthly/gldas_monthly_avg_{i:02}' for i in range(1, 13)])
    gldas_monthly = gldas_monthly.map(self.avg_gldas)

    gldas_avg_df = pd.DataFrame(
        gldas_monthly.aggregate_array('avg_value').getInfo(),
    )
    gldas_avg_df['datetime'] = [datetime.datetime(year=int(self.start[:4]), month=gldas_avg_df.index[i] + 1, day=15)
                                    for i in gldas_avg_df.index]
    gldas_avg_df['date'] = gldas_avg_df['datetime'].dt.strftime("%Y-%m-%d")
    gldas_ytd = gldas_ic.select(["Rainf_tavg", "RootMoist_inst"]).filterDate(self.start, self.end).map(self.clip_to_bounds).map(self.avg_gldas)
    gldas_ytd_df = pd.DataFrame(
      gldas_ytd.aggregate_array('avg_value').getInfo(),
      index=pd.to_datetime(np.array(gldas_ytd.aggregate_array('system:time_start').getInfo()) * 1e6)
    )

    gldas_ytd_df['Rainf_tavg'] = (gldas_ytd_df['Rainf_tavg'] * 10800).cumsum()
    gldas_ytd_df.index = pd.to_datetime(gldas_ytd_df.index)
    gldas_ytd_df = gldas_ytd_df.groupby(gldas_ytd_df.index.date).mean()
    gldas_avg_df.index = pd.to_datetime(gldas_avg_df["date"])
    gldas_avg_df['Rainf_tavg'] = gldas_avg_df['Rainf_tavg']
    days_in_month = np.array([calendar.monthrange(int(self.start[:4]), i)[1] for i in range(1, 13)])
    gldas_avg_df['Rainf_tavg'] = gldas_avg_df['Rainf_tavg'].cumsum() * days_in_month * 86400
    self.gldas_ytd_df = gldas_ytd_df
    self.gldas_avg_df = gldas_avg_df

  def plot_soil_moisture(self):
    scatter_plots = []
    scatter_plots.append(go.Scatter(x=self.gldas_ytd_df.index, y=self.gldas_ytd_df['RootMoist_inst'], name='Values from the last 12 months'))
    scatter_plots.append(go.Scatter(x=self.gldas_avg_df.index, y=self.gldas_avg_df['RootMoist_inst'], name='Average Values since 2000'))

    layout = go.Layout(
        title=f"Root Zone Soil Moisture in Kasungu, Malawi using GLDAS",
        yaxis={'title': 'Soil Moisture (kg/m^2)'},
        xaxis={'title': 'Date'},
    )
    
    return offline_plot(
        go.Figure(scatter_plots, layout),
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )


  def plot_precipitation(self):
    scatter_plots = []
    scatter_plots.append(go.Scatter(x=self.gldas_ytd_df.index, y=self.gldas_ytd_df['Rainf_tavg'], name='Values from the last 12 months'))
    scatter_plots.append(go.Scatter(x=self.gldas_avg_df.index, y=self.gldas_avg_df['Rainf_tavg'], name='Average Values since 2000'))

    layout = go.Layout(
        title=f"Precipitation in Kasungu, Malawi using GLDAS",
        yaxis={'title': 'Precipitation (mm)'},
        xaxis={'title': 'Date'},
    )
    
    return offline_plot(
        go.Figure(scatter_plots, layout),
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )

