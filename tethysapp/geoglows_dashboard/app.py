from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import PersistentStoreDatabaseSetting, SpatialDatasetServiceSetting


class GeoglowsDashboard(TethysAppBase):
    """
    Tethys app class for Geoglows Dashboard.
    """

    name = 'Nile River Basin Regional Monitoring and Forecasting System with GEOGLOWS'
    description = ''
    package = 'geoglows_dashboard'  # WARNING: Do not change this value
    index = 'home'
    icon = f'{package}/images/icon.png'
    root_url = 'geoglows-dashboard'
    color = '#435334'
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
