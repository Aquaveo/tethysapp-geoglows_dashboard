import os


def compute_hydrosos_streamflow_layer(year, month):
    app_workspace_dir = os.path.join(os.path.dirname(__file__), "../../workspaces/app_workspace")
    filename = f"{year}-{0 if month < 10 else ''}{month}-01.json"
    filepath = f"{app_workspace_dir}/hydrosos_streamflow_by_month/{filename}"
    file = open(filepath, "r")
    return file.read()
