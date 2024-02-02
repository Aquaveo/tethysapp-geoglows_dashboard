from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, JSON


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
    Session = app.get_persistent_store_database('country_db', as_sessionmaker=True)
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
    
    session = app.get_persistent_store_database('country_db', as_sessionmaker=True)()
    country = session.query(Country).filter_by(name=name).first()
    session.close()
    return country
    
    
def get_all_countries():
    """
    Get all persisted countries.
    """
    
    session = app.get_persistent_store_database('country_db', as_sessionmaker=True)()
    countries = session.query(Country).all()
    session.close()
    return countries


def remove_country(name):
    session = app.get_persistent_store_database('country_db', as_sessionmaker=True)()
    country_to_remove = session.query(Country).filter_by(name=name).first()
    session.delete(country_to_remove)
    session.commit()
    session.close()


def update_default_country_db(name):
    session = app.get_persistent_store_database('country_db', as_sessionmaker=True)()
    old_default_country = session.query(Country).filter_by(default="true").first()
    old_default_country.default = False
    new_default_country = session.query(Country).filter_by(name=name).first()
    new_default_country.default = True
    session.commit()
    session.close()


def init_country_db(engine, first_time):
    """
    Initializer for the country database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)
    