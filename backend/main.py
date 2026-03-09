import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, Header
from sqlmodel import Session, select
from database import *
from fastapi import HTTPException, Depends
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"], # AJOUTE "GET" ICI
    allow_headers=["Content-Type", "X-API-Key"],
)


# 1. Initialisation du serveur Socket.io (Asynchrone)
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins="*")

# 2. Liaison de Socket.io à FastAPI
# Cela crée une application "hybride" qui gère l'API et les WebSockets
socket_app = socketio.ASGIApp(sio, app)



# 3. Événements Socket.io
@sio.event
async def connect(sid, environ):
    print(f"Client connecté : {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client déconnecté : {sid}")


"""
# 4. Route API qui reçoit les infos de l'ESP32
@app.post("/api/update-machine")
async def update_machine(data: dict):
    # Logique : On reçoit du JSON, on le traite...
    print(f"Données reçues : {data}")
    
    # ... et on le POUSSE immédiatement vers le React
    await sio.emit('machineUpdate', data)
    
    return {"status": "ok"}
"""


# Communication avec les données de la salle
@app.get("/{gym_id}/get_map/")
def get_gym_map(gym_id: int, session: Session = Depends(get_session)):
    statement = select(GymMap).where(GymMap.gym_id == gym_id)
    machines = session.exec(statement).all()
    return machines

@app.post("/{gym_id}/update_map/")
def update_gym_map(
    gym_id: int, 
    new_machines: List[GymMap], 
    x_api_key: str = Header(...), 
    session: Session = Depends(get_session)):

    # 1. Vérification de la clé
    # Note : Dans un vrai projet, on hacherait la clé ici comme vu précédemment
    gym = session.exec(select(Gym).where(Gym.id == gym_id, Gym.api_key == x_api_key)).first()
    
    if not gym:
        raise HTTPException(status_code=401, detail="Clé API invalide")
    
    # 2. Nettoyage de l'existant pour cette salle uniquement
    statement = select(GymMap).where(GymMap.gym_id == gym_id)
    results = session.exec(statement)
    for machine in results:
        session.delete(machine)

    # 3. Insertion des nouvelles machines
    for incoming in new_machines:
        # On extrait les données, on force le gym_id, et on laisse SQLModel gérer
        machine_data = incoming.dict()
        machine_data["gym_id"] = gym_id  # Sécurité : on force l'ID de la salle
        
        new_db_item = GymMap(**machine_data)
        session.add(new_db_item)
    
    session.commit()
    return {"status": "success", "message": "Carte synchronisée"}



# Lancement avec : uvicorn main:socket_app --reload