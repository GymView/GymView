"""
Génère 6 mois d'historique d'usage (UsageEvent) + 20 signalements (Report)
pour la salle gym_id=1.

Profil réaliste :
  - Gym ouverte 6h-22h
  - Pics : 7-9h, 12-14h, 17-21h
  - Weekends 30% moins fréquentés
  - Durée des sessions variable selon l'équipement
"""

import random
from datetime import datetime, timedelta, date
from sqlmodel import Session, select, delete
from database import engine, GymMap, UsageEvent, Report, create_db_and_tables

random.seed(99)

GYM_ID   = 1
DAYS_BACK = 180

# ── Profils par type d'équipement ──────────────────────────────
# (sessions_wd_min, sessions_wd_max, sessions_we_min, sessions_we_max, dur_min, dur_max)
PROFILES = {
    "treadmill":    (5, 9,  3, 6,  20, 45),
    "elliptical":   (4, 8,  3, 5,  20, 40),
    "bike":         (4, 7,  2, 5,  25, 50),
    "rowing":       (2, 4,  1, 3,  15, 30),
    "squat":        (3, 6,  2, 4,  20, 40),
    "smith":        (2, 5,  1, 3,  20, 35),
    "lat_pulldown": (3, 7,  2, 4,  15, 30),
    "cable":        (4, 8,  2, 5,  15, 30),
    "leg_press":    (3, 6,  2, 4,  15, 25),
    "bench":        (4, 8,  3, 5,  15, 30),
    "dumbbell":     (6, 11, 4, 7,  20, 45),
    "boxing":       (1, 3,  1, 2,  20, 40),
    "mat":          (1, 3,  1, 2,  30, 60),
    "weights":      (3, 6,  2, 4,  20, 35),
}
DEFAULT_PROFILE = (2, 5, 1, 3, 15, 30)

# Distribution horaire (poids relatifs, 6h→22h)
HOUR_WEIGHTS = {
    6: 5,  7: 28, 8: 45, 9: 38, 10: 28, 11: 22,
    12: 42, 13: 38, 14: 22, 15: 18, 16: 28,
    17: 55, 18: 75, 19: 85, 20: 65, 21: 38, 22: 15,
}
HOURS  = list(HOUR_WEIGHTS.keys())
WGHTS  = list(HOUR_WEIGHTS.values())

def pick_start(day: date) -> datetime:
    h = random.choices(HOURS, weights=WGHTS)[0]
    m = random.randint(0, 59)
    return datetime(day.year, day.month, day.day, h, m)


# ── Signalements de test ───────────────────────────────────────
SAMPLE_REPORTS = [
    dict(title="Tapis 3 — bruit anormal au démarrage",         category="panne",       priority="haute",    machine="Tapis 3",        description="Grince fort dès 10 km/h. Nécessite inspection.", status="resolu",   days_ago=120),
    dict(title="Vélo 2 — résistance bloquée sur niveau 8",     category="panne",       priority="normale",  machine="Vélo 2",         description="Impossible de réduire la résistance.",              status="resolu",   days_ago=95),
    dict(title="Flaque d'eau près des vestiaires",             category="hygiene",     priority="urgente",  machine="",               description="Sol glissant, risque de chute.",                    status="resolu",   days_ago=80),
    dict(title="Smith Machine — câble effiloché",              category="securite",    priority="urgente",  machine="Smith Machine",  description="Câble à remplacer d'urgence.",                      status="resolu",   days_ago=70),
    dict(title="Manque de désinfectant spray zone cardio",     category="hygiene",     priority="normale",  machine="",               description="Distributeurs vides depuis 2 jours.",               status="resolu",   days_ago=60),
    dict(title="Rack Squat — vis de sécurité desserrée",       category="securite",    priority="haute",    machine="Rack Squat",     description="J-hook droit à revisser.",                          status="en_cours", days_ago=45),
    dict(title="Tapis 1 — console tactile ne répond plus",     category="panne",       priority="normale",  machine="Tapis 1",        description="Écran noir après 20 min.",                          status="en_cours", days_ago=30),
    dict(title="Tirage dorsaux — bruit de claquement",         category="maintenance", priority="normale",  machine="Tirage dorsaux", description="Poulie qui claque en descente.",                    status="ouvert",   days_ago=18),
    dict(title="Manque de bancs de stretching",                category="equipement",  priority="faible",   machine="",               description="On n'a que 2 bancs pour toute la zone cardio.",     status="ouvert",   days_ago=12),
    dict(title="Leg Press — odeur de caoutchouc brûlé",        category="panne",       priority="haute",    machine="Leg Press",      description="Odeur apparaît sous charge lourde.",                status="ouvert",   days_ago=8),
    dict(title="Rameur 2 — siège qui glisse mal",              category="panne",       priority="faible",   machine="Rameur 2",       description="Rail à nettoyer / lubrifier.",                      status="ouvert",   days_ago=5),
    dict(title="Câble 2 — poids sélecteur bloqué sur 40 kg",   category="panne",       priority="haute",    machine="Câble 2",        description="Goupille coincée, impossible de changer le poids.", status="ouvert",   days_ago=3),
    dict(title="Climatisation insuffisante zone machines",     category="autre",       priority="normale",  machine="",               description="Température trop élevée en soirée.",                status="ouvert",   days_ago=2),
    dict(title="Elliptique 3 — pédale droite qui grince",      category="maintenance", priority="normale",  machine="Elliptique 3",   description="Graissage à prévoir.",                              status="ouvert",   days_ago=1),
]


def main():
    create_db_and_tables()
    now = datetime.now()

    with Session(engine) as session:

        # ── Charger les machines ───────────────────────────────
        machines = session.exec(
            select(GymMap).where(GymMap.gym_id == GYM_ID)
        ).all()
        if not machines:
            print("Aucune machine trouvée pour gym_id=1. Lance d'abord le backend.")
            return
        print(f"{len(machines)} machines trouvées.")

        # ── Vider les UsageEvent existants ─────────────────────
        deleted = session.exec(
            delete(UsageEvent).where(UsageEvent.gym_id == GYM_ID)
        )
        session.commit()
        print(f"UsageEvents précédents supprimés.")

        # ── Générer les sessions ───────────────────────────────
        total_events = 0
        start_date = (now - timedelta(days=DAYS_BACK)).date()

        for machine in machines:
            p = PROFILES.get(machine.type, DEFAULT_PROFILE)
            wd_min, wd_max, we_min, we_max, dur_min, dur_max = p

            current = start_date
            while current <= now.date():
                is_weekend = current.weekday() >= 5
                n_sessions = random.randint(
                    we_min if is_weekend else wd_min,
                    we_max if is_weekend else wd_max,
                )
                for _ in range(n_sessions):
                    started = pick_start(current)
                    if started > now:
                        continue
                    duration = random.randint(dur_min, dur_max)
                    ended    = started + timedelta(minutes=duration)
                    if ended > now:
                        ended    = now
                        duration = max(1, int((ended - started).total_seconds() / 60))

                    session.add(UsageEvent(
                        gym_id        = GYM_ID,
                        machine_id    = machine.id,
                        gymview_id    = machine.gymview_id or "",
                        machine_type  = machine.type,
                        machine_label = machine.label,
                        started_at    = started,
                        ended_at      = ended,
                        duration_minutes = duration,
                    ))
                    total_events += 1

                current += timedelta(days=1)

            # Commit par machine pour ne pas saturer la mémoire
            session.commit()

        print(f"{total_events} UsageEvents insérés.")

        # ── Vider les Report existants ─────────────────────────
        session.exec(delete(Report).where(Report.gym_id == GYM_ID))
        session.commit()

        # ── Insérer les signalements ───────────────────────────
        for r in SAMPLE_REPORTS:
            days_ago = r.pop("days_ago")
            report_date = now - timedelta(days=days_ago)
            resolved = report_date + timedelta(days=random.randint(1, 5)) \
                       if r["status"] == "resolu" else None
            session.add(Report(
                gym_id       = GYM_ID,
                date         = report_date,
                resolved_date = resolved,
                **r,
            ))
        session.commit()
        print(f"{len(SAMPLE_REPORTS)} signalements insérés.")
        print("Seed termine avec succes.")


if __name__ == "__main__":
    main()
