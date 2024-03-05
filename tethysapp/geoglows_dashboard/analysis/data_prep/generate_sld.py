from jinja2 import Environment, FileSystemLoader

categories = [
    {"value": "extremely dry" , "color": "#CD233F"},
    {"value": "dry", "color": "#FFA885"},
    {"value": "normal range", "color": "#E7E2BC"},
    {"value": "wet", "color": "#8ECEEE"},
    {"value": "extremely wet", "color": "#2C7DCD"}
]
stream_orders = [i for i in range(2, 9)]

env = Environment(loader=FileSystemLoader("../../resources/sld_templates"))
template = env.get_template("hydrosos_streamflow_layer.xml")

filename = "hydrosos_streamflow_layer_sld.xml"
context = {
    "categories": categories,
    "stream_orders": stream_orders
}

with open(filename, mode="w") as output:
    output.write(template.render(context))