package pbt_test

import (
	"testing"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"

	"github.com/fleet-command-center/services/streaming/internal/pbt"
)

// Smoke test confirming the gopter harness is wired with the project's
// min-100-iteration default and tag convention. Replaced by real property
// tests (Properties 19, 36) in later tasks.
//
func TestPBTHarnessSmoke(t *testing.T) {
	params := pbt.Params()
	if params.MinSuccessfulTests != pbt.MinIterations {
		t.Fatalf("expected min %d iterations, got %d", pbt.MinIterations, params.MinSuccessfulTests)
	}

	properties := gopter.NewProperties(params)
	properties.Property(pbt.Tag(0, "integer addition is commutative"), prop.ForAll(
		func(a, b int) bool {
			return a+b == b+a
		},
		gen.Int(),
		gen.Int(),
	))
	properties.TestingRun(t)
}
