from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DATE, insert, Index, Enum, JSON
from sqlalchemy.orm import sessionmaker
import enum
from geoalchemy2 import Geometry
import os

from .app import GeoglowsDashboard as app

app_workspace_folder = os.path.join(os.path.dirname(__file__), "/workspaces/app_workspace")

# DB Engine, sessionmaker, and base
Base = declarative_base()

db_name = 'primary_db'


class Region(enum.Enum):
    NILE_BASIN = 'Nile Basin'
    CENTRAL_AMERICA = 'Central America'


class HydroSOSCategory(enum.Enum):
    EXTREMELY_DRY = 'extremely dry'
    DRY = 'dry'
    NORMAL_RANGE = 'normal range'
    WET = 'wet'
    EXTREMELY_WET = 'extremely wet'
    

class Country(Base):
    """
    SQLAlchemy Country DB Model
    """

    __tablename__ = 'countries'

    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    region = Column(Enum(Region))
    default = Column(Boolean)
    subbasins_data = Column(JSON)
    hydrostations_data = Column(JSON)


def add_new_country(name, region, is_default, subbasins_data, hydrostations_data):
    """
    Persist new country.
    """

    new_country = Country(
        name=name,
        region=Region(region),
        default=is_default,
        subbasins_data=subbasins_data,
        hydrostations_data=hydrostations_data
    )

    # Get connection/session to database
    Session = app.get_persistent_store_database(db_name, as_sessionmaker=True)
    session = Session()

    # Add the new country record to the session
    session.add(new_country)

    # Commit the session and close the connection
    session.commit()
    session.close()

    if is_default:
        update_default_country_in_db(name)


def get_country(name):
    """
    Get the data of the selected country.
    """

    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    country = session.query(Country).filter_by(name=name).first()
    session.close()
    return country


def get_all_countries(region):
    """
    Get all persisted countries.
    """

    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    countries = session.query(Country).filter_by(region=region).all()
    session.close()
    return countries


def remove_country(name):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    country_to_remove = session.query(Country).filter_by(name=name).first()
    session.delete(country_to_remove)
    session.commit()
    session.close()


def update_default_country_in_db(name):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    old_default_country = session.query(Country).filter_by(default="true").first()
    if old_default_country:
        old_default_country.default = False
    new_default_country = session.query(Country).filter_by(name=name).first()
    new_default_country.default = True
    session.commit()
    session.close()


class River(Base):
    __tablename__ = 'rivers'

    id = Column(Integer, primary_key=True)
    stream_order = Column(Integer, index=True)
    geometry = Column(Geometry())
    river_country = Column(String(100))
    vpu = Column(Integer)


def add_new_river(river_id, stream_order, geometry):
    new_river = River(
        id=river_id,
        strmOrder=stream_order,
        geometry=geometry
    )
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    session.add(new_river)
    session.commit()
    session.close()


def add_new_river_bulk(river_dict):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    session.execute(insert(River), river_dict)
    session.commit()
    session.close()


def update_river_data(river_id, country):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    session.query(River).filter(River.id == river_id).update({'river_country': country})
    session.commit()
    session.close()


# not working
def update_river_data_bulk(river_dict):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    session.bulk_update_mappings(River, river_dict)
    session.commit()
    session.close()


class RiverHydroSOS(Base):
    __tablename__ = 'river_hydrosos'

    id = Column(Integer, primary_key=True)
    river_id = Column(Integer, ForeignKey('rivers.id'), nullable=False)
    date = Column(DATE)
    category = Column(Enum(HydroSOSCategory), nullable=True)
    # TODO add unique constraint


def add_new_river_hydrosos(river_id, month, category):
    new_river_hydrosos = RiverHydroSOS(
        river_id=river_id,
        month=month,
        category=HydroSOSCategory(category)
    )
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    session.add(new_river_hydrosos)
    session.commit()
    session.close()


def add_new_river_hydrosos_bulk(river_hydrosos_dict):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    session.execute(insert(RiverHydroSOS), river_hydrosos_dict)
    session.commit()
    session.close()


def init_primary_db(engine, first_time):
    """
    Initializer for the country database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)

    # add index to the river_hydrosos table
    session = sessionmaker(bind=engine)()
    river_hydrosos_table = RiverHydroSOS.__table__

    try:
        month_index = Index('river_hydrosos_month_idx', river_hydrosos_table.c.date, postgresql_using='hash')
        month_index.create(engine)
        session.commit()
        session.close()
    except Exception as e:
        print(f"Error: {e}")
