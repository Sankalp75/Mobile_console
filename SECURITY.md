# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Mobile Console, please report it by opening a private security advisory on GitHub.

Do NOT report security vulnerabilities through public GitHub Issues.

## Security Model

Mobile Console is designed to run entirely on localhost. The server binds to local network interfaces only. No authentication tokens, API keys, or user accounts are stored.

### Threat Model

- **Local network access only** — The server is not designed for exposure to the internet
- **Connect codes** — A 6-digit code prevents casual unauthorized access
- **USB tunnel** — Communication occurs over a USB cable when connected via ADB
- **No persistent user data** — Profiles are stored in browser localStorage only

### Security Mitigations

| Feature | Protection |
|---------|-----------|
| Constant-time code comparison | Prevents timing attacks on connect codes |
| Rate limiting | Blocks brute-force attempts after 5 failed tries |
| Strict CORS policy | Only allows connections from localhost |
| Content Security Policy | Prevents XSS and code injection |
| WebSocket origin validation | Rejects connections from unauthorized origins |
| Thread-safe client management | Prevents race conditions |
| Input validation | All binary protocol messages are validated |
| No secrets in code | No API keys, passwords, or tokens |

### Supported Versions

Only the latest version of Mobile Console is actively supported with security updates.

| Version | Supported          |
|---------|-------------------|
| main    | :white_check_mark: |

## Best Practices for Users

1. **Do not expose the server port** (3000/8081) to the internet
2. **Keep your connect code private** — it grants access to gamepad input
3. **Only connect phones you own** — the connect code is a local authentication mechanism
4. **Use USB when possible** — ADB tunneling is more secure than WiFi connections

## Known Limitations

- The connect code is a 6-digit numeric code — this provides basic access control, not cryptographic security
- No TLS/SSL for WebSocket connections — all traffic stays on localhost
- Browser-based client — subject to browser security sandbox limitations
- Profiles imported from untrusted sources could contain malicious data — always validate before importing
