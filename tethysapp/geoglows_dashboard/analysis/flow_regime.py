import pandas as pd
import plotly.graph_objs as go
from plotly.offline import plot as offline_plot


def stream_estimate(df, val):
    # Find the row with percentile <= 0.87
    lower_row = df[df['percentile'] <= val].iloc[-1]

    # Find the row with percentile > 0.87
    upper_row = df[df['percentile'] > val].iloc[0]

    # Linear interpolation formula
    percentile_lower = lower_row['percentile']
    percentile_upper = upper_row['percentile']
    streamflow_lower = lower_row['streamflow_m^3/s']
    streamflow_upper = upper_row['streamflow_m^3/s']
    target_percentile = val

    streamflow_estimate = (
            (streamflow_upper - streamflow_lower) /
            (percentile_upper - percentile_lower) *
            (target_percentile - percentile_lower) +
            streamflow_lower
    )
    return streamflow_estimate


def plot_flow_regime(hist, selected_year):
    """_summary_

    Args:
        reach_id (string): stream id
        desired_year (string): desired year
        hist (csv):the csv response from historic_simulation
    """
    
    hdf = hist.copy()
    hdf = hdf[hdf.index.year >= 1991]
    hdf = hdf[hdf.index.year <= 2020]

    highflow = []
    above_normal = []
    normal = []
    below_normal = []
    
    for i in range(1, 13):
        filtered_month = hist[hist.index.month == i]
        filtered_month_mean = filtered_month.groupby(filtered_month.index.year).mean()
        avg = hdf.groupby(hdf.index.month).mean()
        filtered_month_mean["ratio"] = filtered_month_mean["streamflow_m^3/s"] / avg['streamflow_m^3/s'][i]
        filtered_month_mean["rank"] = filtered_month_mean["ratio"].rank()
        filtered_month_mean["percentile"] = filtered_month_mean["rank"] / (len(filtered_month_mean["rank"]) + 1)
        filtered_month_mean.sort_values(by='percentile', inplace=True)

        highflow.append(stream_estimate(filtered_month_mean, 0.87))
        above_normal.append(stream_estimate(filtered_month_mean, 0.72))
        normal.append(stream_estimate(filtered_month_mean, 0.28))
        below_normal.append(stream_estimate(filtered_month_mean, 0.13))
        # lowflow.append(stream_estimate(filtered_month_mean, 0.87))
        
    year_data = hist[hist.index.year == selected_year]
    months = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"]
    dataframe = pd.DataFrame(months)
    dataframe["high"] = highflow
    dataframe["above"] = above_normal
    dataframe["normal"] = normal
    dataframe["below"] = below_normal
    dataframe["year"] = year_data.groupby(year_data.index.month).mean().reset_index().drop("datetime", axis=1)
    
    # draw the plots
    scatter_plots = []
    scatter_plots.append(go.Scatter(x=dataframe[0], y=dataframe['below'], fill='tozeroy', fillcolor='rgba(205, 35, 63, 0.5)', mode='none', name="below"))
    scatter_plots.append(go.Scatter(x=dataframe[0], y=dataframe['normal'], fill='tonexty', fillcolor='rgba(255, 168, 133, 0.5)', mode='none', name="normal"))
    scatter_plots.append(go.Scatter(x=dataframe[0], y=dataframe['above'], fill='tonexty', fillcolor='rgba(231, 226, 188, 0.5)', mode='none', name="above"))
    scatter_plots.append(go.Scatter(x=dataframe[0], y=dataframe['high'], fill='tonexty', fillcolor='rgba(142, 206, 238, 0.5)', mode='none', name="high"))
    scatter_plots.append(go.Scatter(x=dataframe[0], y=dataframe['high'] * 2, fill='tonexty', fillcolor='rgba(44, 125, 205, 0.5)', mode='none', name="high * 2"))

    for col in dataframe.columns[1:]:
        if col == "year":
            plot = go.Scatter( name=col, x=dataframe[0], y=dataframe[col], mode="lines", line=dict(color="black", width=2))
        else:
            plot = go.Scatter( name=col, x=dataframe[0], y=dataframe[col], mode="lines",line=dict(color="gray", width=1), showlegend=False)
        scatter_plots.append(plot)


    layout = go.Layout(
        # title=f"{selected_year} Monthly Streamflow with HydroSOS",
        title=None,
        yaxis={'title': 'Discharge'},
        xaxis={'title': 'Month of Year'},
        margin={'t': 0}
    )
    
    figure = go.Figure(scatter_plots, layout=layout)    
    
    return offline_plot(
        figure,
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )