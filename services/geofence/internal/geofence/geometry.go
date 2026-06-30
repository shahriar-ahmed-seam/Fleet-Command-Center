// Package geofence implements the Geofence_Engine core: on each accepted
// Location_Ping it computes zone membership with boundary inclusion, compares
// the result against the vehicle's prior membership, and emits Enter/Exit
// Zone_Events on membership change (and nothing otherwise), attaching a zone's
// arrival label when configured before publishing to the queue
//
// Containment is computed two ways behind a single ZoneCatalog interface: a
// PostGIS-backed catalog (ST_Contains OR ST_Touches for inside-or-boundary) for
// production, and a pure-Go point-in-polygon catalog so the property tests run
// without a database.
package geofence

// Point is a WGS84 coordinate. Lng is treated as the x axis and Lat as the y
// axis for planar point-in-polygon evaluation.
type Point struct {
	Lat float64
	Lng float64
}

// Polygon is a closed linear ring of vertices. The ring may be supplied either
// open (first vertex not repeated) or closed (first == last); both are handled
type Polygon struct {
	Vertices []Point
}

// boundaryEpsilon bounds floating-point error when deciding whether a point
// lies exactly on a polygon edge.
const boundaryEpsilon = 1e-9

// ring returns the polygon vertices with any duplicated closing vertex removed,
// so edge iteration over i -> (i+1)%n visits each edge exactly once.
func (poly Polygon) ring() []Point {
	v := poly.Vertices
	n := len(v)
	if n >= 2 && v[0] == v[n-1] {
		return v[:n-1]
	}
	return v
}

// ContainsInclusive reports whether the point lies inside the polygon or on its
// boundary. A point on any edge or vertex is treated as inside, matching the
func (poly Polygon) ContainsInclusive(p Point) bool {
	ring := poly.ring()
	n := len(ring)
	if n < 3 {
		return false
	}

	// Boundary points count as inside (inclusive containment).
	for i := 0; i < n; i++ {
		a := ring[i]
		b := ring[(i+1)%n]
		if onSegment(a, b, p) {
			return true
		}
	}

	// Even-odd ray casting for strictly interior points. x = Lng, y = Lat.
	inside := false
	for i, j := 0, n-1; i < n; j, i = i, i+1 {
		yi, yj := ring[i].Lat, ring[j].Lat
		xi, xj := ring[i].Lng, ring[j].Lng
		// Does a horizontal ray from p cross edge (j -> i)?
		if (yi > p.Lat) != (yj > p.Lat) {
			xCross := (xj-xi)*(p.Lat-yi)/(yj-yi) + xi
			if p.Lng < xCross {
				inside = !inside
			}
		}
	}
	return inside
}

// onSegment reports whether point p lies on the closed segment a-b, allowing for
// small floating-point error.
func onSegment(a, b, p Point) bool {
	// Collinearity: cross product of (b-a) and (p-a) is ~zero.
	cross := (b.Lng-a.Lng)*(p.Lat-a.Lat) - (b.Lat-a.Lat)*(p.Lng-a.Lng)
	if cross > boundaryEpsilon || cross < -boundaryEpsilon {
		return false
	}
	// Within the segment's bounding box.
	if p.Lng < min(a.Lng, b.Lng)-boundaryEpsilon || p.Lng > max(a.Lng, b.Lng)+boundaryEpsilon {
		return false
	}
	if p.Lat < min(a.Lat, b.Lat)-boundaryEpsilon || p.Lat > max(a.Lat, b.Lat)+boundaryEpsilon {
		return false
	}
	return true
}
