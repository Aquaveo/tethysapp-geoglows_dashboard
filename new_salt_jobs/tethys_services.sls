{% set TETHYS_PERSIST = salt['environ.get']('TETHYS_PERSIST') %}

{% set TETHYS_DB_HOST = salt['environ.get']('TETHYS_DB_HOST') %}
{% set TETHYS_DB_PORT = salt['environ.get']('TETHYS_DB_PORT') %}
{% set TETHYS_DB_SUPERUSER = salt['environ.get']('TETHYS_DB_SUPERUSER') %}
{% set TETHYS_DB_SUPERUSER_PASS = salt['environ.get']('TETHYS_DB_SUPERUSER_PASS') %}

{% set TETHYS_DB_USERNAME = salt['environ.get']('TETHYS_DB_USERNAME') %}
{% set TETHYS_DB_PASS = salt['environ.get']('TETHYS_DB_PASS') %}

{% set POSTGIS_SERVICE_NAME = 'country_inventory' %}
{% set POSTGIS_SERVICE_URL = TETHYS_DB_SUPERUSER + ':' + TETHYS_DB_SUPERUSER_PASS + '@' + TETHYS_DB_HOST + ':' + TETHYS_DB_PORT %}

{% set TETHYS_GS_HOST = salt['environ.get']('TETHYS_GS_HOST') %}
{% set TETHYS_GS_PASSWORD = salt['environ.get']('TETHYS_GS_PASSWORD') %}
{% set TETHYS_GS_PORT = salt['environ.get']('TETHYS_GS_PORT') %}
{% set TETHYS_GS_USERNAME = salt['environ.get']('TETHYS_GS_USERNAME') %}
{% set TETHYS_GS_PROTOCOL = salt['environ.get']('TETHYS_GS_PROTOCOL') %}
{% set TETHYS_GS_HOST_PUB = salt['environ.get']('TETHYS_GS_HOST_PUB') %}
{% set TETHYS_GS_PORT_PUB = salt['environ.get']('TETHYS_GS_PORT_PUB') %}
{% set TETHYS_GS_PROTOCOL_PUB = salt['environ.get']('TETHYS_GS_PROTOCOL_PUB') %}
{% set TETHYS_GS_URL = TETHYS_GS_PROTOCOL +'://' + TETHYS_GS_USERNAME + ':' + TETHYS_GS_PASSWORD + '@' + TETHYS_GS_HOST + ':' + TETHYS_GS_PORT %}
{% set TETHYS_GS_URL_PUB = TETHYS_GS_PROTOCOL_PUB +'://' + TETHYS_GS_USERNAME + ':' + TETHYS_GS_PASSWORD + '@' + TETHYS_GS_HOST_PUB + ':' + TETHYS_GS_PORT_PUB %}
{% set GS_SERVICE_NAME = 'primary_geoserver' %}

{% set PORT_SEPARATOR = salt['environ.get']('PORT_SEPARATOR') %}

Create_PostGIS_Database_Service:
    cmd.run:
        - name: "tethys services create persistent -n {{ POSTGIS_SERVICE_NAME }} -c {{ POSTGIS_SERVICE_URL }}"
        - shell: /bin/bash
        - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/tethys_services_complete" ];"

Link_PostGIS_Database_Service:
    cmd.run:
        - name: "tethys link persistent:{{ POSTGIS_SERVICE_NAME }} geoglows_dashboard:ps_database:primary_db"
        - shell: /bin/bash
        - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/tethys_services_complete" ];"

Sync_Persistent_Stores:
    cmd.run:
        - name: tethys syncstores geoglows_dashboard
        - shell: /bin/bash
        - unless: /bin/bash -c "[ -f "${TETHYS_PERSIST}/tethys_services_complete" ];"

Create_Spatial_Dataset_Service:
    cmd.run:
        - name: "tethys services create spatial -t GeoServer -n {{ GS_SERVICE_NAME }} -c admin:geoserver@http://geoserver:8181/geoserver/rest -p http://localhost:8181/geoserver/rest"
        - shell: /bin/bash
        - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/tethys_services_complete" ];"

Link_Spatial__Dataset_Service:
    cmd.run:
        - name: "tethys link spatial:{{ GS_SERVICE_NAME }} geoglows_dashboard:ds_spatial:primary_geoserver"
        - shell: /bin/bash
        - unless: /bin/bash -c "[ -f "${TETHYS_PERSIST}/tethys_services_complete" ];"

Flag_Tethys_Services_Setup_Complete:
  cmd.run:
    - name: touch {{ TETHYS_PERSIST }}/tethys_services_complete
    - shell: /bin/bash
    - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/tethys_services_complete" ];"
