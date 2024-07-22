import ee
from tethys_sdk.routing import controller
from django.http import JsonResponse
from ..analysis.hydrosos.hydrosos_streamflow import compute_hydrosos_streamflow_layer
from ..analysis.gee.gee_map_layer import GEEMapLayer


@controller(name="get_hydrosos_streamflow_layer", url="get_hydrosos_streamflow_layer")
def get_hydrosos_streamflow_layer(request):
    year, month, _ = request.GET["date"].split("-")
    return JsonResponse(compute_hydrosos_streamflow_layer(int(year), int(month)), safe=False)


@controller(name='get_gee_map_layer', url='get_gee_map_layer')
def get_gee_map_layer(request):
    area = ee.Geometry.Polygon(
        [[12.433899230380394, 1.2502984485255044], [15.246399230380394, -10.641022352451941],
         [15.949524230380394, -22.737541753468385], [18.762024230380394, -30.885123250790635],
         [26.496399230380394, -29.057956188967015], [33.87921173038039, -21.434519240512245],
         [37.39483673038039, -14.074627325782883], [36.34014923038039, -5.421182829476382],
         [41.26202423038039, 0.547264369136003], [46.88702423038039, 6.509784171738834],
         [42.31671173038039, 9.988478071051889], [37.39483673038039, 15.472887767295823],
         [34.93389923038039, 22.4497599999652], [30.363586730380394, 30.314223455550316],
         [25.090149230380394, 29.70536422289729], [26.144836730380394, 23.09806434509904],
         [21.222961730380394, 14.794151647354017], [13.840149230380394, 8.252960159280674],
         [12.433899230380394, 1.2502984485255044]]
    )
    url = GEEMapLayer(area).main()
    return JsonResponse(dict(url=url))
