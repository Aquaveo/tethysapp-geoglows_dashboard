import ee
from tethys_sdk.routing import controller
from django.http import JsonResponse
from ..analysis.hydrosos.hydrosos_streamflow import compute_hydrosos_streamflow_layer


@controller(name="get_hydrosos_streamflow_layer", url="get_hydrosos_streamflow_layer")
def get_hydrosos_streamflow_layer(request):
    year, month, _ = request.GET["date"].split("-")
    return JsonResponse(compute_hydrosos_streamflow_layer(int(year), int(month)), safe=False)
