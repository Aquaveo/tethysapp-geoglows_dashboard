from datetime import date, datetime
import pandas as pd
import ee
import plotly.graph_objs as go
from plotly.subplots import make_subplots
from plotly.offline import plot as offline_plot


class PrecipitationAndSoilMoisturePlots:
    def __init__(self, area, start, end):
        self.area = area
        self.start = start
        self.end = end
        
        
    @staticmethod
    def get_date():
        now = date.today().strftime("%Y-%m-%d")
        y2d_start = date(date.today().year, 1, 1).strftime("%Y-%m-%d")
        return now, y2d_start
    
    
    def clip_to_bounds(self, img):
        return img.updateMask(ee.Image.constant(1).clip(self.area).mask())


    def avg_gldas(self, img):
        return img.set('avg_value', img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=self.area
        ))
        
    
    def get_gldas_data(self):
        now, y2d_start = PrecipitationAndSoilMoisturePlots.get_date()
        gldas_monthly = ee.ImageCollection(
            [f'users/rachelshaylahuber55/gldas_monthly/gldas_monthly_avg_{i:02}' for i in range(1, 13)])
        gldas_monthly = gldas_monthly.map(self.avg_gldas)

        gldas_avg_df = pd.DataFrame(
            gldas_monthly.aggregate_array('avg_value').getInfo(),
        )
        gldas_avg_df['datetime'] = [datetime(year=int(now[:4]), month=gldas_avg_df.index[i] + 1, day=15)
                                        for i in gldas_avg_df.index]
        gldas_avg_df['date'] = gldas_avg_df['datetime'].dt.strftime("%Y-%m-%d")
        date_generated_gldas = pd.date_range(y2d_start, periods=365)
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
        self.gldas_avg_df = gldas_avg_df
        self.cum_df_gldas = cum_df_gldas
        
    
    def plot_gldas_precip_and_soil_moisture(self, gldas_avg_df, cum_df_gldas):
        self.get_gldas_data()
        gldas_avg_df['date'] = pd.to_datetime(gldas_avg_df['date'])
        cum_df_gldas['date'] = pd.to_datetime(cum_df_gldas['date'])
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        fig.add_trace(go.Bar(x=cum_df_gldas['date'], y=-cum_df_gldas['data_values'], marker_color="#0d61cb", opacity=0.7, name="Precipitation"))
        fig.update_yaxes(title_text='Precipitation (mm)')

        fig.add_trace(go.Scatter(x=gldas_avg_df['date'], y=gldas_avg_df['RootMoist_inst'], marker_color="rgb(0.2, 0.2, 0.2)", name='Soil Moisture'), secondary_y=True)
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
            tickformat='%b',
            dtick='M1',
            tickangle=-45
        )

        # Add title and legend
        fig.update_layout(
            title=None,
            margin={"t": 0},
            xaxis={'title': 'Date'},
            legend = dict(x=0.05, y=0.05)
        )

        return fig