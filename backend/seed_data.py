"""
Injecte des données réalistes dans la table GymMap :
  - gymview_id   : entier séquentiel (1, 2, 3 …)
  - total_minutes
  - minutes_since_last_maint
  - last_maintenance_date
  - first_usage
  - maintenance_threshold  (adapté par type d'équipement)
"""

import random
from datetime import datetime, timedelta
from sqlmodel import Session, select
from database import engine, GymMap

random.seed(42)   # reproductible

# ── Profils par type ──────────────────────────────────────────────────────────
#  (total_min, min_since_last, days_first_usage, maint_threshold)
#
#  total_min        : (min, max) de l'historique cumulé de la machine
#  min_since_last   : (min, max) depuis la dernière maintenance
#  days_first_usage : depuis combien de jours la machine est en service
#  maint_threshold  : seuil d'alerte en minutes
#
PROFILES = {
    "treadmill":    dict(total=(55_000, 130_000), since=(3_000, 14_000), days_first=(400, 700), threshold=9_000),
    "elliptical":   dict(total=(40_000,  90_000), since=(2_500, 11_000), days_first=(380, 680), threshold=8_000),
    "bike":         dict(total=(30_000,  75_000), since=(2_000,  9_500), days_first=(350, 650), threshold=7_000),
    "rowing":       dict(total=(18_000,  50_000), since=(1_200,  8_000), days_first=(300, 600), threshold=6_500),
    "squat":        dict(total=(28_000,  65_000), since=(2_000,  9_000), days_first=(350, 650), threshold=7_500),
    "smith":        dict(total=(32_000,  70_000), since=(2_500,  9_500), days_first=(360, 660), threshold=7_500),
    "lat_pulldown": dict(total=(28_000,  65_000), since=(1_800,  8_500), days_first=(340, 630), threshold=7_000),
    "cable":        dict(total=(30_000,  68_000), since=(2_000,  9_000), days_first=(350, 640), threshold=7_000),
    "leg_press":    dict(total=(25_000,  58_000), since=(1_800,  8_000), days_first=(330, 620), threshold=6_500),
    "bench":        dict(total=(22_000,  52_000), since=(1_500,  7_500), days_first=(320, 600), threshold=6_000),
    "dumbbell":     dict(total=(80_000, 200_000), since=(6_000, 18_000), days_first=(420, 720), threshold=14_000),
    "boxing":       dict(total=( 8_000,  22_000), since=(  800,  4_500), days_first=(200, 500), threshold=5_000),
    "mat":          dict(total=( 4_000,  12_000), since=(  500,  3_000), days_first=(180, 480), threshold=4_500),
    "weights":      dict(total=(15_000,  40_000), since=(1_200,  6_000), days_first=(250, 550), threshold=6_000),
}

DEFAULT_PROFILE = dict(total=(20_000, 60_000), since=(1_500, 8_000), days_first=(300, 600), threshold=7_000)

now = datetime.now()

with Session(engine) as session:
    machines = session.exec(select(GymMap).where(GymMap.gym_id == 1)).all()
    machines_sorted = sorted(machines, key=lambda m: m.id)   # ordre stable

    print(f"Mise à jour de {len(machines_sorted)} machines…\n")

    for idx, machine in enumerate(machines_sorted, start=1):
        p = PROFILES.get(machine.type, DEFAULT_PROFILE)

        # ── Dates ─────────────────────────────────────────────
        days_first  = random.randint(*p["days_first"])
        first       = now - timedelta(days=days_first)

        # La dernière maintenance a eu lieu entre 15 jours et 6 mois avant aujourd'hui
        # (mais pas avant first_usage)
        days_since_maint = random.randint(15, min(180, days_first - 1))
        last_maint  = now - timedelta(days=days_since_maint)

        # ── Minutes ───────────────────────────────────────────
        total       = random.randint(*p["total"])

        # since_last ne peut pas dépasser total
        since_raw   = random.randint(*p["since"])
        since       = min(since_raw, total)

        # ── Mise à jour ───────────────────────────────────────
        machine.gymview_id               = str(idx)          # entier stocké en str
        machine.first_usage              = first
        machine.last_maintenance_date    = last_maint
        machine.total_minutes            = total
        machine.minutes_since_last_maint = since
        machine.maintenance_threshold    = p["threshold"]

        session.add(machine)

        health = max(0, 100 - int(since / p["threshold"] * 100))
        flag   = "[CRITIQUE]" if health < 20 else ("[ALERTE]" if health < 50 else "[OK]")
        print(
            f"  [{idx:02d}] {machine.id:<6} | {machine.type:<14} | gymview={idx}"
            f" | total={total//60:>4}h | depuis={since//60:>4}h"
            f" | seuil={p['threshold']//60}h | sante={health:>3}% {flag}"
        )

    session.commit()
    print(f"\n✓ {len(machines_sorted)} machines mises à jour avec succès.")
