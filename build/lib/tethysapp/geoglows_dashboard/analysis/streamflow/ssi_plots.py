from datetime import datetime
import scipy.stats as stats
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.offline import plot as offline_plot
from ...controllers.helpers import get_newest_plot_data


def get_retrospective_data(reach_id):
    return get_newest_plot_data(reach_id, 'retrospective')


def get_SSI_data(df_retro):
    df_result = pd.DataFrame()
    for month in range(1, 13):
        monthly_average = df_retro.resample('M').mean()
        filtered_df = monthly_average[monthly_average.index.month == month].copy()
        df_mean = filtered_df.iloc[:, 0].mean()
        df_std_dev = filtered_df.iloc[:, 0].std()
        filtered_df['cumulative_probability'] = filtered_df.iloc[:, 0].apply(
            lambda x, df_mean=df_mean, df_std_dev=df_std_dev: 1-stats.norm.cdf(x, df_mean, df_std_dev)
        )
        filtered_df['probability_less_than_0.5'] = filtered_df['cumulative_probability'] < 0.5
        filtered_df['p'] = filtered_df['cumulative_probability']
        filtered_df.loc[filtered_df['cumulative_probability'] > 0.5, 'p'] = 1 - filtered_df['cumulative_probability']
        filtered_df['W'] = (-2 * np.log(filtered_df['p'])) ** 0.5
        C0 = 2.515517
        C1 = 0.802853
        C2 = 0.010328
        d1 = 1.432788
        d2 = 0.001308
        d3 = 0.001308
        filtered_df['SSI'] = filtered_df['W'] - (C0 + C1 * filtered_df['W'] + C2 * filtered_df['W'] ** 2) / (
                    1 + d1 * filtered_df['W'] + d2 * filtered_df['W'] ** 2 + d3 * filtered_df['W'] ** 3)
        filtered_df.loc[~filtered_df['probability_less_than_0.5'], 'SSI'] *= -1
        df_result = pd.concat([df_result, filtered_df])
    return df_result


def get_SSI_monthly_data(df, month):
    monthly_average = df.resample('M').mean()
    filtered_df = monthly_average[monthly_average.index.month == month].copy()
    mean = filtered_df.iloc[:, 0].mean()
    std_dev = filtered_df.iloc[:, 0].std()
    filtered_df['cumulative_probability'] = filtered_df.iloc[:, 0].apply(lambda x: 1-stats.norm.cdf(x, mean, std_dev))
    filtered_df['probability_less_than_0.5'] = filtered_df['cumulative_probability'] < 0.5
    filtered_df['p'] = filtered_df['cumulative_probability']
    filtered_df.loc[filtered_df['cumulative_probability'] > 0.5, 'p'] = 1 - filtered_df['cumulative_probability']
    filtered_df['W'] = (-2 * np.log(filtered_df['p'])) ** 0.5
    C0 = 2.515517
    C1 = 0.802853
    C2 = 0.010328
    d1 = 1.432788
    d2 = 0.001308
    d3 = 0.001308
    filtered_df['SSI'] = filtered_df['W'] - (C0 + C1 * filtered_df['W'] + C2 * filtered_df['W'] ** 2) / \
        (1 + d1 * filtered_df['W'] + d2 * filtered_df['W'] ** 2 + d3 * filtered_df['W'] ** 3)
    filtered_df.loc[~filtered_df['probability_less_than_0.5'], 'SSI'] *= -1
    return filtered_df


# TODO do I need to set since_year as a paraemeter?
def plot_ssi_each_month_since_year(reach_id, since_year):
    current_year = datetime.now().year
    assert 1941 <= since_year <= 2024 <= current_year, f'the year should be in range [1941, {current_year}]'

    df_retro = get_retrospective_data(reach_id)
    df_ssi = get_SSI_data(df_retro)
    df_ssi_sorted = df_ssi.sort_index()[str(since_year):]
    fig = go.Figure(go.Scatter(
        x=df_ssi_sorted.index,
        y=df_ssi_sorted['SSI'],
        mode='lines+markers',
        marker=dict(symbol='circle', color='blue', size=5)
    ))
    fig.update_layout(xaxis_title='Date', yaxis_title='SSI', margin={"t": 0, "b": 0, "r": 0, "l": 0})
    return offline_plot(
        fig,
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )


def plot_ssi_one_month_each_year(reach_id, month):
    assert 1 <= month <= 12, f'the month number is in valid: {month}'

    df_retro = get_retrospective_data(reach_id)
    df_ssi_month = get_SSI_monthly_data(df_retro, month)

    fig = go.Figure(go.Scatter(
        x=df_ssi_month.index,
        y=df_ssi_month['SSI'],
        mode='lines+markers',
        marker=dict(symbol='circle', color='blue', size=5)
    ))
    fig.update_layout(xaxis_title='Date', yaxis_title='SSI', margin={"t": 0, "b": 0, "r": 0, "l": 0})
    return offline_plot(
        fig,
        config={'autosizable': True, 'responsive': True},
        output_type='div',
        include_plotlyjs=False
    )
