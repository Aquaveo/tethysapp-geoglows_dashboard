from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import CustomSetting, PersistentStoreDatabaseSetting


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
    
    def custom_settings(self):
        """
        Custom settings.
        """
        custom_settings = (
            CustomSetting(
                name='service_account_email',
                type=CustomSetting.TYPE_STRING,
                description='Email associated with the service account.',
                default='',
                required=False,
            ),
            CustomSetting(
                name='private_key_file',
                type=CustomSetting.TYPE_STRING,
                description='Path to service account JSON file containing the private key.',
                default='',
                required=False,
            ),
        )
        return custom_settings
    
    
    def persistent_store_settings(self):
        ps_settings = (
            PersistentStoreDatabaseSetting(
                name='country_db',
                description='Country database for HydroSOS Layers of Geoglows Dashboard',
                initializer='geoglows_dashboard.model.init_country_db',
                required=True
            ),
        )
        return ps_settings