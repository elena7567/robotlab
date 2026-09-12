# RobotLab manual review workflow

Run `npm run review` for every review-ready task unless the user explicitly says
`DO NOT START PREVIEW`. The command builds the current project, launches the Vite
**production preview** without HMR, and keeps it running on strict
`0.0.0.0:4198` after Codex finishes.

The launcher `scripts/review-server.mjs` dynamically detects the current active
physical Wi-Fi/Ethernet IPv4. It ignores VPN, TAP/TUN, WSL, Docker, Hyper-V,
loopback, disconnected, and virtual adapters, and prefers the adapter with the
active default route. Never copy an IP address from an older report.

The launcher verifies and prints:

- PC: `http://127.0.0.1:4198/`
- Samsung: `http://<CURRENT_LAN_IPV4>:4198/`
- existing relevant direct QA entries, currently Mission 9 via
  `?qaMission=9`

Direct QA query parameters belong to the application, not the preview server.
Future mission shortcuts therefore require no server change, but must only be
reported after their application support is present and verified.

## Troubleshooting

- Build failure: fix `npm run build`; do not report the task as review-ready.
- Port 4198 occupied: the launcher reuses a verified RobotLab production preview
  and replaces only a safely identified stale RobotLab Vite process. It never
  stops an unrelated process.
- Localhost works but LAN fails: confirm the phone is on the same network, then
  inspect Windows Firewall. Do not disable the firewall globally. Add or adjust
  only the minimum inbound rule required for RobotLab TCP port 4198, and record
  the exact change in the task report.
- Changed network: rerun `npm run review`; never edit a stored IP address.

The task is manually review-ready only when both HTTP checks pass and the server
is explicitly reported as left running.
