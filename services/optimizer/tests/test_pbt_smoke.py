from hypothesis import given, settings
from hypothesis import strategies as st

from optimizer.testing import MIN_ITERATIONS, tag


@given(st.integers(), st.integers())
def test_pbt_harness_smoke(a: int, b: int) -> None:
    assert a + b == b + a


def test_min_iterations_default() -> None:
    assert MIN_ITERATIONS >= 100
    # The loaded "fleet" profile enforces the min-iteration default.
    assert settings().max_examples == MIN_ITERATIONS
    assert tag(0, "example") == "Feature: fleet-command-center, Property 0: example"
