import logging
import ee
from ee.ee_exception import EEException
import os
from ..app import GeoglowsDashboard as app  # where is GeloglowsDashboard?? TODO


log = logging.getLogger(f'tethys.apps.{__name__}')

def gee_initialization():
    service_account = app.get_custom_setting('service_account_email')
    private_key_path = app.get_custom_setting('private_key_file')

    if service_account and private_key_path and os.path.isfile(private_key_path):
        try:
            credentials = ee.ServiceAccountCredentials(service_account, private_key_path)
            ee.Initialize(credentials)
            log.info('Successfully initialized GEE using service account.')
        except EEException as e:
            log.warning('Unable to initialize GEE using service account. If installing ignore this warning.')
    else:
        try:
            ee.Initialize()
        except EEException as e:
            log.warning('Unable to initialize GEE with local credentials. If installing ignore this warning.')