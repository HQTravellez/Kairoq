# Kairoq flagship acceptance demonstrations

Three independent acceptance cases for one builder engine:

| Case | Entry | Domain verification |
|---|---|---|
| Restaurant booking | `examples/restaurant-proof/` | HTTP reservation persistence, duplicate prevention and authorization |
| Physics Lab | `examples/physics-lab/index.html` | Independently calculated projectile range, time of flight, peak height, input validation |
| Healthcare staffing | `examples/healthcare-staffing/index.html` | Qualification, time availability, overlapping shift prevention |

## How to run

```bash
node --test examples/restaurant-proof/restaurant.test.js
node --test examples/flagship-acceptance.test.js
```

Open `examples/physics-lab/index.html` and `examples/healthcare-staffing/index.html` in a modern browser to see **standalone demonstration interfaces**.

These are **reference implementations** (created by a developer), **not** evidence that the autonomous Kairoq agent can generate these independently. They do not yet have automated mobile browser proof, autonomous build/repair replay, screenshots or production app deployment. The physics simulator models ideal motion with no drag. The staffing demo has synthetic staff only; it is not suitable for real healthcare decisions.

## Honest milestone requirements for the builder

Give a fresh Kairoq project each prompt without source:

1. "Create an elegant restaurant reservation system with images, booking persistence, conflict checks, admin access and mobile support."
2. "Create a mobile-friendly physics simulation lab that lets students adjust speed, angle and gravity and shows verified range/time/height. Confirm equations with reproducible numerical tests."
3. "Create a nurse staffing scheduler with sample shifts, qualifications and availability, rejecting overlapping bookings and missing qualifications. Prove the rules with tests."

Before claiming success, record the generated commit, browser session screenshot, user task outcome, exact domain test output, persistent data checks, and whether repairs occurred. No synthetic health records may be replaced by real patient information during these demonstrations.
