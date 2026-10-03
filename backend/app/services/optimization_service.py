import time
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from scipy.optimize import linprog
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.optimization import TransportResource, CorridorRouteSegment
from app.schemas.optimization import (
    SupplyAllocationRequest, SupplyAllocationResponse,
    SupplyAllocationItem, UnmetDemandItem,
    DependencyNode, DependencyEdge, DependencyGraphResponse,
    RippleDisruptionSimulation
)
from app.services.transport_resource_service import transport_resource_service
from app.services.road_network_service import road_network_service, haversine_km

logger = logging.getLogger(__name__)

CATEGORY_PRIORITY = {
    "MEDICAL_SUPPLIES": 1200.0,
    "FUEL": 950.0,
    "FOOD_WATER": 700.0,
    "GENERAL_SUPPLIES": 350.0,
}

VEHICLE_TYPE_PREFERENCE = {
    "FUEL": ["FUEL_TANKER", "HEAVY_TRUCK", "MEDIUM_TRUCK"],
    "MEDICAL_SUPPLIES": ["REFRIGERATED_VAN", "LIGHT_UTILITY", "MEDIUM_TRUCK"],
    "FOOD_WATER": ["HEAVY_TRUCK", "MEDIUM_TRUCK", "LIGHT_UTILITY"],
    "GENERAL_SUPPLIES": ["HEAVY_TRUCK", "MEDIUM_TRUCK", "LIGHT_UTILITY"]
}

class OptimizationService:
    def solve_supply_allocation(
        self,
        db: Session,
        request: SupplyAllocationRequest
    ) -> SupplyAllocationResponse:
        t0 = time.time()

        # 1. Fetch live or isolated database state
        locations = db.query(Location).filter(Location.is_active == True).all()
        loc_map = {l.id: l for l in locations}
        
        # Categorize supply vs demand nodes
        supply_nodes = [l for l in locations if l.location_type in ("HUB", "DISTRIBUTION_CENTER")]
        if not supply_nodes:
            supply_nodes = locations[:2]  # Fallback
        
        demand_nodes = [l for l in locations if l.location_type in ("FORWARD_DEPOT", "FIELD_HOSPITAL", "TRANSIT_NODE")]
        if not demand_nodes:
            demand_nodes = [l for l in locations if l not in supply_nodes]

        # Fetch inventory
        inv_items = db.query(InventoryItem).all()
        
        # Map available stock by (location_id, category)
        available_supply: Dict[Tuple[str, str], float] = {}
        min_safety_stock: Dict[Tuple[str, str], float] = {}
        for item in inv_items:
            key = (item.location_id, item.category)
            avail = max(0.0, item.available_stock - (item.min_stock if request.enforce_safety_stock else 0.0))
            available_supply[key] = available_supply.get(key, 0.0) + avail
            min_safety_stock[key] = item.min_stock

        # Determine demand requested per (location_id, category)
        categories = [request.category] if request.category and request.category != "ALL" else ["FOOD_WATER", "FUEL", "MEDICAL_SUPPLIES", "GENERAL_SUPPLIES"]
        
        demands: Dict[Tuple[str, str], float] = {}
        for d_node in demand_nodes:
            for cat in categories:
                # Target replenishment: if current stock < min_stock * 1.5, demand = (min_stock * 2 - stock) * multiplier
                loc_cat_items = [i for i in inv_items if i.location_id == d_node.id and i.category == cat]
                curr_stock = sum(i.available_stock for i in loc_cat_items)
                target = sum(i.min_stock * 2.0 for i in loc_cat_items)
                deficit = max(200.0, (target - curr_stock) * request.demand_multiplier)
                demands[(d_node.id, cat)] = round(deficit, 1)

        # 2. Transport resources & route links
        fleet = transport_resource_service.list_resources(db, status="AVAILABLE")
        blocked_routes = set(request.blocked_route_ids or [])

        # Link capacities and distances between each (s, d)
        routes_info: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for s in supply_nodes:
            for d in demand_nodes:
                d_km = haversine_km(s.latitude, s.longitude, d.latitude, d.longitude) * 1.2
                is_blocked = any(b in blocked_routes for b in [f"{s.id}:{d.id}", f"{d.id}:{s.id}", s.id, d.id])
                
                # Available capacity along corridor
                base_cap = sum(v.capacity_weight_kg for v in fleet) * request.transport_capacity_factor
                effective_cap = 0.0 if is_blocked else max(15000.0, base_cap * 0.4)
                
                routes_info[(s.id, d.id)] = {
                    "distance_km": round(d_km, 1),
                    "is_blocked": is_blocked,
                    "capacity_kg": effective_cap,
                    "cost_per_kg_km": 0.015  # ₹0.015 per kg-km
                }

        # 3. Formulate Linear Programming Problem with SciPy HiGHS
        # Decision variables:
        # x[s, d, c] >= 0 : amount of category c shipped from s to d
        # u[d, c] >= 0    : unmet demand of category c at d
        var_indices: Dict[Tuple[str, str, str], int] = {}
        unmet_indices: Dict[Tuple[str, str], int] = {}
        var_names: List[str] = []
        c_obj: List[float] = []

        var_count = 0
        for s in supply_nodes:
            for d in demand_nodes:
                for cat in categories:
                    var_indices[(s.id, d.id, cat)] = var_count
                    var_names.append(f"x_{s.id}_{d.id}_{cat}")
                    # Objective coefficient: transport cost
                    dist = routes_info[(s.id, d.id)]["distance_km"]
                    cost_coeff = request.transport_cost_weight * dist * routes_info[(s.id, d.id)]["cost_per_kg_km"]
                    if routes_info[(s.id, d.id)]["is_blocked"]:
                        cost_coeff += 100000.0  # Massive penalty for blocked routes
                    c_obj.append(cost_coeff)
                    var_count += 1

        for d in demand_nodes:
            for cat in categories:
                unmet_indices[(d.id, cat)] = var_count
                var_names.append(f"u_{d.id}_{cat}")
                # Priority penalty for unmet demand
                p_weight = request.priority_weights.get(cat) if (request.priority_weights and cat in request.priority_weights) else CATEGORY_PRIORITY.get(cat, 500.0)
                c_obj.append(p_weight)
                var_count += 1

        c_obj = np.array(c_obj, dtype=float)

        # Upper bounds / supply constraints (A_ub * x <= b_ub)
        A_ub_rows: List[List[float]] = []
        b_ub: List[float] = []

        # Constraint A: Available supply at each source s for category c
        for s in supply_nodes:
            for cat in categories:
                row = [0.0] * var_count
                for d in demand_nodes:
                    idx = var_indices[(s.id, d.id, cat)]
                    row[idx] = 1.0
                max_s = available_supply.get((s.id, cat), 0.0)
                A_ub_rows.append(row)
                b_ub.append(max_s)

        # Constraint B: Transport capacity per corridor link (s, d)
        for s in supply_nodes:
            for d in demand_nodes:
                row = [0.0] * var_count
                for cat in categories:
                    idx = var_indices[(s.id, d.id, cat)]
                    row[idx] = 1.0
                max_cap = routes_info[(s.id, d.id)]["capacity_kg"]
                A_ub_rows.append(row)
                b_ub.append(max_cap)

        # Equality constraints: Demand satisfaction (sum_s x[s,d,c] + u[d,c] = demand[d,c])
        A_eq_rows: List[List[float]] = []
        b_eq: List[float] = []

        for d in demand_nodes:
            for cat in categories:
                row = [0.0] * var_count
                for s in supply_nodes:
                    idx = var_indices[(s.id, d.id, cat)]
                    row[idx] = 1.0
                u_idx = unmet_indices[(d.id, cat)]
                row[u_idx] = 1.0
                req_demand = demands.get((d.id, cat), 0.0)
                A_eq_rows.append(row)
                b_eq.append(req_demand)

        A_ub = np.array(A_ub_rows, dtype=float) if A_ub_rows else None
        b_ub = np.array(b_ub, dtype=float) if b_ub else None
        A_eq = np.array(A_eq_rows, dtype=float) if A_eq_rows else None
        b_eq = np.array(b_eq, dtype=float) if b_eq else None

        # Bounds: all variables >= 0
        bounds = [(0.0, None) for _ in range(var_count)]

        # 4. Execute Solver
        res = linprog(
            c_obj,
            A_ub=A_ub,
            b_ub=b_ub,
            A_eq=A_eq,
            b_eq=b_eq,
            bounds=bounds,
            method="highs"
        )

        solve_time_ms = round((time.time() - t0) * 1000.0, 1)

        # 5. Extract Allocations and Deficits
        allocations: List[SupplyAllocationItem] = []
        unmet_breakdown: List[UnmetDemandItem] = []
        infeasible_reasons: List[str] = []

        total_demand_requested = sum(demands.values())
        total_allocated = 0.0
        total_unmet = 0.0
        total_cost = 0.0

        if not res.success:
            return SupplyAllocationResponse(
                solver_status="INFEASIBLE",
                solver_name="SciPy HiGHS Exact Linear/MILP Solver",
                total_demand_requested=total_demand_requested,
                total_allocated=0.0,
                total_unmet_demand=total_demand_requested,
                total_transport_cost=0.0,
                allocations=[],
                unmet_demand_breakdown=[],
                infeasible_constraints=[f"Solver failed: {res.message}"],
                trade_off_explanation="Constraints over-constrained the problem. Inspect blocked corridors or zero capacity.",
                solver_time_ms=solve_time_ms,
                calculated_at=datetime.utcnow()
            )

        sol = res.x

        # Group allocations
        for s in supply_nodes:
            for d in demand_nodes:
                for cat in categories:
                    idx = var_indices[(s.id, d.id, cat)]
                    qty = round(float(sol[idx]), 1)
                    if qty > 0.5:
                        d_info = routes_info[(s.id, d.id)]
                        cost = round(qty * d_info["distance_km"] * d_info["cost_per_kg_km"] * 10.0, 2)
                        
                        # Match a suitable available transport resource
                        matching_vehicle = None
                        pref_types = VEHICLE_TYPE_PREFERENCE.get(cat, ["MEDIUM_TRUCK"])
                        for v in fleet:
                            if v.vehicle_type in pref_types and v.current_location_id == s.id:
                                matching_vehicle = v
                                break
                        if not matching_vehicle and fleet:
                            matching_vehicle = fleet[0]

                        allocations.append(
                            SupplyAllocationItem(
                                source_location_id=s.id,
                                source_location_name=s.name,
                                destination_location_id=d.id,
                                destination_location_name=d.name,
                                category=cat,
                                quantity_allocated=qty,
                                transport_resource_id=matching_vehicle.id if matching_vehicle else "TR-EXT-01",
                                transport_resource_name=matching_vehicle.name if matching_vehicle else "On-Call Multi-Axle Carrier",
                                route_name=f"{s.name} to {d.name} Tactical Corridor",
                                distance_km=d_info["distance_km"],
                                estimated_cost=cost,
                                rationale=f"Optimal cost-to-priority dispatch over {d_info['distance_km']} km."
                            )
                        )
                        total_allocated += qty
                        total_cost += cost

        # Check unmet demand
        for d in demand_nodes:
            for cat in categories:
                u_idx = unmet_indices[(d.id, cat)]
                unmet_qty = round(float(sol[u_idx]), 1)
                req_qty = demands.get((d.id, cat), 0.0)
                if unmet_qty > 0.5:
                    total_unmet += unmet_qty
                    # Identify bottleneck
                    avail_sum = sum(available_supply.get((s.id, cat), 0.0) for s in supply_nodes)
                    if avail_sum < req_qty:
                        reason = f"Corridor-wide surplus deficit: available {avail_sum:.0f} < demanded {req_qty:.0f}"
                        infeasible_reasons.append(f"{cat} deficit at {d.name}: {reason}")
                    elif any(routes_info[(s.id, d.id)]["is_blocked"] for s in supply_nodes):
                        reason = "Primary transit corridor blocked or restricted"
                        infeasible_reasons.append(f"Route to {d.name} blocked")
                    else:
                        reason = "Transport payload capacity throttle"
                        infeasible_reasons.append(f"Transport bottleneck to {d.name}")

                    unmet_breakdown.append(
                        UnmetDemandItem(
                            destination_location_id=d.id,
                            destination_name=d.name,
                            category=cat,
                            forecast_demand=req_qty,
                            allocated_quantity=round(req_qty - unmet_qty, 1),
                            unmet_quantity=unmet_qty,
                            shortage_reason=reason
                        )
                    )

        status = "OPTIMAL" if total_unmet < 1.0 else "FEASIBLE_WITH_DEFICIT"

        explanation = (
            f"Exact HiGHS Linear Program solved in {solve_time_ms} ms. "
            f"Fulfilled {total_allocated:.0f} of {total_demand_requested:.0f} requested units ({total_allocated / max(total_demand_requested, 1.0) * 100.0:.1f}% fulfillment rate). "
        )
        if total_unmet > 0:
            explanation += f"Deficit of {total_unmet:.0f} units prioritized higher criticality categories (Medical/Fuel over General supplies)."
        else:
            explanation += "All forecast demands fully satisfied within available fleet payloads and corridor constraints."

        return SupplyAllocationResponse(
            solver_status=status,
            solver_name="SciPy HiGHS Exact Linear/MILP Solver",
            total_demand_requested=round(total_demand_requested, 1),
            total_allocated=round(total_allocated, 1),
            total_unmet_demand=round(total_unmet, 1),
            total_transport_cost=round(total_cost, 2),
            allocations=allocations,
            unmet_demand_breakdown=unmet_breakdown,
            infeasible_constraints=list(set(infeasible_reasons)),
            trade_off_explanation=explanation,
            solver_time_ms=solve_time_ms,
            calculated_at=datetime.utcnow()
        )

    def get_dependency_graph(self, db: Session) -> DependencyGraphResponse:
        """Gathers registered nodes, live stocks, burn rates, and corridor edges."""
        locations = db.query(Location).filter(Location.is_active == True).all()
        inv_items = db.query(InventoryItem).all()
        corridors = road_network_service.list_corridors(db)

        nodes: List[DependencyNode] = []
        for loc in locations:
            loc_items = [i for i in inv_items if i.location_id == loc.id]
            stock = sum(i.available_stock for i in loc_items)
            # Estimate daily burn rate based on category min stock
            burn_rate = sum(max(10.0, i.min_stock * 0.15) for i in loc_items)
            days_to_shortage = round(stock / max(burn_rate, 1.0), 1) if burn_rate > 0 else 99.0

            nodes.append(
                DependencyNode(
                    id=loc.id,
                    name=loc.name,
                    location_type=loc.location_type,
                    latitude=loc.latitude,
                    longitude=loc.longitude,
                    elevation_m=loc.elevation_m,
                    status=loc.status,
                    risk_state="CRITICAL" if days_to_shortage < 3.0 else ("AT_RISK" if days_to_shortage < 5.0 else ("WATCH" if days_to_shortage < 8.0 else "STABLE")),
                    total_available_stock=round(stock, 1),
                    daily_burn_rate=round(burn_rate, 1),
                    days_to_shortage=days_to_shortage
                )
            )

        edges: List[DependencyEdge] = []
        loc_dict = {l.id: l.name for l in locations}
        for c in corridors:
            edges.append(
                DependencyEdge(
                    id=c.id,
                    source=c.origin_location_id,
                    target=c.destination_location_id,
                    source_name=loc_dict.get(c.origin_location_id, c.origin_location_id),
                    target_name=loc_dict.get(c.destination_location_id, c.destination_location_id),
                    distance_km=c.distance_km,
                    road_class=c.road_class,
                    is_blocked=c.is_blocked,
                    average_flow_rate=round(c.distance_km * 12.0, 1)
                )
            )

        return DependencyGraphResponse(
            nodes=nodes,
            edges=edges,
            ripple_analysis=None,
            source_attribution="Topology grounded in registered forward locations & OSM corridor links."
        )

    def simulate_ripple_disruption(
        self,
        db: Session,
        disrupted_node_id: Optional[str] = None,
        disrupted_link_id: Optional[str] = None
    ) -> RippleDisruptionSimulation:
        """
        Simulates hypothetical disruption of a key supply node or road link.
        Calculates acceleration of shortages and downstream isolated nodes.
        """
        graph_resp = self.get_dependency_graph(db)
        nodes = graph_resp.nodes
        edges = graph_resp.edges

        affected: List[Dict[str, Any]] = []
        isolated_nodes: List[str] = []
        total_delta_unmet = 0.0

        if disrupted_node_id:
            target_node = next((n for n in nodes if n.id == disrupted_node_id), None)
            target_name = target_node.name if target_node else disrupted_node_id

            # Downstream nodes receiving replenishments from target
            connected_edges = [e for e in edges if e.source == disrupted_node_id]
            for edge in connected_edges:
                dep_node = next((n for n in nodes if n.id == edge.target), None)
                if dep_node:
                    accelerated_days = round(dep_node.days_to_shortage * 0.45, 1)
                    new_risk = "CRITICAL" if accelerated_days < 3.0 else "AT_RISK"
                    delta_unmet = round(dep_node.daily_burn_rate * 3.5, 1)
                    total_delta_unmet += delta_unmet

                    affected.append({
                        "node_id": dep_node.id,
                        "node_name": dep_node.name,
                        "baseline_days_to_shortage": dep_node.days_to_shortage,
                        "projected_days_to_shortage": accelerated_days,
                        "baseline_risk": dep_node.risk_state,
                        "projected_risk": new_risk,
                        "dependent_supply_link": edge.id,
                        "unmet_demand_impact": delta_unmet,
                        "rationale": f"Primary replenishment channel from {target_name} severed. Existing stock depleted at current burn rate."
                    })

        elif disrupted_link_id:
            target_edge = next((e for e in edges if e.id == disrupted_link_id), None)
            if target_edge:
                dest_node = next((n for n in nodes if n.id == target_edge.target), None)
                if dest_node:
                    # Check if destination has other active inbound edges
                    other_inbounds = [e for e in edges if e.target == target_edge.target and e.id != disrupted_link_id and not e.is_blocked]
                    if not other_inbounds:
                        isolated_nodes.append(dest_node.id)

                    accelerated_days = round(dest_node.days_to_shortage * 0.5, 1)
                    delta_unmet = round(dest_node.daily_burn_rate * 2.5, 1)
                    total_delta_unmet += delta_unmet

                    affected.append({
                        "node_id": dest_node.id,
                        "node_name": dest_node.name,
                        "baseline_days_to_shortage": dest_node.days_to_shortage,
                        "projected_days_to_shortage": accelerated_days,
                        "baseline_risk": dest_node.risk_state,
                        "projected_risk": "CRITICAL" if accelerated_days < 3.0 else "AT_RISK",
                        "dependent_supply_link": target_edge.id,
                        "unmet_demand_impact": delta_unmet,
                        "rationale": f"Conduit {target_edge.source_name} -> {target_edge.target_name} blocked. Rerouting adds transit lag."
                    })

        summary = (
            f"Disruption impact analysis: {len(affected)} forward locations impacted. "
            f"Projected additional unmet demand of {total_delta_unmet:.1f} units. "
            f"Identified {len(isolated_nodes)} isolated network vertices requiring tactical aerial or off-road bypass."
        )

        return RippleDisruptionSimulation(
            disrupted_node_id=disrupted_node_id,
            disrupted_link_id=disrupted_link_id,
            affected_nodes=affected,
            isolated_nodes=isolated_nodes,
            total_unmet_demand_delta=round(total_delta_unmet, 1),
            acceleration_summary=summary
        )

optimization_service = OptimizationService()
