# SERVIR EA - Geoglows Dashboard

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

3. Download the databases and put them under the specified paths:

    | Dataset                                                      | Path                                                         |
    | ------------------------------------------------------------ | ------------------------------------------------------------ |
    | [combined_all_data_122.nc](https://byu.app.box.com/s/j67orkjccn2u0bgwe38bj2dxy4yuo3xp) | `tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/workspaces/app_workspace/hydrosos/streamflow/vpu_122` |


4. Install this app in Tethys:

    ```
    conda activate tethys
    cd tethysapp-geoglows_dashboard
    tethys install -d
    ```

### Set Up the Database
1. Download the Docker Desktop for your laptop: https://www.docker.com/products/docker-desktop/

2. Download the PostGIS docker:

   ```shell
   sudo docker run --name=tethys_postgis --env=POSTGRES_PASSWORD=mysecretpassword -p 5435:5432 -d postgis/postgis:12-2.5
   ```

3. Go to `~/.tethys/portal_config.yml` to set the PostgreSQL as the default database. 

   ```
     DATABASES:
       default:
         ENGINE: django.db.backends.postgresql
         NAME: tethys_platform
         USER: tethys_default
         PASSWORD: pass
         HOST: localhost
         PORT:  5435
   ```

   Please note that if you are using an environment other than `tethys`, such as `tethys3` or `tethys4`, you'll need to navigate to the root folder of that environment and make changes to its `portal_config.yml` file.

4. Run the following command to configure the database:

   ```
   PGPASSWORD=mysecretpassword tethys db configure
   ```

5. Add a Persistent Store Service to Tethys Portal: 

   - Go to Tethys Portal Home in a web browser (e.g. http://localhost:8000/apps/)
   - Select **Site Admin** from the drop down next to your username.
   - Scroll down to the **Tethys Services** section and select **Persistent Store Services** link.
   - Click on the **Add Persistent Store Service** button.
   - Give the **Persistent Store Service** any name and fill out the connection information.
     - Note: The username and password for the persistent store service must be a superuser to use spatial persistent stores. Note that the default installation of Tethys Portal includes a superuser named "tethys_super", password: "pass".
   - Press **Save** to create the new **Persistent Store Service**.

   <img src="./tethysapp/geoglows_dashboard/public/images/persistent store service.png" alt="persisten store service" style="zoom:50%;" />

6. Assign the new **Persistent Store Service** to the Geoglows Dashboard App:

   - Go to Tethys Portal Home in a web browser (e.g. http://localhost:8000/apps/)
   - Select **Site Admin** from the drop down next to your username.
   - Scroll down to the **Tethys Apps** section and select the **Installed App** link.
   - Select the **Geoglows Dashboard** link.
   - Scroll down to the **Persistent Store Database Settings** section.
   - Assign the **Persistent Store Service** that you created in the last step to the **primary_db** setting.
   - Press **Save** to save the settings.

7. View the database in [pgAdmin](https://www.pgadmin.org/download/)

   - Right click "Servers" on the top left, then click "Register" -> "Server"

     <img src="./tethysapp/geoglows_dashboard/public/images/pgAdmin connection.jpg" alt="pgAdmin Connection" />

   - In the General tab, put any Name that you want

   - In the Connection tab, fill in the Port, Username, and Password the same as step 6

   - Click "Save" to connect

   - Navigate to the table to see the data: 

     <img src="./tethysapp/geoglows_dashboard/public/images/pgAdmin tables.jpg" alt="pgAdmin Tables" />

8. Add the `postgis` extension to the database:

   - Right click the `geoglows_dashboard_primary_db` database -> Create -> Extension
   - In the General tab, use drop down menu to choose the "postgis" extension, then Save 

9. Execute the **syncstores** command to create the tables in the Persistent Store database: 

   ```shell
   tethys syncstores geoglows_dashboard
   ```

10. Load the data to the database:
   - Enter the folder `tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard`
   - Run the command `tethys manage shell < init_database.py`, then wait for 3~6 hours for it to be finished

### Set Up the GeoServer 

1. Install `tethys_databset_services`:

   ```bash
   conda install -c conda-forge tethys_dataset_services
   ```

2. Create `SpatialDatasetService` if one does not already exist

   - Ener the **Site Admin** page
   - Scroll down to the **Tethys Services** section of the Admin Interface and select the link titled **Spatial Dataset Services**.
   - Click on the **Add Spatial Dataset Service** button.
   - Fill in the connection information to the database server.
     - Note, the default username is `admin`, password is `geoserver`
   - Press the **Save** button to save the new `SpatialDatasetService`.

   <img src="./tethysapp/geoglows_dashboard/public/images/geoserver-setting.jpg" style="zoom:50%;" />

3. Assign sptial dataset services

   - Go back to the **Site Admin** page
   - Scroll down to the **Tethys Apps** section and select the **Installed App** link.
   - Select the **Geoglows Dashboard** link.
   - Scroll down to the **Spatial Dataset Services Settings** section and and locate the `SpatialDatasetServiceSetting`
   - Assign the appropriate `SpatialDatasetService` to your `SpatialDatasetServiceSetting` using the drop down menu in the **Spatial Dataset Service** column.
   - Press the **Save** button at the bottom of the page to save your changes.

4. Start the geoserver docker container: 

   - If you haven't created the geoserver docker container: `tethys docker init -c geoserver`
   - Start the container: `tethys docker start -c geoserver`

5. Run the following script to create a HydroSOS Streamflow Layer in GeoServer, which will be used in the app: 

   - Enter the folder `tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard`
   - Run the command: `tethys manage shell < init_geoserver.py`

### Run the app!

1. Run the app in Tethys:
    ```
    tethys manage start
    ```

2. Browse to http://127.0.0.1:8000/apps in a web browser and login. The default portal user is:
    - username: admin
    - password: pass

3. If all has gone well, you should see the app listed on the app library page. Click on the app tile to launch it.
