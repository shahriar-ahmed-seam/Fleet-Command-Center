MIN_ITERATIONS = 100
"""Project-wide minimum number of iterations every property test must run."""

FEATURE = "fleet-command-center"
"""Feature tag prefix applied to every property test."""


def tag(n: int, text: str) -> str:
    """Format the standard property tag.

    ``Feature: fleet-command-center, Property {n}: {text}``
    """
    return f"Feature: {FEATURE}, Property {n}: {text}"
