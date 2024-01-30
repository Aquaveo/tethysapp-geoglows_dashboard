from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, JSON
from sqlalchemy.orm import sessionmaker

import json

from .app import GeoglowsDashboard as app

# DB Engine, sessionmaker, and base
Base = declarative_base()


class Country(Base):
   """
   SQLAlchemy Country DB Model
   """ 
   
   __tablename__ = 'countries'
   
   id = Column(Integer, primary_key=True)
   name = Column(String)
   hydrosos = Column(JSON)
   default = Column(Boolean)
   

def add_new_country(name, hydrosos):
    """
    Persist new country.
    """
    
    new_country = Country(
        name=name,
        hydrosos=hydrosos,
        default=False # TODO
    )
    
    # Get connection/session to database
    Session = app.get_persistent_store_database('country_db', as_sessionmaker=True)
    session = Session()
    
    # Add the new country record to the session
    session.add(new_country)
    
    # Commit the session and close the connection
    session.commit()
    session.close()
    
    
def get_all_countries():
    """
    Get all persisted countries.
    """
    
    session = app.get_persistent_store_database('country_db', as_sessionmaker=True)()
    countries = session.query(Country).all()
    session.close()
    return countries


def remove_country(name):
    pass # TODO


def update_default_country(name, hydrosos):
    pass # TODO


def init_country_db(engine, first_time):
    """
    Initializer for the country database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)
    
    if first_time:
        Session = sessionmaker(bind=engine)
        session = Session()
        path = "workspaces/app_workspace/hydrosos_ecuador.json"
        data = json.load(open(path, "w"))
        country = Country(
            name="Ecuador",
            hydrosos=data, # TOO
            default=True,
        )
        session.add(country)
        session.commit()
        session.close()