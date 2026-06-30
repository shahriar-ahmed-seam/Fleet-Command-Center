// Package pbt centralizes the property-based-testing conventions shared by the
//
// It provides the project-wide minimum-iteration default and the standard
// property tag format so every property test is consistent and discoverable.
package pbt

import (
	"fmt"

	"github.com/leanovate/gopter"
)

// MinIterations is the project-wide minimum number of successful iterations
// every property-based test must run.
const MinIterations = 100

// Feature is the feature tag prefix applied to every property test.
const Feature = "fleet-command-center"

// Params returns gopter test parameters with the project's min-100-iteration
// default applied.
func Params() *gopter.TestParameters {
	params := gopter.DefaultTestParameters()
	params.MinSuccessfulTests = MinIterations
	return params
}

// Tag formats the standard property tag used to label each property test:
//
func Tag(n int, text string) string {
	return fmt.Sprintf("Feature: %s, Property %d: %s", Feature, n, text)
}
