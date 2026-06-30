"""Pytest/Hypothesis configuration for the Route_Optimizer service.

Registers and loads the ``fleet`` Hypothesis profile so every property test
runs at least the project-wide minimum number of iterations.
"""

from hypothesis import settings

from optimizer.testing import MIN_ITERATIONS

settings.register_profile("fleet", max_examples=MIN_ITERATIONS)
settings.load_profile("fleet")
