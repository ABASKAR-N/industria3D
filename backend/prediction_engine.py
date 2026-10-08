"""
prediction_engine.py - Explainable 7-day health & risk forecasting and predictive maintenance
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import math


# ─── Risk Levels ──────────────────────────────────────────────────────────────

def health_to_risk_level(health: float) -> str:
    if health >= 80:
        return "LOW"
    elif health >= 60:
        return "MEDIUM"
    elif health >= 40:
        return "HIGH"
    else:
        return "CRITICAL"


def risk_level_to_score(level: str) -> float:
    mapping = {"LOW": 15.0, "MEDIUM": 40.0, "HIGH": 70.0, "CRITICAL": 95.0}
    return mapping.get(level, 40.0)


def recommendation_for_risk(risk_level: str) -> str:
    recs = {
        "LOW": "Continue continuous telemetry monitoring. Asset operating within optimal baseline tolerances.",
        "MEDIUM": "Schedule preventative maintenance within 7 days. Inspect section wear progression.",
        "HIGH": "Priority inspection required within 48-72 hours. Prepare replacement spares for affected sections.",
        "CRITICAL": "Immediate intervention required. Isolate unit or throttle load to prevent catastrophic failure.",
    }
    return recs.get(risk_level, "Monitor closely.")


# ─── Health Score Calculation ─────────────────────────────────────────────────

def calculate_health_score(defects: List[Dict]) -> float:
    """
    Calculate component health score from detected defects.
    Score starts at 100 and degrades based on defect count, severity, and confidence.
    """
    if not defects:
        return 95.0

    severity_weights = {"low": 3.0, "medium": 8.0, "high": 15.0, "critical": 25.0}
    total_penalty = 0.0

    for defect in defects:
        severity = defect.get("severity", "medium")
        confidence = defect.get("confidence", 0.7)
        weight = severity_weights.get(severity, 8.0)
        total_penalty += weight * confidence

    health = 100.0 - (total_penalty * (1 - math.exp(-total_penalty / 50.0)))
    return round(max(5.0, min(100.0, health)), 1)


# ─── 7-Day Forecast ───────────────────────────────────────────────────────────

def generate_forecast(
    component_id: int,
    component_name: str,
    inspections: List[Dict],
    current_health: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Generate 7-day health and risk forecast from inspection history.
    """
    now = datetime.now(timezone.utc)
    is_demo_data = False

    history_points = []
    for insp in sorted(inspections, key=lambda x: x.get("timestamp", now)):
        ts = insp.get("timestamp", now)
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        days_ago = (now - ts).total_seconds() / 86400
        history_points.append({
            "days_ago": days_ago,
            "health": insp.get("health_score", 80.0),
            "is_demo": insp.get("is_demo", False),
        })

    if any(p["is_demo"] for p in history_points):
        is_demo_data = True

    if not history_points:
        history_points = _generate_demo_history(now)
        is_demo_data = True

    c_health = current_health if current_health is not None else history_points[-1]["health"]
    rate = _calc_degradation_rate(history_points, c_health)

    forecast_points = []
    # 7 historical points
    for i in range(7, 0, -1):
        dt = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        h = _interpolate_health(history_points, i, c_health, rate)
        rl = health_to_risk_level(h)
        forecast_points.append({
            "date": dt,
            "health_score": round(h, 1),
            "risk_score": risk_level_to_score(rl),
            "risk_level": rl,
            "recommendation": recommendation_for_risk(rl),
            "is_forecast": False,
        })

    # Today
    today_rl = health_to_risk_level(c_health)
    forecast_points.append({
        "date": now.strftime("%Y-%m-%d"),
        "health_score": round(c_health, 1),
        "risk_score": risk_level_to_score(today_rl),
        "risk_level": today_rl,
        "recommendation": recommendation_for_risk(today_rl),
        "is_forecast": False,
    })

    # 7 future days
    projected = c_health
    for i in range(1, 8):
        dt = (now + timedelta(days=i)).strftime("%Y-%m-%d")
        projected = max(5.0, min(100.0, projected + rate))
        rl = health_to_risk_level(projected)
        forecast_points.append({
            "date": dt,
            "health_score": round(projected, 1),
            "risk_score": risk_level_to_score(rl),
            "risk_level": rl,
            "recommendation": recommendation_for_risk(rl),
            "is_forecast": True,
        })

    trend = "degrading" if rate < -0.3 else ("improving" if rate > 0.3 else "stable")

    return {
        "component_id": component_id,
        "component_name": component_name,
        "current_health": c_health,
        "current_risk_level": today_rl,
        "trend": trend,
        "forecast": forecast_points,
        "recommendation": recommendation_for_risk(today_rl),
        "is_demo_data": is_demo_data,
    }


# ─── Predictive Maintenance Intelligence ──────────────────────────────────────

def generate_predictive_maintenance(
    component_id: int,
    component_name: str,
    inspections: List[Dict],
    current_health: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Computes comprehensive Predictive Maintenance analytics:
    - RUL (Remaining Useful Life) in days and operating hours
    - Failure probability % within the 14-day horizon
    - Section-specific wear breakdown with 3D bounded coordinates
    - Optimal maintenance intervention window
    """
    forecast_data = generate_forecast(component_id, component_name, inspections, current_health)
    c_health = forecast_data["current_health"]
    trend = forecast_data["trend"]
    now = datetime.now(timezone.utc)

    # Calculate degradation slope
    degrade_rate = 1.2 if trend == "degrading" else (0.4 if trend == "stable" else 0.2)
    critical_threshold = 40.0

    if c_health <= critical_threshold:
        rul_days = max(1, int((c_health / critical_threshold) * 3))
        fail_prob = min(98.5, 80.0 + (critical_threshold - c_health) * 0.5)
        maint_window = "Immediate Intervention (Within 24 Hours)"
        priority = "Urgent"
    elif c_health < 65.0:
        rul_days = max(4, int((c_health - critical_threshold) / degrade_rate))
        fail_prob = round(45.0 + (65.0 - c_health) * 1.2, 1)
        maint_window = f"Recommended Window: Next {rul_days} Days"
        priority = "Elevated"
    elif c_health < 85.0:
        rul_days = max(12, int((c_health - critical_threshold) / degrade_rate))
        fail_prob = round(15.0 + (85.0 - c_health) * 0.8, 1)
        maint_window = f"Planned Inspection: In {rul_days} Days"
        priority = "Standard"
    else:
        rul_days = max(30, int((c_health - critical_threshold) / degrade_rate))
        fail_prob = round(max(2.1, (100.0 - c_health) * 0.5), 1)
        maint_window = "Nominal Routine Service: 30+ Days"
        priority = "Routine"

    rul_hours = rul_days * 24

    # Extract all defects from latest inspection
    latest_insp = inspections[0] if inspections else {}
    latest_defects = latest_insp.get("defects", [])
    critical_count = sum(1 for d in latest_defects if d.get("severity") in ("high", "critical"))

    # Section-specific breakdown
    sections_catalog = [
        {
            "name": "Impeller Casing",
            "bbox_3d": {"center": [0.0, -0.2, 0.4], "size": [0.7, 0.6, 0.6]},
            "base_wear": 18.0,
        },
        {
            "name": "Drive Shaft & Bearings",
            "bbox_3d": {"center": [0.4, 0.3, 0.0], "size": [0.8, 0.4, 0.4]},
            "base_wear": 12.0,
        },
        {
            "name": "Discharge Flange",
            "bbox_3d": {"center": [-0.3, 0.6, 0.2], "size": [0.5, 0.5, 0.5]},
            "base_wear": 15.0,
        },
        {
            "name": "Motor Coupling Housing",
            "bbox_3d": {"center": [-0.5, -0.1, -0.3], "size": [0.6, 0.5, 0.6]},
            "base_wear": 10.0,
        },
    ]

    sections_wear = []
    for sec in sections_catalog:
        sec_name = sec["name"]
        sec_defects = [
            d for d in latest_defects
            if (d.get("section_name") == sec_name or (d.get("description", "").find(sec_name) != -1))
        ]
        count = len(sec_defects)
        highest_sev = "low"
        wear = sec["base_wear"]

        if count > 0:
            sevs = [d.get("severity", "low") for d in sec_defects]
            if "critical" in sevs:
                highest_sev = "critical"
                wear = min(95.0, wear + 65.0)
            elif "high" in sevs:
                highest_sev = "high"
                wear = min(85.0, wear + 45.0)
            elif "medium" in sevs:
                highest_sev = "medium"
                wear = min(60.0, wear + 25.0)
            else:
                highest_sev = "low"
                wear = min(40.0, wear + 12.0)
        else:
            # Add general proportional wear
            wear = min(90.0, round(sec["base_wear"] + (100.0 - c_health) * 0.4, 1))

        sections_wear.append({
            "section_name": sec_name,
            "wear_level": round(wear, 1),
            "defect_count": count,
            "highest_severity": highest_sev,
            "bbox_3d": sec["bbox_3d"],
        })

    return {
        "component_id": component_id,
        "component_name": component_name,
        "current_health": c_health,
        "current_risk_level": forecast_data["current_risk_level"],
        "rul_days": rul_days,
        "rul_operating_hours": rul_hours,
        "failure_probability_pct": fail_prob,
        "critical_defects_count": critical_count,
        "trend": trend,
        "forecast": forecast_data["forecast"],
        "recommendation": forecast_data["recommendation"],
        "maintenance_window": maint_window,
        "action_priority": priority,
        "sections_wear": sections_wear,
        "is_demo_data": forecast_data["is_demo_data"],
    }


def _calc_degradation_rate(history_points: List[Dict], current_health: float) -> float:
    if len(history_points) < 2:
        return -0.5

    pts = sorted(history_points, key=lambda x: x["days_ago"], reverse=True)
    n = len(pts)
    xs = list(range(n))
    ys = [p["health"] for p in pts]

    xs.append(n)
    ys.append(current_health)

    n_total = len(xs)
    x_mean = sum(xs) / n_total
    y_mean = sum(ys) / n_total

    num = sum((xs[i] - x_mean) * (ys[i] - y_mean) for i in range(n_total))
    den = sum((xs[i] - x_mean) ** 2 for i in range(n_total))

    if den == 0:
        return -0.5

    slope = num / den
    return round(slope, 3)


def _interpolate_health(history_points: List[Dict], days_ago: int, current: float, rate: float) -> float:
    if not history_points:
        return max(5.0, current - rate * days_ago)

    closest = min(history_points, key=lambda p: abs(p["days_ago"] - days_ago))
    return max(5.0, min(100.0, closest["health"]))


def _generate_demo_history(now: datetime) -> List[Dict]:
    base_health = 95.0
    points = []
    for i in range(14, 0, -1):
        degradation = i * 0.8 + (i % 3) * 1.5
        health = max(40.0, base_health - degradation)
        points.append({
            "days_ago": i,
            "health": round(health, 1),
            "is_demo": True,
        })
    return points


# ─── What-If Scenario Prediction Engine ────────────────────────────────────────

def simulate_what_if(
    component_id: int,
    component_name: str,
    inspections: List[Dict],
    current_health: Optional[float] = None,
    load_factor: float = 1.0,
    temperature_offset_c: float = 0.0,
    vibration_factor: float = 1.0,
    cooler_efficiency_pct: float = 100.0,
    valve_lag_pct: float = 0.0,
    maintenance_delay_days: int = 0,
    lubrication_quality: float = 1.0,
    scenario_name: str = "Custom Scenario",
) -> Dict[str, Any]:
    """
    Simulates What-If operational and environmental conditions on component health,
    RUL, failure probability, and subsystem section wear.
    """
    base_data = generate_predictive_maintenance(
        component_id, component_name, inspections, current_health
    )
    base_health = float(base_data["current_health"])
    base_rul = int(base_data["rul_days"])
    base_fail_prob = float(base_data["failure_probability_pct"])
    base_risk = base_data["current_risk_level"]
    base_trend = base_data["trend"]
    base_forecast = base_data["forecast"]

    # Physics & empirical stress factor modeling
    load_mult = max(0.4, min(3.0, load_factor ** 1.6))
    temp_mult = 1.0 + max(-0.4, temperature_offset_c * 0.028)
    cooling_deficit = max(0.0, 100.0 - cooler_efficiency_pct)
    cooling_mult = 1.0 + (cooling_deficit * 0.012)
    vibe_mult = max(0.5, min(3.5, vibration_factor ** 1.4))
    lag_mult = 1.0 + (max(0.0, valve_lag_pct) * 0.014)
    lube_deficit = max(0.0, 1.0 - lubrication_quality)
    lube_mult = 1.0 + (lube_deficit * 1.25)
    delay_mult = 1.0 + (max(0, maintenance_delay_days) * 0.035)

    combined_mult = load_mult * temp_mult * cooling_mult * vibe_mult * lag_mult * lube_mult * delay_mult
    stress_multiplier = round(max(0.25, min(8.5, combined_mult)), 2)

    base_degrade_rate = 1.2 if base_trend == "degrading" else (0.45 if base_trend == "stable" else 0.25)
    sim_degrade_rate = base_degrade_rate * stress_multiplier

    critical_threshold = 40.0
    if base_health <= critical_threshold:
        sim_rul_days = max(1, int((base_health / critical_threshold) * (2.5 / max(stress_multiplier, 0.4))))
    else:
        effective_headroom = base_health - critical_threshold
        sim_rul_days = max(1, int(effective_headroom / max(sim_degrade_rate, 0.05)))
    
    sim_rul_hours = sim_rul_days * 24

    adjusted_prob = base_fail_prob * (stress_multiplier ** 0.8) + (maintenance_delay_days * 1.2)
    sim_fail_prob = round(max(1.5, min(99.2, adjusted_prob)), 1)

    sim_health_day7 = round(max(5.0, min(100.0, base_health - (sim_degrade_rate * 7))), 1)
    sim_health_day14 = round(max(5.0, min(100.0, base_health - (sim_degrade_rate * 14))), 1)
    sim_risk_level = health_to_risk_level(sim_health_day7)
    
    if sim_risk_level == "CRITICAL" or sim_rul_days <= 3 or sim_fail_prob >= 75:
        sim_priority = "Urgent"
    elif sim_risk_level == "HIGH" or sim_rul_days <= 10 or sim_fail_prob >= 40:
        sim_priority = "Elevated"
    elif sim_risk_level == "MEDIUM":
        sim_priority = "Standard"
    else:
        sim_priority = "Routine"

    trajectory = []
    day_counter = 0
    for pt in base_forecast:
        is_fc = pt.get("is_forecast", False)
        base_h = pt["health_score"]
        base_r = pt["risk_score"]
        if not is_fc:
            trajectory.append({
                "date": pt["date"],
                "baseline_health": base_h,
                "simulated_health": base_h,
                "baseline_risk": base_r,
                "simulated_risk": base_r,
                "simulated_risk_level": pt["risk_level"],
                "is_forecast": False,
            })
        else:
            day_counter += 1
            sim_h = round(max(5.0, min(100.0, base_health - (sim_degrade_rate * day_counter))), 1)
            sim_rl = health_to_risk_level(sim_h)
            sim_r = risk_level_to_score(sim_rl)
            trajectory.append({
                "date": pt["date"],
                "baseline_health": base_h,
                "simulated_health": sim_h,
                "baseline_risk": base_r,
                "simulated_risk": sim_r,
                "simulated_risk_level": sim_rl,
                "is_forecast": True,
            })

    sections_impact = []
    for sec in base_data.get("sections_wear", []):
        name = sec["section_name"]
        bw = sec["wear_level"]
        
        if "Shaft" in name or "Bearing" in name:
            sensitivity = (vibe_mult * 0.5) + (load_mult * 0.4) + (lube_mult * 0.3)
        elif "Impeller" in name or "Casing" in name:
            sensitivity = (load_mult * 0.6) + (cooling_mult * 0.3)
        elif "Discharge" in name or "Flange" in name:
            sensitivity = (lag_mult * 0.5) + (load_mult * 0.4)
        elif "Motor" in name or "Coupling" in name:
            sensitivity = (temp_mult * 0.4) + (vibe_mult * 0.4) + (delay_mult * 0.2)
        else:
            sensitivity = stress_multiplier * 0.6
            
        wear_diff = round((sensitivity - 1.0) * 22.0 + (maintenance_delay_days * 0.5), 1)
        sim_wear = round(max(5.0, min(99.0, bw + wear_diff)), 1)
        delta = round(sim_wear - bw, 1)
        
        if sim_wear >= 75:
            r_status = "CRITICAL"
        elif sim_wear >= 55:
            r_status = "HIGH"
        elif sim_wear >= 35:
            r_status = "MEDIUM"
        else:
            r_status = "LOW"
            
        sections_impact.append({
            "section_name": name,
            "baseline_wear": bw,
            "simulated_wear": sim_wear,
            "wear_delta": delta,
            "risk_status": r_status,
        })

    recs = []
    warnings = []

    if stress_multiplier > 1.8:
        warnings.append(
            f"HIGH STRESS ACCELERATION: Asset degradation rate is amplified by {stress_multiplier}x under this scenario."
        )
    if sim_rul_days <= 5:
        warnings.append(
            f"IMMINENT OUTAGE RISK: Remaining Useful Life shortened to {sim_rul_days} days. High probability of unscheduled trip."
        )
    if cooler_efficiency_pct < 60:
        warnings.append(
            f"HYDRAULIC OVERHEATING: Cooler operating at only {cooler_efficiency_pct}% efficiency; oil breakdown accelerating."
        )
    if load_factor > 1.2:
        warnings.append(
            f"OVERLOAD CONDITION: Sustained {int(load_factor*100)}% load exceeds continuous thermal and mechanical envelope."
        )
    if maintenance_delay_days > 7:
        warnings.append(
            f"DEFERRED SERVICE RISK: Maintenance delayed by {maintenance_delay_days} days compounds micro-cracking and friction."
        )

    if load_factor > 1.15:
        recs.append(f"Throttle operating throughput to 95-100% nominal load to recover ~{int((load_factor-1.0)*25)} days of component life.")
    if cooler_efficiency_pct < 75:
        recs.append("Execute backwash flush on heat exchanger / cooler circuit to restore thermal efficiency above 90%.")
    if vibration_factor > 1.3:
        recs.append("Inspect rotating shaft alignment and dynamic balancing; check mounting bolts for looseness.")
    if lubrication_quality < 0.7:
        recs.append("Refill lubricant and replace high-pressure filters; contamination indices elevated.")
    if maintenance_delay_days > 0:
        recs.append(f"Reschedule service window immediately to avoid catastrophic fatigue failure within {sim_rul_days} days.")
    if stress_multiplier < 0.9:
        recs.append(f"ECO PROFILE GAIN: Optimized operating parameters provide an estimated +{max(1, sim_rul_days - base_rul)} days lifespan extension.")
    if not recs:
        recs.append("Asset conditions remain inside safe operating margins. Continue nominal preventative inspection schedule.")

    rul_delta = sim_rul_days - base_rul
    fail_prob_delta = round(sim_fail_prob - base_fail_prob, 1)
    last_base_h = base_forecast[-1]["health_score"] if base_forecast else base_health
    health_delta = round(sim_health_day14 - last_base_h, 1)

    return {
        "component_id": component_id,
        "component_name": component_name,
        "scenario_name": scenario_name or "Custom Scenario",
        "stress_multiplier": stress_multiplier,
        "baseline_health": base_health,
        "baseline_rul_days": base_rul,
        "baseline_failure_prob_pct": base_fail_prob,
        "baseline_risk_level": base_risk,
        "simulated_health_day7": sim_health_day7,
        "simulated_health_day14": sim_health_day14,
        "simulated_rul_days": sim_rul_days,
        "simulated_rul_hours": sim_rul_hours,
        "simulated_failure_prob_pct": sim_fail_prob,
        "simulated_risk_level": sim_risk_level,
        "simulated_action_priority": sim_priority,
        "rul_delta_days": rul_delta,
        "failure_prob_delta_pct": fail_prob_delta,
        "health_delta_pct": health_delta,
        "trajectory": trajectory,
        "sections_impact": sections_impact,
        "recommendations": recs,
        "operational_warnings": warnings,
    }

