from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from optimizer.solver import GROUP_THRESHOLD_M, Stop, cluster_stops, haversine_m
from optimizer.testing import MIN_ITERATIONS

# Metres per degree of latitude (WGS84 mean); offsetting only north–south lets
# the generator place destinations a precise number of metres apart regardless
# of longitude.
_METRES_PER_DEG_LAT = 111_320.0


@st.composite
def colocated_destinations(draw: st.DrawFn) -> list[tuple[float, float]]:
    """Destinations clustered around a few seeds with near-threshold offsets."""
    num_seeds = draw(st.integers(min_value=1, max_value=5))
    seeds = [
        (
            draw(st.floats(min_value=-60.0, max_value=60.0, allow_nan=False, allow_infinity=False)),
            draw(st.floats(min_value=-150.0, max_value=150.0, allow_nan=False, allow_infinity=False)),
        )
        for _ in range(num_seeds)
    ]
    num_points = draw(st.integers(min_value=2, max_value=12))
    points: list[tuple[float, float]] = []
    for _ in range(num_points):
        seed_lat, seed_lng = seeds[draw(st.integers(min_value=0, max_value=num_seeds - 1))]
        # Offsets span the 25 m threshold so both "just inside" and "just
        # outside" pairs occur within a seed cluster.
        offset_m = draw(
            st.floats(min_value=0.0, max_value=60.0, allow_nan=False, allow_infinity=False)
        )
        points.append((seed_lat + offset_m / _METRES_PER_DEG_LAT, seed_lng))
    return points


def _expected_components(stops: list[Stop]) -> set[frozenset[str]]:
    """Connected components of the within-threshold proximity graph (oracle)."""
    n = len(stops)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(n):
        for j in range(i + 1, n):
            if haversine_m(stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng) <= GROUP_THRESHOLD_M:
                union(i, j)

    groups: dict[int, set[str]] = {}
    for idx in range(n):
        groups.setdefault(find(idx), set()).add(stops[idx].delivery_id)
    return {frozenset(members) for members in groups.values()}


def _as_id_sets(clusters: list[list[Stop]]) -> set[frozenset[str]]:
    return {frozenset(s.delivery_id for s in cluster) for cluster in clusters}


@settings(max_examples=MIN_ITERATIONS)
@given(colocated_destinations())
def test_property_28_colocated_destinations_grouped(
    coords: list[tuple[float, float]],
) -> None:
    # Unique ids so groups are well-defined as sets of delivery ids.
    stops = [Stop(delivery_id=f"d{i}", lat=lat, lng=lng) for i, (lat, lng) in enumerate(coords)]

    clusters = cluster_stops(stops)
    actual = _as_id_sets(clusters)

    # The grouping is exactly the connected components of the proximity graph:
    # this simultaneously guarantees that every within-25 m pair shares a group
    assert actual == _expected_components(stops)

    # Sanity: the grouping is a partition — every destination appears once.
    flattened = [s.delivery_id for cluster in clusters for s in cluster]
    assert sorted(flattened) == sorted(s.delivery_id for s in stops)

    # Direct restatement of the "within 25 m ⇒ same group" direction.
    group_of = {
        s.delivery_id: gi for gi, cluster in enumerate(clusters) for s in cluster
    }
    for i in range(len(stops)):
        for j in range(i + 1, len(stops)):
            if haversine_m(stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng) <= GROUP_THRESHOLD_M:
                assert group_of[stops[i].delivery_id] == group_of[stops[j].delivery_id]
