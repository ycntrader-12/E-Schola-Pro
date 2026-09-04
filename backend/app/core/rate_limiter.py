"""
High-performance in-memory sliding window rate limiter for E-Schola Pro.
Protects against DoS, spam flooding, and brute-force attacks on sensitive endpoints.
"""

import threading
import time
from collections import defaultdict
from fastapi import HTTPException, status


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # Key: bucket_identifier -> list of epoch timestamps
        self._buckets = defaultdict(list)
        self._last_cleanup = time.time()

    def _cleanup_stale(self, now: float, max_age: float = 300.0):
        """
        Periodically remove stale buckets to prevent memory accumulation.
        """
        if now - self._last_cleanup > 60.0:
            stale_keys = [
                k for k, timestamps in self._buckets.items()
                if not timestamps or (now - timestamps[-1] > max_age)
            ]
            for k in stale_keys:
                del self._buckets[k]
            self._last_cleanup = now

    def check_rate_limit(
        self,
        identifier: str,
        max_requests: int = 20,
        window_seconds: int = 60,
        action_name: str = "envoi de messages",
    ) -> None:
        """
        Records an attempt and checks if the rate limit is exceeded.
        Raises HTTPException(status_code=429) if limit is exceeded.
        """
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            self._cleanup_stale(now)
            timestamps = self._buckets[identifier]

            # Retain only timestamps within current sliding window
            self._buckets[identifier] = [ts for ts in timestamps if ts > window_start]
            valid_timestamps = self._buckets[identifier]

            if len(valid_timestamps) >= max_requests:
                earliest = valid_timestamps[0]
                retry_after = max(1, int(earliest + window_seconds - now))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Limite de requêtes atteinte pour '{action_name}'. "
                        f"Veuillez patienter {retry_after} secondes avant de réessayer."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

            self._buckets[identifier].append(now)


# Global singleton instance
rate_limiter = SlidingWindowRateLimiter()
