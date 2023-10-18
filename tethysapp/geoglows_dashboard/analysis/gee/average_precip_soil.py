from datetime import date, datetime
import pandas as pd
import numpy as np
import ee
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import matplotlib.dates as mdates


class AveragePrecipitationAndSoilMoisture:
    def __init__(self, area):
        self.area = area
        

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
            geometry=self.area,
        ))
        
        
    def get_gldas_data(self):
        now, y2d_start = AveragePrecipitationAndSoilMoisture.get_date()
        gldas_ic = ee.ImageCollection("NASA/GLDAS/V021/NOAH/G025/T3H")
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
        gldas_ytd = gldas_ic.select(["Rainf_tavg", "SoilMoi0_10cm_inst"]).filterDate(y2d_start, now).map(self.clip_to_bounds).map(
                self.avg_gldas)
        gldas_ytd_df = pd.DataFrame(
            gldas_ytd.aggregate_array('avg_value').getInfo(),
                index=pd.to_datetime(np.array(gldas_ytd.aggregate_array('system:time_start').getInfo()) * 1e6)
            )
        gldas_ytd_df['date'] = gldas_ytd_df.index.strftime("%Y-%m-%d")

        gldas_ytd_df['Rainf_tavg'] = (gldas_ytd_df['Rainf_tavg'] * 10800)
        #print(gldas_ytd_df)
        #gldas_ytd_df.index = pd.to_datetime(gldas_ytd_df['date'])

        gldas_ytd_df2= gldas_ytd_df
        gldas_ytd_df = gldas_ytd_df.groupby('date').mean()
        gldas_ytd_df2.index = pd.to_datetime(gldas_ytd_df2['date'])
        #print(gldas_ytd_df2)
        gldas_ytd_df2 = gldas_ytd_df2.groupby(gldas_ytd_df2.index.month).mean()

        gldas_ytd_df.rename(index={0: 'index'}, inplace=True)
        gldas_ytd_df['date'] = gldas_ytd_df.index

        gldas_ytd_df2.rename(index={0: 'index'}, inplace=True)
        gldas_ytd_df2['date'] = gldas_ytd_df2.index
        return cum_df_gldas, gldas_avg_df
        
        
    def plot_data(self, cum_df_gldas, gldas_avg_df):
        cum_df_gldas['date'] = pd.to_datetime(cum_df_gldas['date'])
        gldas_avg_df['date'] = pd.to_datetime(gldas_avg_df['date'])

        # plot the data on separate y-axes
        fig, ax1 = plt.subplots()

        ax1.set_xlabel('Date')
        ax1.set_ylabel('Precipitation (mm)')
        # plot blue bar graph
        bottom = ax1.get_ylim()[1]

        #the axis limits are hard coded right now and will need to be fixed to work with whatever data is put in

        ax1.bar(cum_df_gldas['date'], -cum_df_gldas['data_values'], width=7, align='center', color='#0d61cb', alpha=0.7, label='Precipitation', bottom=bottom)
        ax1.set_ylim(-17, 0)
        ax1.yaxis.set_major_formatter(ticker.FuncFormatter(lambda y, pos: '{:.0f}'.format(abs(y))))

        ax2 = ax1.twinx()

        ax2.set_ylabel('Soil Moisture (kg/m^2)')
        ax2.set_ylim(100, 300)
        ax2.plot(gldas_avg_df['date'], gldas_avg_df['RootMoist_inst'], color=(0.2, 0.2, 0.2), label='Soil Moisture')

        date_formatter = mdates.DateFormatter('%b')
        ax1.xaxis.set_major_formatter(date_formatter)

        # add legends
        handles1, labels1 = ax1.get_legend_handles_labels()
        handles2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(handles1+handles2, labels1+labels2, loc='lower left')

        plt.subplots_adjust(top=0.85, bottom=0.15)  # add padding between the two graphs

        plt.title('Averages in Tanzania for Precipitation and Soil Moisture')
        plt.show()
        
        
if __name__ == "__main__":
    area =  ee.Geometry.Polygon(
        [[[32.35177734545915, -4.673917894096025],
          [32.35177734545915, -5.746113966624088],
          [34.19748047045915, -5.746113966624088],
          [34.19748047045915, -4.673917894096025]]])

    obj = AveragePrecipitationAndSoilMoisture(area)
    obj.plot_data(*obj.get_gldas_data())