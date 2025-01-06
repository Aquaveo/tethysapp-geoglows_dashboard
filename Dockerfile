FROM mambaorg/micromamba:bullseye
###################
# BUILD ARGUMENTS #
###################
ARG PYTHON_VERSION=3.*
ARG MICRO_TETHYS=false
ARG DJANGO_VERSION=4.2.*
ARG DJANGO_CHANNELS_VERSION
ARG DAPHNE_VERSION
ARG GEOGLOWS_REPO_LINK=https://github.com/Aquaveo/tethysapp-geoglows_dashboard.git

###############
# ENVIRONMENT #
###############
ENV TETHYS_HOME="/usr/lib/tethys"
ENV TETHYS_LOG="/var/log/tethys"
ENV TETHYS_PERSIST="/var/lib/tethys_persist"
ENV TETHYS_APPS_ROOT="/var/www/tethys/apps"
ENV TETHYS_PORT=8000
ENV NGINX_PORT=80
ENV POSTGRES_PASSWORD="pass"
ENV SKIP_DB_SETUP=false
ENV TETHYS_DB_ENGINE='django.db.backends.postgresql'
ENV TETHYS_DB_NAME='tethys_platform'
ENV TETHYS_DB_USERNAME="tethys_default"
ENV TETHYS_DB_PASSWORD="pass"
ENV TETHYS_DB_HOST="db"
ENV TETHYS_DB_PORT=5432
ENV TETHYS_DB_SUPERUSER="tethys_super"
ENV TETHYS_DB_SUPERUSER_PASS="pass"
ENV PORTAL_SUPERUSER_NAME=""
ENV PORTAL_SUPERUSER_EMAIL=""
ENV PORTAL_SUPERUSER_PASSWORD=""
ENV TETHYS_MANAGE="${TETHYS_HOME}/tethys/tethys_portal/manage.py"


# Misc
ENV BASH_PROFILE=".bashrc"
ENV CONDA_HOME="/opt/conda"
ENV CONDA_ENV_NAME=tethys
ENV ENV_NAME=tethys
ENV ASGI_PROCESSES=1
ENV CLIENT_MAX_BODY_SIZE="75M"

# Tethys settings arguments
ENV DEBUG="False"
ENV ALLOWED_HOSTS="\"[localhost, 127.0.0.1]\""
ENV CSRF_TRUSTED_ORIGINS="\"[http://localhost, http://127.0.0.1]\""
ENV BYPASS_TETHYS_HOME_PAGE="True"
ENV ADD_DJANGO_APPS="\"[]\""
ENV SESSION_WARN=1500
ENV SESSION_EXPIRE=1800
ENV STATIC_ROOT="${TETHYS_PERSIST}/static"
ENV WORKSPACE_ROOT="${TETHYS_PERSIST}/workspaces"
ENV MEDIA_ROOT="${TETHYS_PERSIST}/media"
ENV MEDIA_URL="/media/"
ENV QUOTA_HANDLERS="\"[]\""
ENV DJANGO_ANALYTICAL="\"{}\""
ENV ADD_BACKENDS="\"[]\""
ENV OAUTH_OPTIONS="\"{}\""
ENV CHANNEL_LAYERS_BACKEND="channels.layers.InMemoryChannelLayer"
ENV CHANNEL_LAYERS_CONFIG="\"{}\""
ENV RECAPTCHA_PRIVATE_KEY=""
ENV RECAPTCHA_PUBLIC_KEY=""
ENV OTHER_SETTINGS=""

# Tethys site arguments
ENV SITE_TITLE=""
ENV FAVICON=""
ENV BRAND_TEXT=""
ENV BRAND_IMAGE=""
ENV BRAND_IMAGE_HEIGHT=""
ENV BRAND_IMAGE_WIDTH=""
ENV BRAND_IMAGE_PADDING=""
ENV APPS_LIBRARY_TITLE=""
ENV PRIMARY_COLOR=""
ENV SECONDARY_COLOR=""
ENV PRIMARY_TEXT_COLOR=""
ENV PRIMARY_TEXT_HOVER_COLOR=""
ENV SECONDARY_TEXT_COLOR=""
ENV SECONDARY_TEXT_HOVER_COLOR=""
ENV BACKGROUND_COLOR=""
ENV COPYRIGHT=""
ENV HERO_TEXT=""
ENV BLURB_TEXT=""
ENV FEATURE_1_HEADING=""
ENV FEATURE_1_BODY=""
ENV FEATURE_1_IMAGE=""
ENV FEATURE_2_HEADING=""
ENV FEATURE_2_BODY=""
ENV FEATURE_2_IMAGE=""
ENV FEATURE_3_HEADING=""
ENV FEATURE_3_BODY=""
ENV FEATURE_3_IMAGE=""
ENV CALL_TO_ACTION=""
ENV CALL_TO_ACTION_BUTTON=""
ENV PORTAL_BASE_CSS=""
ENV HOME_PAGE_CSS=""
ENV APPS_LIBRARY_CSS=""
ENV ACCOUNTS_BASE_CSS=""
ENV LOGIN_CSS=""
ENV REGISTER_CSS=""
ENV USER_BASE_CSS=""
ENV HOME_PAGE_TEMPLATE=""
ENV APPS_LIBRARY_TEMPLATE=""
ENV LOGIN_PAGE_TEMPLATE=""
ENV REGISTER_PAGE_TEMPLATE=""
ENV USER_PAGE_TEMPLATE=""
ENV USER_SETTINGS_PAGE_TEMPLATE=""

#########
# SETUP #
#########
USER root
RUN mkdir -p "usr/lib"
# RUN mkdir -p "${TETHYS_HOME}"

RUN apt-get update && apt-get install -y git curl wget
WORKDIR /usr/lib/
RUN git clone https://github.com/tethysplatform/tethys.git 




WORKDIR ${TETHYS_HOME}

RUN ls -la ${TETHYS_HOME}/docker
RUN ls -la ${TETHYS_HOME}

# Speed up APT installs
RUN echo "force-unsafe-io" > /etc/dpkg/dpkg.cfg.d/02apt-speedup \
  ; echo "Acquire::http {No-Cache=True;};" > /etc/apt/apt.conf.d/no-cache

# Install APT packages
RUN rm -rf /var/lib/apt/lists/*\
  && apt-get update \
  && apt-get -y install curl \
  && mkdir /etc/apt/keyrings \
  && curl -fsSL https://packages.broadcom.com/artifactory/api/security/keypair/SaltProjectKey/public | tee /etc/apt/keyrings/salt-archive-keyring-2023.pgp \
  && echo "deb [signed-by=/etc/apt/keyrings/salt-archive-keyring-2023.pgp arch=amd64] https://packages.broadcom.com/artifactory/saltproject-deb/ stable main" | tee /etc/apt/sources.list.d/salt.list \
  && apt-get update \
  && apt-get -y install bzip2 git nginx supervisor gcc salt-minion procps pv \
  && rm -rf /var/lib/apt/lists/*

# Remove default NGINX site
RUN rm -f /etc/nginx/sites-enabled/default

# Setup conda symlink for the micromamba command
RUN mkdir -p ${CONDA_HOME}/bin
RUN ln -s /bin/micromamba ${CONDA_HOME}/bin/conda

# Setup Conda Environment
WORKDIR ${TETHYS_HOME}

# Set the versions of Django, Channels, and Daphne if provided in environment.tyml and micro_environment.yml
RUN if [ -n "$DJANGO_VERSION" ]; then \
  sed -i "s/\s*- django[^-].*/  - django==${DJANGO_VERSION}/" environment.yml micro_environment.yml; \
  fi && \
  if [ -n "$DJANGO_CHANNELS_VERSION" ]; then \
  sed -i "s/\s*- channels.*/  - channels==${DJANGO_CHANNELS_VERSION}/" environment.yml micro_environment.yml; \
  fi && \
  if [ -n "$DAPHNE_VERSION" ]; then \
  sed -i "s/\s*- daphne.*/  - daphne==${DAPHNE_VERSION}/" environment.yml micro_environment.yml; \
  fi 

# Create the conda environment based on the environment.yml or micro_environment.yml file
RUN if [ "${MICRO_TETHYS}" = "true" ]; then \
  sed -i "s/- python[^-].*/- python==${PYTHON_VERSION}/g" micro_environment.yml && \
  micromamba create -n "${CONDA_ENV_NAME}" --yes --file "micro_environment.yml" && \
  micromamba clean --all --yes && \
  rm -rf environment.yml; \
  else \
  sed -i "s/- python[^-].*/- python==${PYTHON_VERSION}/g" environment.yml && \
  micromamba create -n "${CONDA_ENV_NAME}" --yes --file "environment.yml" && \
  micromamba clean --all --yes && \
  rm -rf micro_environment.yml; \
  fi

###########
# INSTALL #
###########
# Make dirs
RUN mkdir -p ${TETHYS_PERSIST} ${TETHYS_APPS_ROOT} ${WORKSPACE_ROOT} ${MEDIA_ROOT} ${STATIC_ROOT} ${TETHYS_LOG}

# Setup www user, run supervisor and nginx processes as www user
RUN groupadd www \
  ; useradd -r -u 1011 -g www www \
  ; sed -i 's/^user.*/user www www;/' /etc/nginx/nginx.conf \
  ; sed -i "/^\[supervisord\]$/a user=www" /etc/supervisor/supervisord.conf \
  ; chown -R www: ${TETHYS_LOG} /run /var/log/supervisor /var/log/nginx /var/lib/nginx

# Run Installer
ARG MAMBA_DOCKERFILE_ACTIVATE=1
RUN pip install -e .

# Install channel-redis
RUN micromamba install -c conda-forge --yes channels_redis

############
# CLEAN UP #
############
RUN apt-get -y remove gcc \
  ; apt-get -y autoremove \
  ; apt-get -y clean

#########################
# CONFIGURE  ENVIRONMENT#
#########################
ENV PATH ${CONDA_HOME}/miniconda/envs/tethys/bin:$PATH 
VOLUME ["${TETHYS_PERSIST}", "${TETHYS_HOME}/keys"]
EXPOSE 80

########
# RUN! #
########
WORKDIR ${TETHYS_HOME}
RUN cp -r ${TETHYS_HOME}/docker/salt/ /srv/salt/
COPY new_salt_jobs/tethys_services.sls /srv/salt/tethys_services.sls
COPY new_salt_jobs/init_river_tables.sls /srv/salt/init_river_tables.sls
COPY new_salt_jobs/init_geoserver.sls /srv/salt/init_geoserver.sls
COPY new_salt_jobs/download_data_file.sls /srv/salt/download_data_file.sls

RUN echo "    - tethys_services" >> /srv/salt/top.sls;
RUN echo "    - init_river_tables" >> /srv/salt/top.sls;
RUN echo "    - init_geoserver" >> /srv/salt/top.sls;
RUN echo "    - download_data_file" >> /srv/salt/top.sls;

WORKDIR ${TETHYS_HOME}

##################################*
# GEOGLOWS DASHBOARD INSTALLATION #
# ##################################*
WORKDIR ${TETHYS_APPS_ROOT}
RUN git clone https://github.com/Aquaveo/tethysapp-geoglows_dashboard.git
WORKDIR ${TETHYS_APPS_ROOT}/tethysapp-geoglows_dashboard/
RUN git checkout bugfix/cache-dir-permission
WORKDIR ${TETHYS_APPS_ROOT}/tethysapp-geoglows_dashboard/
RUN tethys install

RUN conda install -c conda-forge tethys_dataset_services

# Create Salt configuration based on ENVs
CMD bash ${TETHYS_HOME}/docker/run.sh

HEALTHCHECK --start-period=240s \
  CMD ${TETHYS_HOME}/docker/liveness-probe.sh