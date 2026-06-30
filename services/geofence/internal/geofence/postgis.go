package geofence

import (
	"context"
	"database/sql"
	"fmt"
)

// Queryer is the subset of *sql.DB the PostGIS catalog needs, so a connection
// pool (or a transaction) can be injected and tests can substitute a fake.
type Queryer interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// PostGISCatalog answers containment queries against the PostGIS "Zone" table.
//
// Inside-or-boundary membership is computed with ST_Contains OR ST_Touches:
// ST_Contains is true for points in the polygon interior, and ST_Touches is
// true for points exactly on the boundary, so their union is "inside or on the
// boundary" for Enter events and its complement is "strictly outside" for Exit
type PostGISCatalog struct {
	db Queryer
}

// NewPostGISCatalog builds a catalog over the given database handle.
func NewPostGISCatalog(db Queryer) *PostGISCatalog {
	return &PostGISCatalog{db: db}
}

const containingQuery = `
SELECT id::text, "arrivalLabel"
FROM "Zone"
WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
   OR ST_Touches(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))`

// Containing returns the zones whose area includes the point (boundary
// inclusive). Coordinates are passed as ($1=lng, $2=lat) to match PostGIS
// ST_MakePoint(x, y) ordering.
func (c *PostGISCatalog) Containing(ctx context.Context, p Point) ([]Zone, error) {
	rows, err := c.db.QueryContext(ctx, containingQuery, p.Lng, p.Lat)
	if err != nil {
		return nil, fmt.Errorf("geofence: containment query: %w", err)
	}
	defer rows.Close()

	var zones []Zone
	for rows.Next() {
		var (
			id    string
			label sql.NullString
		)
		if scanErr := rows.Scan(&id, &label); scanErr != nil {
			return nil, fmt.Errorf("geofence: scan zone: %w", scanErr)
		}
		zones = append(zones, Zone{ID: id, ArrivalLabel: nullToPtr(label)})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("geofence: iterate zones: %w", err)
	}
	return zones, nil
}

const lookupQuery = `SELECT id::text, "arrivalLabel" FROM "Zone" WHERE id = $1`

// Lookup returns a zone by id, used to label Exit events for zones the vehicle
// has just left.
func (c *PostGISCatalog) Lookup(ctx context.Context, zoneID string) (Zone, bool, error) {
	var (
		id    string
		label sql.NullString
	)
	err := c.db.QueryRowContext(ctx, lookupQuery, zoneID).Scan(&id, &label)
	switch {
	case err == sql.ErrNoRows:
		return Zone{}, false, nil
	case err != nil:
		return Zone{}, false, fmt.Errorf("geofence: lookup zone %s: %w", zoneID, err)
	}
	return Zone{ID: id, ArrivalLabel: nullToPtr(label)}, true, nil
}

// nullToPtr converts a nullable arrival label to an optional string.
func nullToPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	v := ns.String
	return &v
}
