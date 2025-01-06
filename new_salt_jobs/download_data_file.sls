{% set DATA_FILE_DESTINATION = '/var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/workspaces/app_workspaces/hydrosos/streamflow/vpu_122' %}
{% set DATA_FILE_URL = 'https://geoglows-dashboard-data.s3.us-east-2.amazonaws.com/combined_all_data_122.nc' %}

EnsureDirectoryExists:
  file.directory:
    - name: /var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/workspaces/app_workspaces/hydrosos/streamflow/vpu_122
    - mode: 755
    - makedirs: True

VerifyFile:
  cmd.run:
    - name: ls -la /var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/workspaces/app_workspaces/hydrosos/streamflow/vpu_122
    - require:
      - file: EnsureDirectoryExists

DownloadFile: 
    cmd.run:
        - name: wget -O {{ DATA_FILE_DESTINATION }}/combined_all_data_122.nc {{ DATA_FILE_URL }}
        - shell: /bin/bash
        - require:
            - file: /var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/workspaces/app_workspaces/hydrosos/streamflow/vpu_122
