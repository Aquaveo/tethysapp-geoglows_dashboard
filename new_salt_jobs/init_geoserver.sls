{% set TETHYS_PERSIST = salt['environ.get']('TETHYS_PERSIST') %}

Initiate_Geoserver:
    cmd.run: 
        - name: "tethys manage shell < /var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/init_geoserver.py"
        - shell: /bin/bash
        - cwd: /var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard
        - stream: True
        - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/init_geoserver_complete" ];"

Flag_Init_Geoserver_Complete:
  cmd.run:
    - name: touch {{ TETHYS_PERSIST }}/init_geoserver_complete
    - shell: /bin/bash
    - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/init_geoserver_complete" ];"
    - require:
      - cmd: Initiate_Geoserver