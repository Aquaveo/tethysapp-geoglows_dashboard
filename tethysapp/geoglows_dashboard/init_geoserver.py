import os
from jinja2 import Template

from tethysapp.geoglows_dashboard.app import GeoglowsDashboard as app


gs_engine = app.get_spatial_dataset_service('primary_geoserver', as_engine=True)
sql_engine = app.get_persistent_store_database('country_db')
gs_engine.create_workspace(workspace_id='geoglows_dashboard', uri='http:www.example.com/apps/geoglows-dashboard')
gs_engine.link_sqlalchemy_db_to_geoserver(
    store_id="geoglows_dashboard:hydrosos_streamflow",
    sqlalchemy_engine=sql_engine,
    docker=True
)

# sql_template_path = os.path.join(os.path.dirname(__file__), 'resources', 'sql_templates', 'hydrosos_streamflow_layer.sql')
sql_template_path = 'resources/sql_templates/hydrosos_streamflow_layer.sql'
sql_context = {}
with open(sql_template_path, 'r') as sql_template_file:
    text = sql_template_file.read()
    template = Template(text)
    sql = ' '.join(template.render(sql_context).split())

gs_engine.create_sql_view_layer(
    store_id="geoglows_dashboard:hydrosos_streamflow",
    layer_name="hydrosos_streamflow_layer",
    geometry_name="geometry",
    geometry_type="Geometry",
    srid=4326,
    sql=sql,
    default_style="hydrosos_streamflow:HydroSOS Streamflow Width",
    parameters=(
        {
            'name': 'selected_month',
            'default_value': '2015-01-01',
            'regex_validator': '^\d{4}-\d{2}-\d{2}$'
        },
    )
)