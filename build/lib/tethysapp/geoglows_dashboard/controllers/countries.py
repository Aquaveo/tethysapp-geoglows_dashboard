
import json

from tethys_sdk.routing import controller
from django.http import JsonResponse

from ..model import add_new_country, get_all_countries, remove_country, update_default_country_in_db
from ..analysis.hydrosos.compute_country_dry_level import compute_country_dry_level


@controller(name='get_country_dry_level', url='get_country_dry_level')
def get_country_dry_level(request):
    country = request.GET["country"]
    date = request.GET["date"]
    type = request.GET["type"]
    year, month, _ = date.split("-")
    return JsonResponse(compute_country_dry_level(country, int(year), int(month), type), safe=False)


# TODO this function also do remove country and get all countries. The function name is confusing
@controller(name="country", url="country")
def add_country(request):
    if request.method == "POST":
        data = json.loads(request.body.decode('utf-8'))
        country = data["country"]
        is_default = data["isDefault"]
        add_new_country(country, is_default)
        return JsonResponse(dict(res=f"{country} is added!"))
    elif request.method == "GET":
        countries = get_all_countries()
        countries_dict = {}
        for country in countries:
            countries_dict[country.name] = {"default": country.default}
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
    update_default_country_in_db(country)
    return JsonResponse(dict(res=f"{country} is set as default!"))
