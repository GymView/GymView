import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, Header
from sqlmodel import Session, select
from database import *
from fastapi import HTTPException, Depends
from typing import List


import paho.mqtt.client as mqtt
import json
import asyncio

# --- CONFIGURATION HIVEMQ ---
MQTT_BROKER = "63e7b293201e4bc7ab8e7c6e15b536d4.s1.eu.hivemq.cloud"
MQTT_PORT = 8884
MQTT_USER = "backend"
MQTT_PASS = "Backend_pswd1"
MQTT_TOPIC = "1"



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

    # 1. AUTHENTIFICATION
    gym = session.exec(select(Gym).where(Gym.id == gym_id, Gym.api_key == x_api_key)).first()
    if not gym:
        raise HTTPException(status_code=401, detail="Clé API invalide")
    
    # 2. RÉCUPÉRATION DE L'EXISTANT
    # On crée un dictionnaire { "id_gridstack": objet_db }
    existing_machines = session.exec(select(GymMap).where(GymMap.gym_id == gym_id)).all()
    existing_dict = {m.id: m for m in existing_machines}
    
    # On garde trace des IDs reçus pour savoir quoi supprimer à la fin
    incoming_ids = {m.id for m in new_machines}

    # 3. SYNCHRONISATION (UPDATE OU INSERT)
    for incoming in new_machines:
        if incoming.id in existing_dict:
            # --- CAS : UPDATE ---
            # La machine existe déjà, on ne met à jour QUE les champs visuels/position
            # Cela préserve les champs 'total_minutes' et 'minutes_since_last_maint' !
            db_machine = existing_dict[incoming.id]
            
            db_machine.gymview_id = incoming.gymview_id
            db_machine.x = incoming.x
            db_machine.y = incoming.y
            db_machine.w = incoming.w
            db_machine.h = incoming.h
            db_machine.label = incoming.label
            db_machine.state = incoming.state
            db_machine.type = incoming.type
            
            session.add(db_machine)
        else:
            # --- CAS : INSERT ---
            # Nouvelle machine ajoutée par le gérant
            incoming.gym_id = gym_id
            session.add(incoming)

    # 4. NETTOYAGE (DELETE)
    # Si une machine est en base mais n'est plus dans la liste reçue, on la supprime
    for m_id, db_machine in existing_dict.items():
        if m_id not in incoming_ids:
            session.delete(db_machine)
    
    session.commit()
    return {"status": "success", "message": "Carte synchronisée avec succès (Maintenance préservée)"}



# Gestion MQTT

last_db_states = {} # update que si la dernière valeur est différente

def on_connect(client, userdata, flags, rc):
    print(f"Connecté au broker HiveMQ avec le code {rc}")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    # Cette fonction tourne dans un thread séparé
    try:
        print(msg.payload.decode())
        payload = msg.payload.decode().split('/')  #json.loads()
        payload = {"gymview_id":payload[0], "state":db_states[int(payload[1])]}
        #machine_id = payload.get("id")
        #new_state = payload.get("state")

        # 1. TEMPS RÉEL : On envoie l'info à tous les clients React via Socket.io
        # On utilise loop.call_soon_threadsafe car Socket.io est async
        loop.call_soon_threadsafe(
            lambda: asyncio.create_task(sio.emit('machineUpdate', payload))
        )

        # 2. PERSISTENCE STRATÉGIQUE : On n'écrit en DB que si l'état a changé
        if last_db_states.get(payload["gymview_id"]) != payload["state"]:
            print(f"Changement d'état pour {payload["gymview_id"]} -> Mise à jour DB")
            update_machine_in_db(payload["gymview_id"], payload["state"])
            last_db_states[payload["gymview_id"]] = payload["state"]

    except Exception as e:
        print(f"Erreur MQTT: {e}")

db_states = ["libre", "utilise", "occupe"]

# Lancement du client MQTT au démarrage de FastAPI
mqtt_client = mqtt.Client(transport="websockets") # HiveMQ Cloud utilise souvent TLS/Websockets
mqtt_client.tls_set() # Obligatoire pour HiveMQ Cloud
mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_event_loop()
    mqtt_client.connect_async(MQTT_BROKER, MQTT_PORT)
    mqtt_client.loop_start()

def update_machine_in_db(machine_id, state):
    # Ici, ouvre une session SQLModel et mets à jour uniquement le champ 'state'
    with Session(engine) as session:
        statement = select(GymMap).where(GymMap.gymview_id == machine_id)
        machine = session.exec(statement).first()
        if machine:
            machine.state = state
            session.add(machine)
            session.commit()

# Lancement avec : uvicorn main:socket_app --reload