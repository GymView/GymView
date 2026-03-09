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
    allow_origins=["*"], # L'URL de ton React
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],       # Autorise explicitement OPTIONS
    allow_headers=["Content-Type", "X-API-Key"], # Autorise ton header personnalisé
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
    new_machines: List[GymMap], # FastAPI valide automatiquement le JSON reçu
    x_api_key: str = Header(...), 
    session: Session = Depends(get_session)):

    print(gym_id, new_machines, x_api_key)

    
    # AUTHENTIFICATION & VÉRIFICATION
    statement = select(Gym).where(Gym.id == gym_id, Gym.api_key == x_api_key)
    gym = session.exec(statement).first()
    
    if not gym:
        raise HTTPException(status_code=401, detail="Accès refusé : ID ou Clé API invalide")
    
    # RÉCUPÉRATION DE L'EXISTANT
    existing_machines_stmt = select(GymMap).where(GymMap.gym_id == gym_id)
    existing_machines = session.exec(existing_machines_stmt).all()
    
    # On crée un dictionnaire pour un accès rapide par id_machine
    # id_machine doit être ton identifiant unique métier côté React
    existing_dict = {m.id_machine: m for m in existing_machines}

    
    # LOGIQUE DE SYNCHRONISATION
    
    # Suppression de ce qui n'est plus dans la nouvelle liste
    for machine_id, machine_obj in existing_dict.items():
        session.delete(machine_obj)

    # Ajout ou Mise à jour
    for incoming in new_machines:
        # CREATE : Nouvelle machine
        new_db_item = GymMap(
            **incoming.dict(), 
            gym_id=gym_id
        )
        session.add(new_db_item)
    
    # VALIDATION FINALE
    session.commit()
    return {"status": "success", "message": f"Carte de la salle {gym_id} synchronisée."}



# Lancement avec : uvicorn main:socket_app --reload