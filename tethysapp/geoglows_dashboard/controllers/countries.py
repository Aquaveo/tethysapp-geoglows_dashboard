
import json

from tethys_sdk.routing import controller
from django.http import JsonResponse

from .helpers import parse_hydrosos_data
from ..model import add_new_country, get_all_countries, remove_country, update_default_country_db
from ..analysis.hydrosos.compute_country_dry_level import compute_country_dry_level


@controller(name='get_country_dry_level', url='get_country_dry_level')
def get_country_dry_level(request):
    country = request.GET["country"]
    date = request.GET["date"]
    type = request.GET["type"]
    year, month, _ = date.split("-")
    return JsonResponse(compute_country_dry_level(country, int(year), int(month), type), safe=False)


@controller(name="country", url="country")
def add_country(request):
    if request.method == "POST":
        data = json.loads(request.body.decode('utf-8'))
        country = data["country"]
        geojson = data["geoJSON"]
        precip = data["precip"]
        soil = data["soil"]
        is_default = data["isDefault"]
        hydrosos_data = parse_hydrosos_data(geojson, precip, soil)
        add_new_country(country, hydrosos_data, is_default)
        return JsonResponse(dict(res=f"{country} is added!"))
    elif request.method == "GET":
        countries = get_all_countries()
        countries_dict = {}
        for country in countries:
            countries_dict[country.name] = {"hydrosos": country.hydrosos, "default": country.default}
        return JsonResponse(dict(data=json.dumps(countries_dict)))
    elif request.method == "DELETE":
        data = json.loads(request.body.decode('utf-8'))
        country = data["country"]
        remove_country(country)
        return JsonResponse(dict(res=f"{country} is removed!"))


@controller(name="update_default_country", url="country/default")
def update_default_country(request):
    data = json.loads(request.body.decode('utf-8'))
    country = data["country"]
    update_default_country_db(country)
    return JsonResponse(dict(res=f"{country} is set as default!"))
