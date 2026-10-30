# Decision: Route movie app through host Nginx

- Status: Accepted
- Date: 2026-10-30

## Context

The server already routes public ports 80/443 to Debian host Nginx, which serves `ask.jlloyd.fr` and `watch.jlloyd.fr`. Nginx Proxy Manager runs separately on ports 8888/4443 and serves existing media services. Reconfiguring NPM or router forwarding could interrupt those services.

## Decision

Route `jlloyd.fr` through a new host-Nginx virtual host to the movie frontend gateway, published only on `127.0.0.1:8188`. Keep the NPM Compose project, media networks, and router rules unchanged. Use a separate Let's Encrypt certificate for `jlloyd.fr`.

## Consequences

- The movie stack does not join `media-stack_default` or require an external proxy Docker network.
- Host Nginx needs a new apex-domain virtual host and a valid certificate before public HTTPS is enabled.
- The production Compose file must bind the frontend gateway on loopback only; backend and database ports remain private.

## Alternatives considered

- Attach NPM to a new Docker network and route through it. Not chosen because public ports 80/443 currently terminate at host Nginx and changing that path risks existing services.
- Change router forwarding to NPM. Not chosen because it would replace the current public ingress path.
