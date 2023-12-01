# SERVIR EA

## Run it locally

### Install the app

1. Install Tethys pltform:
- install [Miniconda](https://docs.conda.io/projects/miniconda/en/latest/) or Anaconda
- install `tethys-platform` with `conda`
```
conda create -n tethys -c tethysplatform -c conda-forge tethys-platform
```

2. Clone this project to your local computer:
```
git clone https://github.com/Aquaveo/tethysapp-geoglows_dashboard.git
```

3. Install this app in Tethys:
```
conda activate tethys
cd tethysapp-geoglows_dashboard
tethys install -d
```

### Set up Google Earth Engine

1. Create a service account registered with Google Earth Engine
- [How do I create a service account](https://developers.google.com/earth-engine/guides/service_account#how-do-i-create-a-service-account) 

2. Create Service Account Key
- See "1. Create Service Account Key" in this [tutorial](http://docs.tethysplatform.org/en/stable/tutorials/google_earth_engine/part_3/service_account.html)

3. Set Service Account Settings for the App
- see "2. Set Service Account Settings for the App" in this [tutorial](http://docs.tethysplatform.org/en/stable/tutorials/google_earth_engine/part_3/prepare.html)


### Run the app!

1. Run the app in Tethys:
```
tethys manage start
```

2. Browse to http://127.0.0.1:8000/apps in a web browser and login. The default portal user is:
- username: admin
- password: pass

3. If all has gone well, you should see the app listed on the app library page. Click on the app tile to launch it.