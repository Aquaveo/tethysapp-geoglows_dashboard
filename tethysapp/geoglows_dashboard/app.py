from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import PersistentStoreDatabaseSetting, SpatialDatasetServiceSetting, CustomSetting


class GeoglowsDashboard(TethysAppBase):
    """
    Tethys app class for Geoglows Dashboard.
    """

    name = 'Kenya River Basin Monitoring and Forecasting System'
    description = ''
    package = 'geoglows_dashboard'  # WARNING: Do not change this value
    index = 'home'
    icon = f'{package}/images/icon.png'
    root_url = 'geoglows-dashboard'
    color = '#435334'
    description = (
        'This is a river basin monitoring forecasting and application system that supports water resources assessment, '
        'planning and management decisions in Kenya. The System leverages on GEOGLOWS cyberinfrastructure and in-situ '
        'river flow information to generate over 80 years historical river flow data and flow regime hence key for '
        'water resources assessment as well as 15 days river flow forecast – key for flood early warning information '
        'and disaster risk reduction. The system has been developed through a collaborative effort Bringham Young '
        'University (BYU), the Ministry of Water, Sanitation and Irrigation, Water Resources Authority (WRA), Kenya '
        'Meteorological Department (KMD) Kenya Space Agency (KSA) and Nile Basin initiative through NASA SERVIR '
        'Eastern and Southern Africa or PREPARED.'
    )
    tags = ''
    enable_feedback = False
    feedback_emails = []

    def persistent_store_settings(self):
        ps_settings = (
            PersistentStoreDatabaseSetting(
                name='primary_db',
                description='Country database for HydroSOS Layers of Geoglows Dashboard',
                initializer='geoglows_dashboard.model.init_primary_db',
                required=True,
                spatial=True
            ),
        )
        return ps_settings

    def spatial_dataset_service_settings(self):
        sds_settings = (
            SpatialDatasetServiceSetting(
                name='primary_geoserver',
                description='GeoServer service for app to use.',
                engine=SpatialDatasetServiceSetting.GEOSERVER,
                required=True
            ),
        )
        return sds_settings

    def custom_settings(self):
        return (
            CustomSetting(
                name='region',
                type=CustomSetting.TYPE_STRING,
                description='Central America or Nile Basin',
                required=True,
                default='Nile Basin'
            ),
        )
