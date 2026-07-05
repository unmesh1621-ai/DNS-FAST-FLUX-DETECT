# FastFlux Backend API Server

Flask REST API server for the Fast Flux Detection System. Wraps the core Python analysis engine with HTTP endpoints for the frontend dashboard.

## Architecture

```
app.py (Flask Server)
  ├── /api/analyze          → Rx.core.get_score() → rule evaluation
  ├── /api/history          → In-memory analysis log
  ├── /api/stats            → Aggregated statistics
  ├── /api/export/csv       → History export
  └── /api/health           → Server status

Core Engine (Parent Directory)
  ├── Rx/core.py            → Rule orchestration
  ├── Rx/rule.py            → Rule evaluation
  └── dnsquery/             → DNS/GeoIP analysis
```

## Setup

### 1. Create Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Server

```bash
python app.py
```

Server starts on `http://0.0.0.0:5001`

## API Reference

### 1. Analyze Domain
**POST** `/api/analyze`

Request:
```json
{
  "domain": "example.com"
}
```

Response:
```json
{
  "domain": "example.com",
  "timestamp": "2024-01-15T10:30:45.123456",
  "final_score": 72.50,
  "classification": "Fast-Flux",
  "risk_level": "high",
  "color": "red",
  "rule_details": [
    {
      "name": "IP_Count",
      "value": 14,
      "threshold_tier": "very_high",
      "score": 28,
      "max_weight": 28,
      "status": "high_risk"
    }
  ],
  "logs": ["[timestamp] Analyzing domain..."]
}
```

### 2. Get History
**GET** `/api/history`

Returns last 50 analyses as array of result objects.

### 3. Get Domain History
**GET** `/api/history/<domain>`

Returns all analyses for specific domain.

### 4. Get Statistics
**GET** `/api/stats`

Response:
```json
{
  "total": 42,
  "fast_flux_count": 15,
  "suspicious_count": 12,
  "benign_count": 15,
  "avg_score": 54.23
}
```

### 5. Get Configuration
**GET** `/api/config`

Returns rules and classification thresholds.

### 6. Export CSV
**GET** `/api/export/csv`

Downloads CSV file with analysis history.

### 7. Health Check
**GET** `/api/health`

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123456"
}
```

## Environment Variables

Create `.env` file:
```
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_HOST=0.0.0.0
FLASK_PORT=5001
```

## Features

✅ CORS enabled for frontend
✅ In-memory analysis history (50 recent)
✅ Statistics aggregation
✅ CSV export
✅ Log capture
✅ Error handling

## Data Flow

1. Frontend sends domain → POST `/api/analyze`
2. Backend calls `get_domain_features(domain)`
   - DNS query for A/AAAA records
   - GeoIP lookups for ASN/country
   - Domain age calculation
3. Rules engine evaluates features
4. Score calculated (0-100)
5. Classification applied (Fast-Flux/Suspicious/Benign)
6. Result stored in history
7. Response sent to frontend

## Performance Considerations

**Single Analysis Timing:**
- DNS query: 2-5 seconds
- GeoIP lookups: 0.5-1 seconds  
- Rule evaluation: <100ms
- **Total: 2.5-6+ seconds**

**Optimization Tips:**
- Cache MaxMind databases in-memory
- Use connection pooling for DNS queries
- Implement request caching by domain
- Add async task queue for batch processing

## Error Handling

- Invalid domain format → 400 Bad Request
- DNS timeout → 500 Server Error
- Missing config files → 500 Server Error
- Geolocation failure → Partial result (non-blocking)

## Testing

```bash
curl -X POST http://localhost:5001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}'

curl http://localhost:5001/api/stats
```

## Production Deployment

### Security Checklist
- [ ] Add authentication (JWT/OAuth)
- [ ] Restrict CORS to frontend domain only
- [ ] Use environment variables for sensitive config
- [ ] Add rate limiting
- [ ] Enable HTTPS/TLS
- [ ] Use production WSGI server (gunicorn)
- [ ] Add database for persistent history
- [ ] Implement request logging

### Deployment with Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

### Docker Deployment

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5001
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5001", "app:app"]
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Flask | 2.3.2 | Web framework |
| Flask-CORS | 4.0.0 | Cross-origin requests |
| dnspython | 2.4.0 | DNS queries |
| geoip2 | 4.7.0 | GeoIP lookups |
| python-dateutil | 2.8.2 | Date utilities |

## Troubleshooting

**Port already in use:**
```bash
netstat -ano | findstr :5001  # Windows
lsof -i :5001  # Linux/Mac
```

**DNS resolution failing:**
- Check `config/dns_config.json`
- Verify network connectivity
- Try different DNS server

**GeoIP database not found:**
- Verify MaxMind MMDB files in `config/`
- Check file permissions
- Re-download from MaxMind

## Next Steps

1. Deploy backend to cloud (AWS/GCP/Azure)
2. Set up database (PostgreSQL) for history
3. Implement caching layer (Redis)
4. Add user authentication
5. Build admin dashboard
