{% set TETHYS_PERSIST = salt['environ.get']('TETHYS_PERSIST') %}

Initiate_River_Tables:
    cmd.run: 
        - name: "tethys manage shell < /var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/init_database.py"
        - shell: /bin/bash
        - cwd: /var/www/tethys/apps/tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard
        - stream: True
        - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/tethys_river_tables_complete" ];"

Flag_Init_River_Tables_Complete:
  cmd.run:
    - name: touch {{ TETHYS_PERSIST }}/init_river_tables_complete
    - shell: /bin/bash
    - unless: /bin/bash -c "[ -f "{{ TETHYS_PERSIST }}/init_river_tables_complete" ];" 
    - require:
      - cmd: Initiate_River_Tables