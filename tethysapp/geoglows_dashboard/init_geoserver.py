from jinja2 import Template

from tethysapp.geoglows_dashboard.app import GeoglowsDashboard as app


gs_engine = app.get_spatial_dataset_service('primary_geoserver', as_engine=True)
sql_engine = app.get_persistent_store_database('primary_db')

# create workspace
workspace_name = 'geoglows_dashboard'
store_name = 'hydrosos_streamflow'
style_name = 'hydrosos_streamflow_style'
try:
    gs_engine.create_workspace(workspace_id=workspace_name, uri='http:www.example.com/apps/geoglows-dashboard')
    print(f"workspace ({workspace_name}) is created!")
except Exception as e:
    print(e)

# connect the GeoServer to the PostgreSQL database
try:
    gs_engine.link_sqlalchemy_db_to_geoserver(
        store_id=f"{workspace_name}:{store_name}",
        sqlalchemy_engine=sql_engine,
        docker=True
    )
    print(f"workspace ({workspace_name}) is linked to store ({store_name})!")
except Exception as e:
    print(e)

# create the style layer in GeoServer

categories = [
    {"value": "EXTREMELY_DRY", "color": "#CD233F"},
    {"value": "DRY", "color": "#FFA885"},
    {"value": "NORMAL_RANGE", "color": "#E7E2BC"},
    {"value": "WET", "color": "#8ECEEE"},
    {"value": "EXTREMELY_WET", "color": "#2C7DCD"}
]
context = {
    "categories": categories,
    "stream_orders": [i for i in range(2, 10)]
}
try:
    gs_engine.create_style(
        style_id=f"{workspace_name}:{style_name}",
        sld_template="resources/sld_templates/hydrosos_streamflow_layer.xml",
        sld_context=context,
        overwrite=True
    )
    print(f"Style ({workspace_name}:{style_name}) is created!")
except Exception as e:
    print(e)

# create the sql view layer

sql_template_path = 'resources/sql_templates/hydrosos_streamflow_layer.sql'
sql_context = {}
with open(sql_template_path, 'r') as sql_template_file:
    text = sql_template_file.read()
    template = Template(text)
    sql = ' '.join(template.render(sql_context).split())
try:
    gs_engine.create_sql_view_layer(
        store_id=f"{workspace_name}:{store_name}",
        layer_name="hydrosos_streamflow_layer",
        geometry_name="geometry",
        geometry_type="Geometry",
        srid=4326,
        sql=sql,
        default_style=f"{workspace_name}:{style_name}",
        parameters=(
            {
                'name': 'selected_month',
                'default_value': '2015-01-01',
                'regex_validator': '^\d{4}-\d{2}-\d{2}$'  # noqa: W605
            },
            {
                'name': 'min_stream_order',
                'default_value': '2',
                'regex_validator': '^[2-8]$'  # noqa: W605
            },
            {
                'name': 'is_vpu',
                'default_value': 'False',
                'regex_validator': '^(True|true|False|false)$'
            },
            {
                'name': 'country',
                'default_value': 'Costa Rica',
                'regex_validator': "^.{0,100}$"
            }
        )
    )
    print("SQL view layer (hydrosos_streamflow_layer) is created!")
except Exception as e:
    print(e)
