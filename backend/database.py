


import os
from sqlmodel import SQLModel, create_engine, Session, Field, select
from typing import Optional, List
import secrets

DATABASE_URL = "postgresql://neondb_owner:npg_Mi8HvP3GXAVK@ep-nameless-bread-al9czmiy-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Pour Neon/Postgres, il est conseillé d'activer le SSL
engine = create_engine(
    DATABASE_URL, 
    echo=False  # Passe à True pour voir les requêtes SQL dans la console
)

# --- MODÈLES ---

class GymMap(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    gym_id: int
    id_machine: str
    x: int
    y: int
    w: int
    h: int
    type: str
    state: str

class Gym(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    api_key: str
    description: str

# --- LOGIQUE DE BASE DE DONNÉES ---

def create_db_and_tables():
    """Crée les tables si elles n'existent pas."""
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

def create_sample_data():
    """
    CRITIQUE : J'ai ajouté une vérification d'existence.
    Sans cela, Neon se remplirait de doublons à chaque redémarrage du serveur.
    """
    with Session(engine) as session:
        # On vérifie si la salle existe déjà
        existing_gym = session.exec(select(Gym).where(Gym.name == "Basic Fit Labège")).first()
        
        if not existing_gym:
            print("Initialisation des données de test...")
            new_gym = Gym(name="Basic Fit Labège", description="Salle principale", api_key=secrets.token_urlsafe(32))
            session.add(new_gym)
            session.commit()
            session.refresh(new_gym)

            new_map_element = GymMap(
                gym_id=new_gym.id, 
                id_machine="Poulie_01", 
                x=10, y=20, w=100, h=15, state="Libre",
                type="Zone cardio"
            )
            session.add(new_map_element)
            session.commit()
            print("Données de test créées.")
        else:
            print("Données de test déjà présentes, on passe l'initialisation.")



def get_map_by_id(map_id: int):
    with Session(engine) as session:
        statement = select(GymMap).where(GymMap.id == map_id)
        results = session.exec(statement)
        return results.first()
    
def get_all_machines_for_gym(gym_id: int) -> list[GymMap]:
    with Session(engine) as session:
        statement = select(GymMap).where(GymMap.gym_id == gym_id)
        return session.exec(statement).all()
    

# --- INITIALISATION AU DÉMARRAGE ---
create_db_and_tables()
create_sample_data()

print(get_all_machines_for_gym(1))