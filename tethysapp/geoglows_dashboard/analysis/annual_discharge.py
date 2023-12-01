import numpy as np
import s3fs
import xarray
import plotly.graph_objs as go
from plotly.offline import plot as offline_plot


def plot_annual_discharge_volumes(reach_id):
    bucket_uri = 's3://geoglows-v2/retro.zarr'
    region_name = 'us-west-2'
    s3 = s3fs.S3FileSystem(anon=True, client_kwargs=dict(region_name=region_name))
    s3store = s3fs.S3Map(root=bucket_uri, s3=s3, check=False)
    ds = xarray.open_zarr(s3store)

    df = ds['Qout'].sel(rivid=reach_id).to_dataframe()
    df = df.reset_index().set_index('time').pivot(columns='rivid', values='Qout')

    # group by year and calculate the cumulative volumes
    annual_volumes = df.groupby(df.index.year).sum()
    annual_volumes = annual_volumes * 60 * 60 * 24 / 1_000_000  # m^3/s to m3/day to millions of m^3/day

    # use a linear trendline to look for long term changes in volume
    linear_fits = np.polyfit(annual_volumes.index, annual_volumes.values, 1)
    annual_volumes['trendline'] = (annual_volumes.index * linear_fits[0]) + linear_fits[1]
    # TODO cache the data annual_volumes
    scatter_plots = []
    scatter_plots.append(go.Scatter(x=annual_volumes.index, y=annual_volumes[reach_id], name=reach_id))
    scatter_plots.append(go.Scatter(x=annual_volumes.index, y=annual_volumes["trendline"], name="trendline"))
    layout = go.Layout(
        title="Annual Discharge Volumes vs Time",
        yaxis={"title": "Annual Water Volumes (MillionMeters<sup>3</sup>)"},
        xaxis={"title": "Time"},
        margin={"t": 0, "b": 0, "r": 0, "l": 0}
    )
    # TODO return an error message when there's an exception
    return offline_plot(
        go.Figure(scatter_plots, layout),
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )
