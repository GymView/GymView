import socketio
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, SQLModel
from database import *
from datetime import timedelta
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

import paho.mqtt.client as mqtt
import json
import asyncio

# ── Configuration MQTT ────────────────────────────────────────
MQTT_BROKER = "63e7b293201e4bc7ab8e7c6e15b536d4.s1.eu.hivemq.cloud"
MQTT_PORT   = 8884
MQTT_USER   = "backend"
MQTT_PASS   = "Backend_pswd1"
MQTT_TOPIC  = "1"

# ── Application FastAPI ───────────────────────────────────────
app = FastAPI(title="GymView API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# ── Socket.io ─────────────────────────────────────────────────
sio        = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio, app)

@sio.event
async def connect(sid, environ):
    print(f"[WS] Client connecté : {sid}")

@sio.event
async def disconnect(sid):
    print(f"[WS] Client déconnecté : {sid}")


# ── Schéma d'entrée pour update_map ──────────────────────────
# Schéma Pydantic séparé pour éviter les conflits avec le modèle SQLModel table.
# Il n'inclut pas les champs de maintenance (préservés côté DB).
class MachineInput(BaseModel):
    id:          str
    x:           int
    y:           int
    w:           int
    h:           int
    gym_id:      Optional[int] = None
    gymview_id:  str           = ""
    state:       str           = "libre"
    type:        str           = "treadmill"
    label:       str           = "Machine"


# ── Routes ───────────────────────────────────────────────────

@app.get("/gym_map/")
def get_all_gyms(session: Session = Depends(get_session)):
    """Retourne toutes les salles (sans la clé API)."""
    gyms = session.exec(select(Gym)).all()
    return [{"id": g.id, "name": g.name, "description": g.description} for g in gyms]


@app.get("/gym/{gym_id}")
def get_gym_info(gym_id: int, session: Session = Depends(get_session)):
    """Retourne les infos d'une salle, clé API incluse (usage admin/développement)."""
    gym = session.get(Gym, gym_id)
    if not gym:
        raise HTTPException(status_code=404, detail="Salle non trouvée")
    return gym


@app.get("/{gym_id}/get_map")
@app.get("/{gym_id}/get_map/")
def get_gym_map(gym_id: int, session: Session = Depends(get_session)):
    """Retourne toutes les machines d'une salle."""
    machines = session.exec(select(GymMap).where(GymMap.gym_id == gym_id)).all()
    return machines


@app.post("/{gym_id}/update_map/")
def update_gym_map(
    gym_id:       int,
    new_machines: List[MachineInput],
    x_api_key:    str = Header(...),
    session:      Session = Depends(get_session),
):
    """
    Synchronise la carte de la salle.
    - Crée les nouvelles machines.
    - Met à jour position/label/état des machines existantes.
    - Supprime les machines retirées.
    - Préserve les données de maintenance (total_minutes, etc.).
    """
    # 1. Authentification
    gym = session.exec(
        select(Gym).where(Gym.id == gym_id, Gym.api_key == x_api_key)
    ).first()
    if not gym:
        raise HTTPException(status_code=401, detail="Clé API invalide")

    # 2. Récupération de l'existant
    existing = session.exec(select(GymMap).where(GymMap.gym_id == gym_id)).all()
    existing_dict = {m.id: m for m in existing}
    incoming_ids  = {m.id for m in new_machines}

    # 3. Synchronisation (UPDATE ou INSERT)
    for incoming in new_machines:
        if incoming.id in existing_dict:
            # UPDATE — on ne touche pas aux champs maintenance
            db_m = existing_dict[incoming.id]
            db_m.gymview_id = incoming.gymview_id
            db_m.x     = incoming.x
            db_m.y     = incoming.y
            db_m.w     = incoming.w
            db_m.h     = incoming.h
            db_m.label = incoming.label
            db_m.state = incoming.state
            db_m.type  = incoming.type
            session.add(db_m)
        else:
            # INSERT — nouvelle machine avec valeurs de maintenance par défaut
            new_m = GymMap(
                id         = incoming.id,
                gym_id     = gym_id,
                gymview_id = incoming.gymview_id,
                x     = incoming.x,
                y     = incoming.y,
                w     = incoming.w,
                h     = incoming.h,
                label = incoming.label,
                state = incoming.state,
                type  = incoming.type,
            )
            session.add(new_m)

    # 4. Suppression des machines retirées de la carte
    for m_id, db_m in existing_dict.items():
        if m_id not in incoming_ids:
            session.delete(db_m)

    session.commit()
    return {"status": "success", "message": "Carte synchronisée avec succès"}


# ── Signalements ─────────────────────────────────────────────

class ReportInput(BaseModel):
    title:       str
    category:    str = "autre"
    priority:    str = "normale"
    machine:     str = ""
    description: str = ""

class ReportUpdate(BaseModel):
    status: str

@app.get("/{gym_id}/reports/")
def get_reports(gym_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(Report).where(Report.gym_id == gym_id).order_by(Report.date.desc())
    ).all()

@app.post("/{gym_id}/reports/")
def create_report(gym_id: int, body: ReportInput, session: Session = Depends(get_session)):
    r = Report(gym_id=gym_id, **body.model_dump())
    session.add(r)
    session.commit()
    session.refresh(r)
    return r

@app.patch("/reports/{report_id}")
def update_report(report_id: int, body: ReportUpdate, session: Session = Depends(get_session)):
    r = session.get(Report, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Signalement introuvable")
    r.status = body.status
    if body.status == "resolu":
        r.resolved_date = datetime.now()
    session.add(r)
    session.commit()
    session.refresh(r)
    return r

@app.delete("/reports/{report_id}")
def delete_report(report_id: int, session: Session = Depends(get_session)):
    r = session.get(Report, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Signalement introuvable")
    session.delete(r)
    session.commit()
    return {"status": "deleted"}


# ── Statistiques d'usage ──────────────────────────────────────

@app.get("/{gym_id}/usage/hourly")
def get_hourly_usage(gym_id: int, days: int = 30, session: Session = Depends(get_session)):
    """Distribution horaire des sessions (derniers N jours)."""
    since = datetime.now() - timedelta(days=days)
    events = session.exec(
        select(UsageEvent).where(
            UsageEvent.gym_id == gym_id,
            UsageEvent.started_at >= since,
            UsageEvent.ended_at.is_not(None),
        )
    ).all()
    hourly = {h: 0 for h in range(6, 23)}
    for ev in events:
        h = ev.started_at.hour
        if 6 <= h <= 22:
            hourly[h] += 1
    max_c = max(hourly.values(), default=1) or 1
    return [
        {"h": f"{h:02d}h", "taux": round(c / max_c * 100), "sessions": c}
        for h, c in sorted(hourly.items())
    ]

@app.get("/{gym_id}/usage/daily")
def get_daily_usage(gym_id: int, days: int = 60, session: Session = Depends(get_session)):
    """Minutes d'usage cumulées par jour (derniers N jours)."""
    since = datetime.now() - timedelta(days=days)
    events = session.exec(
        select(UsageEvent).where(
            UsageEvent.gym_id == gym_id,
            UsageEvent.started_at >= since,
            UsageEvent.duration_minutes.is_not(None),
        )
    ).all()
    daily: dict[str, int] = {}
    for ev in events:
        day = ev.started_at.date().isoformat()
        daily[day] = daily.get(day, 0) + (ev.duration_minutes or 0)
    return [
        {"date": d, "heures": round(m / 60, 1), "minutes": m}
        for d, m in sorted(daily.items())
    ]

@app.get("/{gym_id}/usage/by_machine")
def get_usage_by_machine(gym_id: int, days: int = 30, session: Session = Depends(get_session)):
    """Sessions et minutes par machine (derniers N jours)."""
    since = datetime.now() - timedelta(days=days)
    events = session.exec(
        select(UsageEvent).where(
            UsageEvent.gym_id == gym_id,
            UsageEvent.started_at >= since,
        )
    ).all()
    by_machine: dict = {}
    for ev in events:
        mid = ev.machine_id
        if mid not in by_machine:
            by_machine[mid] = {
                "machine_id": mid,
                "label": ev.machine_label,
                "type":  ev.machine_type,
                "sessions": 0,
                "minutes":  0,
            }
        by_machine[mid]["sessions"] += 1
        by_machine[mid]["minutes"]  += ev.duration_minutes or 0
    return sorted(by_machine.values(), key=lambda x: x["minutes"], reverse=True)


@app.post("/reset_maintenance/{machine_id}")
def reset_maintenance(
    machine_id: str,
    x_api_key:  str = Header(...),
    session:    Session = Depends(get_session),
):
    """Remet à zéro le compteur de maintenance d'une machine."""
    machine = session.get(GymMap, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine non trouvée")

    # Vérifie la clé API de la salle de la machine
    gym = session.exec(
        select(Gym).where(Gym.id == machine.gym_id, Gym.api_key == x_api_key)
    ).first()
    if not gym:
        raise HTTPException(status_code=401, detail="Clé API invalide")

    machine.minutes_since_last_maint = 0
    machine.last_maintenance_date    = datetime.now()
    session.add(machine)
    session.commit()
    session.refresh(machine)
    return machine


# ── Suivi d'usage MQTT ────────────────────────────────────────
db_states          = ["libre", "utilise", "occupe"]
machine_active_since: dict[str, datetime] = {}  # gymview_id -> heure d'activation
last_db_states:      dict[str, str]       = {}  # gymview_id -> dernier état DB

def update_machine_in_db(gymview_id: str, new_state: str):
    """
    Met à jour l'état d'une machine dans la DB.
    Incrémente total_minutes et minutes_since_last_maint quand la machine
    passe de actif (utilise/occupe) à libre.
    """
    with Session(engine) as session:
        machine = session.exec(
            select(GymMap).where(GymMap.gymview_id == gymview_id)
        ).first()

        if not machine:
            print(f"[MQTT] Machine inconnue : gymview_id={gymview_id}")
            return

        now = datetime.now()

        # Machine qui redevient libre → comptabilise le temps + clôt l'UsageEvent
        if new_state == "libre" and gymview_id in machine_active_since:
            elapsed_min = int((now - machine_active_since.pop(gymview_id)).total_seconds() / 60)
            if elapsed_min > 0:
                machine.total_minutes            += elapsed_min
                machine.minutes_since_last_maint += elapsed_min
                print(f"[USAGE] {gymview_id} : +{elapsed_min} min (total={machine.total_minutes} min)")
                # Clôture de l'UsageEvent ouvert
                open_ev = session.exec(
                    select(UsageEvent).where(
                        UsageEvent.machine_id == machine.id,
                        UsageEvent.ended_at.is_(None),
                    )
                ).first()
                if open_ev:
                    open_ev.ended_at         = now
                    open_ev.duration_minutes = elapsed_min
                    session.add(open_ev)

        # Machine qui devient active → mémorise l'heure + ouvre un UsageEvent
        elif new_state in ("utilise", "occupe") and gymview_id not in machine_active_since:
            machine_active_since[gymview_id] = now
            ev = UsageEvent(
                gym_id        = machine.gym_id,
                machine_id    = machine.id,
                gymview_id    = gymview_id,
                machine_type  = machine.type,
                machine_label = machine.label,
                started_at    = now,
            )
            session.add(ev)

        machine.state = new_state
        session.add(machine)
        session.commit()


# ── Client MQTT ───────────────────────────────────────────────
def on_connect(client, userdata, flags, rc):
    print(f"[MQTT] Connecté au broker (code {rc})")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        raw     = msg.payload.decode()
        parts   = raw.split('/')
        gymview_id = parts[0]
        new_state  = db_states[int(parts[1])]

        print(f"[MQTT] {gymview_id} → {new_state}")

        # Diffusion temps réel via Socket.io
        payload = {"gymview_id": gymview_id, "state": new_state}
        loop.call_soon_threadsafe(
            lambda: asyncio.create_task(sio.emit('machineUpdate', payload))
        )

        # Persistance uniquement si l'état change
        if last_db_states.get(gymview_id) != new_state:
            update_machine_in_db(gymview_id, new_state)
            last_db_states[gymview_id] = new_state

    except Exception as e:
        print(f"[MQTT] Erreur : {e}")


mqtt_client = mqtt.Client(transport="websockets")
mqtt_client.tls_set()
mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message


# ── Démarrage ─────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    global loop
    # Création des tables si elles n'existent pas encore
    create_db_and_tables()

    loop = asyncio.get_event_loop()
    mqtt_client.connect_async(MQTT_BROKER, MQTT_PORT)
    mqtt_client.loop_start()
    print("[API] Serveur GymView démarré.")


# Lancement : uvicorn main:socket_app --reload
