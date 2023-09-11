from tethys_sdk.base import TethysAppBase


class GeoglowsDashboard(TethysAppBase):
    """
    Tethys app class for Geoglows Dashboard.
    """

    name = 'Geoglows Dashboard'
    description = ''
    package = 'geoglows_dashboard'  # WARNING: Do not change this value
    index = 'home'
    icon = f'{package}/images/icon.gif'
    root_url = 'geoglows-dashboard'
    color = '#435334'
    tags = ''
    enable_feedback = False
    feedback_emails = []