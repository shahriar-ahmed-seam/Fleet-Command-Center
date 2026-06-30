from __future__ import annotations

import math
from dataclasses import dataclass

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

# Earth mean radius in metres (WGS84 sphere approximation), used for the
# haversine great-circle distance between lat/lng pairs.
EARTH_RADIUS_M = 6_371_000.0

# Co-location threshold: destinations within this many metres of each other are
GROUP_THRESHOLD_M = 25.0

# Distances are fed to OR-Tools as integers; metres scaled by this factor keep
# sub-metre precision without floating point in the solver.
DISTANCE_SCALE = 100

MIN_STOPS = 2
MAX_STOPS = 50


@dataclass(frozen=True)
class Stop:
    """A single delivery destination."""

    delivery_id: str
    lat: float
    lng: float


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres between two WGS84 coordinates."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_M * c


class _UnionFind:
    """Minimal union-find for transitive proximity clustering."""

    def __init__(self, n: int) -> None:
        self._parent = list(range(n))

    def find(self, x: int) -> int:
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        # Path compression.
        while self._parent[x] != root:
            self._parent[x], x = root, self._parent[x]
        return root

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self._parent[max(ra, rb)] = min(ra, rb)


def cluster_stops(stops: list[Stop]) -> list[list[Stop]]:
    """Group destinations within ``GROUP_THRESHOLD_M`` into shared stops.

    Returns a list of clusters (each a list of ``Stop``). Clustering is
    transitive and deterministic: clusters and their members preserve the input
    order so output ordering is stable for a given input.
    """
    n = len(stops)
    uf = _UnionFind(n)
    for i in range(n):
        for j in range(i + 1, n):
            dist = haversine_m(stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng)
            if dist <= GROUP_THRESHOLD_M:
                uf.union(i, j)

    clusters: dict[int, list[Stop]] = {}
    order: list[int] = []
    for idx, stop in enumerate(stops):
        root = uf.find(idx)
        if root not in clusters:
            clusters[root] = []
            order.append(root)
        clusters[root].append(stop)
    return [clusters[root] for root in order]


def _cluster_centroid(cluster: list[Stop]) -> tuple[float, float]:
    """Mean lat/lng of a cluster, used as its representative TSP node."""
    lat = sum(s.lat for s in cluster) / len(cluster)
    lng = sum(s.lng for s in cluster) / len(cluster)
    return lat, lng


def solve_tsp(
    origin: tuple[float, float],
    nodes: list[tuple[float, float]],
) -> list[int]:
    """Solve the open metric TSP from ``origin`` over ``nodes``.

    ``nodes`` are the clustered-stop representative coordinates. Returns the
    visiting order as indices into ``nodes`` (origin excluded). The route
    starts at the origin and does not return, matching a delivery run.
    """
    if not nodes:
        return []
    if len(nodes) == 1:
        return [0]

    # Node 0 is the origin; nodes[k] maps to routing index k + 1.
    points = [origin, *nodes]
    count = len(points)

    def dist(a: int, b: int) -> int:
        meters = haversine_m(points[a][0], points[a][1], points[b][0], points[b][1])
        return int(round(meters * DISTANCE_SCALE))

    # Single vehicle, fixed start at the origin. A dummy end node with zero cost
    # to/from every node makes the route "open" (no return-to-origin cost).
    manager = pywrapcp.RoutingIndexManager(count, 1, [0], [0])
    routing = pywrapcp.RoutingModel(manager)

    def transit_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        # Returning to the origin (node 0) is free so the route stays open.
        if to_node == 0:
            return 0
        return dist(from_node, to_node)

    transit_idx = routing.RegisterTransitCallback(transit_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.FromSeconds(5)

    solution = routing.SolveWithParameters(params)
    if solution is None:
        # Degenerate fallback: visit nodes in input order.
        return list(range(len(nodes)))

    order: list[int] = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node != 0:  # skip the origin
            order.append(node - 1)  # back to nodes[] index
        index = solution.Value(routing.NextVar(index))
    return order


class StopCountError(ValueError):
    """Raised when the stop count is outside the supported 2..50 range."""


def optimize(
    origin: tuple[float, float],
    stops: list[Stop],
) -> dict[str, list]:
    """Cluster co-located stops then solve the TSP from ``origin``.

    Returns ``{ "sequence": [deliveryId, ...], "groups": [[deliveryId, ...]] }``.
    ``sequence`` contains every input delivery id exactly once, ordered by the
    solved stop order (members of a co-located group are emitted together in
    input order). ``groups`` lists the clustered delivery-id sets in the same
    stop order.

    Raises ``StopCountError`` if ``len(stops)`` is outside ``[2, 50]`` — the
    caller is responsible for the >50 unoptimized fallback.
    """
    if not (MIN_STOPS <= len(stops) <= MAX_STOPS):
        raise StopCountError(
            f"optimizer supports {MIN_STOPS}..{MAX_STOPS} stops, got {len(stops)}"
        )

    clusters = cluster_stops(stops)
    centroids = [_cluster_centroid(c) for c in clusters]
    order = solve_tsp(origin, centroids)

    ordered_groups = [[s.delivery_id for s in clusters[i]] for i in order]
    sequence = [delivery_id for group in ordered_groups for delivery_id in group]
    return {"sequence": sequence, "groups": ordered_groups}
