package geofence

import "context"

// Zone is a geo-fence region the engine evaluates membership against. Polygon
// is populated for the pure-Go catalog; the PostGIS catalog evaluates
// containment in the database and leaves Polygon empty. ArrivalLabel is non-nil
type Zone struct {
	ID           string
	ArrivalLabel *string
	Polygon      Polygon
}

// ZoneCatalog answers the two questions the engine asks per ping: which zones
// contain a point now (boundary inclusive), and what a zone's configuration is
// (so an Exit event for a zone the vehicle just left can still carry its label).
type ZoneCatalog interface {
	// Containing returns every zone whose area includes the point, treating the
	Containing(ctx context.Context, p Point) ([]Zone, error)
	// Lookup returns a zone by id; ok is false when no such zone exists.
	Lookup(ctx context.Context, zoneID string) (zone Zone, ok bool, err error)
}

// InMemoryCatalog is a pure-Go ZoneCatalog backed by polygons evaluated with
// ContainsInclusive. It lets the engine and its property tests run without a
// database while exercising the same boundary-inclusion semantics as PostGIS.
type InMemoryCatalog struct {
	zones []Zone
}

// NewInMemoryCatalog builds a catalog over the given zones.
func NewInMemoryCatalog(zones ...Zone) *InMemoryCatalog {
	return &InMemoryCatalog{zones: zones}
}

// Containing returns the zones whose polygon includes p (boundary inclusive).
func (c *InMemoryCatalog) Containing(_ context.Context, p Point) ([]Zone, error) {
	var out []Zone
	for _, z := range c.zones {
		if z.Polygon.ContainsInclusive(p) {
			out = append(out, z)
		}
	}
	return out, nil
}

// Lookup returns a zone by id.
func (c *InMemoryCatalog) Lookup(_ context.Context, zoneID string) (Zone, bool, error) {
	for _, z := range c.zones {
		if z.ID == zoneID {
			return z, true, nil
		}
	}
	return Zone{}, false, nil
}
