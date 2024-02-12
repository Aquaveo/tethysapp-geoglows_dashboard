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

3. Download the data file [combined_all_data_101.nc]() and put it under the path `tethysapp-geoglows_dashboard/tethysapp/geoglows_dashboard/workspaces/app_workspace`

4. Install this app in Tethys:

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

### Database Settings
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

   <img src="./tethysapp/geoglows_dashboard/public/images/persistent store service.png" alt="image-20240208095349756" style="zoom:50%;" />

6. Assign the new **Persistent Store Service** to the Geoglows Dashboard App:

   - Go to Tethys Portal Home in a web browser (e.g. http://localhost:8000/apps/)
   - Select **Site Admin** from the drop down next to your username.
   - Scroll down to the **Tethys Apps** section and select the **Installed App** link.
   - Select the **Geoglows Dashboard** link.
   - Scroll down to the **Persistent Store Database Settings** section.
   - Assign the **Persistent Store Service** that you created in the last step to the **country_db** setting.
   - Press **Save** to save the settings.

7. Execute the **syncstores** command to create the tables in the Persistent Store database:

   ```shell
   tethys syncstores geoglows_dashboard
   ```

8. View the data in [pgAdmin](https://www.pgadmin.org/download/)

   - Right click "Servers" on the top left, then click "Register" -> "Server"

     <img src="./tethysapp/geoglows_dashboard/public/images/pgAdmin connection.jpg" alt="pgAdmin Connection" />

   - In the General tab, put any Name that you want

   - In the Connection tab, fill in the Port, Username, and Password the same as step 6

   - Click "Save" to connect

   - Navigate to the table to see the data: 

     <img src="./tethysapp/geoglows_dashboard/public/images/pgAdmin tables.jpg" alt="pgAdmin Tables" />

### Run the app!

1. Run the app in Tethys:
    ```
    tethys manage start
    ```

2. Browse to http://127.0.0.1:8000/apps in a web browser and login. The default portal user is:
    - username: admin
    - password: pass

3. If all has gone well, you should see the app listed on the app library page. Click on the app tile to launch it.
