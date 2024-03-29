from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, JSON, ForeignKey, DATE, insert, Index
from sqlalchemy.orm import sessionmaker
from geoalchemy2 import Geometry
import os

from .app import GeoglowsDashboard as app

app_workspace_folder = os.path.join(os.path.dirname(__file__), "/workspaces/app_workspace")

# DB Engine, sessionmaker, and base
Base = declarative_base()


db_name = 'country_db'

class Country(Base):
   """
   SQLAlchemy Country DB Model
   """ 
   
   __tablename__ = 'countries'
   
   id = Column(Integer, primary_key=True)
   name = Column(String)
   hydrosos = Column(JSON)
   default = Column(Boolean)


def add_new_country(name, hydrosos_data, is_default):
    """
    Persist new country.
    """
    
    new_country = Country(
        name=name,
        hydrosos=hydrosos_data,
        default=is_default
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
        update_default_country_db(name)
        

def get_country(name):
    """
    Get the data of the selected country.
    """
    
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    country = session.query(Country).filter_by(name=name).first()
    session.close()
    return country
    
    
def get_all_countries():
    """
    Get all persisted countries.
    """
    
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    countries = session.query(Country).all()
    session.close()
    return countries


def remove_country(name):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    country_to_remove = session.query(Country).filter_by(name=name).first()
    session.delete(country_to_remove)
    session.commit()
    session.close()


def update_default_country_db(name):
    session = app.get_persistent_store_database(db_name, as_sessionmaker=True)()
    old_default_country = session.query(Country).filter_by(default="true").first()
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
    

def add_new_river(rivid, stream_order, geometry):
    new_river = River(
        id=rivid,
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
    
    
class RiverHydroSOS(Base):
    __tablename__ = 'river_hydrosos'
    
    id = Column(Integer, primary_key=True)
    rivid = Column(Integer, ForeignKey('rivers.id'), nullable=False)
    month = Column(DATE)
    category = Column(String)
    # TODO add unique constraint
    
    
def add_new_river_hydrosos(rivid, month, category):
    new_river_hydrosos = RiverHydroSOS(
        rivid=rivid,
        month=month,
        category=category
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
    

def init_country_db(engine, first_time):
    """
    Initializer for the country database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)
    
    # add index to the river_hydrosos table
    session = sessionmaker(bind=engine)()
    river_hydrosos_table = RiverHydroSOS.__table__
    
    month_index = Index('river_hydrosos_month_idx', river_hydrosos_table.c.month, postgresql_using='hash')
    month_index.create(engine)
    session.commit()
    session.close()
