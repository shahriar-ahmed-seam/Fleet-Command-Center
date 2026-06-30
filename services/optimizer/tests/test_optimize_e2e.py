from fastapi.testclient import TestClient

from optimizer.main import app

client = TestClient(app)


def test_optimize_returns_exact_cover_sequence_for_small_assignment():
    # Five deliveries spread around a Seattle-area origin.
    stops = [
        {"deliveryId": "d1", "lat": 47.6062, "lng": -122.3321},
        {"deliveryId": "d2", "lat": 47.6131, "lng": -122.3367},
        {"deliveryId": "d3", "lat": 47.6175, "lng": -122.3289},
        {"deliveryId": "d4", "lat": 47.6097, "lng": -122.3331},
        {"deliveryId": "d5", "lat": 47.6205, "lng": -122.3493},
    ]
    resp = client.post(
        "/optimize",
        json={"origin": {"lat": 47.6050, "lng": -122.3300}, "stops": stops},
    )
    assert resp.status_code == 200
    body = resp.json()

    requested = {s["deliveryId"] for s in stops}
    # Sequence is an exact cover: every delivery exactly once, no extras.
    assert sorted(body["sequence"]) == sorted(requested)
    assert len(body["sequence"]) == len(set(body["sequence"]))
    # Groups only ever reference requested deliveries.
    for group in body["groups"]:
        for did in group:
            assert did in requested


def test_optimize_groups_colocated_deliveries_into_one_stop():
    stops = [
        {"deliveryId": "d1", "lat": 47.60620, "lng": -122.33210},
        {"deliveryId": "d2", "lat": 47.60621, "lng": -122.33211},
        {"deliveryId": "d3", "lat": 47.6175, "lng": -122.3289},
    ]
    resp = client.post(
        "/optimize",
        json={"origin": {"lat": 47.6050, "lng": -122.3300}, "stops": stops},
    )
    assert resp.status_code == 200
    body = resp.json()
    # The two co-located deliveries are grouped together.
    grouped = [set(g) for g in body["groups"] if len(g) > 1]
    assert any({"d1", "d2"} <= g for g in grouped)


def test_optimize_rejects_out_of_range_stop_count():
    # A single stop is below the supported 2..50 range.
    resp = client.post(
        "/optimize",
        json={
            "origin": {"lat": 47.6050, "lng": -122.3300},
            "stops": [{"deliveryId": "d1", "lat": 47.6, "lng": -122.3}],
        },
    )
    assert resp.status_code == 422
