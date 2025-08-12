# SDR Assignment System - Deployment Guide

## Overview

This guide covers deployment options for the SDR Assignment System using Docker and Docker Compose for both development and production environments.

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Git
- 4GB RAM minimum, 8GB recommended
- 10GB disk space

## Quick Start (Development)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd sdr-assignment-system
cp .env.example .env
```

### 2. Start Development Environment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Nginx Proxy**: http://localhost:8080
- **Database**: localhost:5432

### 4. Default Credentials
- **Admin**: username `admin`, password `admin123`
- **SDR Users**: username `john.doe`, `jane.smith`, `mike.johnson`, password `admin123`

## Production Deployment

### 1. Environment Configuration

Create a `.env` file for production:
```bash
cp .env.example .env
```

**Critical settings to change:**
```env
# Security - MUST CHANGE
JWT_SECRET=your-super-secure-32-character-minimum-secret-key
DB_PASSWORD=your-secure-database-password
REDIS_PASSWORD=your-secure-redis-password

# Application
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Database
DB_HOST=postgres
DB_NAME=sdr_assignment_system
DB_USER=postgres
```

### 2. Production Deployment
```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d

# View status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. SSL/HTTPS Setup

For production with SSL, update the nginx configuration:

```bash
# Create SSL certificate directory
mkdir -p ./ssl

# Add your SSL certificates
# - ./ssl/certificate.crt
# - ./ssl/private.key

# Update docker-compose.prod.yml to mount SSL certificates
volumes:
  - ./ssl:/etc/nginx/ssl:ro
```

Update nginx configuration for HTTPS:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    # ... rest of configuration
}

server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

## Database Management

### PostgreSQL Database

#### Connect to Database
```bash
# Via Docker
docker-compose exec postgres psql -U postgres -d sdr_assignment_system

# Direct connection
psql -h localhost -U postgres -d sdr_assignment_system
```

#### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres sdr_assignment_system > backup.sql

# Restore backup
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d sdr_assignment_system
```

#### Database Migrations
The database schema is automatically created on first startup. For updates:

```bash
# Run custom migration
docker-compose exec postgres psql -U postgres -d sdr_assignment_system -f /path/to/migration.sql
```

### SQLite (Development)
```bash
# Connect to SQLite database
docker-compose exec backend sqlite3 database.sqlite

# Backup SQLite
docker cp $(docker-compose ps -q backend):/app/database.sqlite ./backup.sqlite
```

## Monitoring and Maintenance

### Health Checks

All services include health checks:
```bash
# Check service health
docker-compose ps

# View health check logs
docker inspect $(docker-compose ps -q backend) --format='{{.State.Health}}'
```

### Application Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# View audit logs
docker-compose exec backend cat logs/audit.log
```

### Database Monitoring

```bash
# PostgreSQL stats
docker-compose exec postgres psql -U postgres -d sdr_assignment_system -c "
  SELECT schemaname,tablename,n_tup_ins,n_tup_upd,n_tup_del 
  FROM pg_stat_user_tables;
"

# Connection count
docker-compose exec postgres psql -U postgres -c "
  SELECT count(*) as active_connections 
  FROM pg_stat_activity 
  WHERE state = 'active';
"
```

### Performance Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## Scaling and Load Balancing

### Horizontal Scaling

To scale the backend service:
```bash
# Scale backend to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Update nginx upstream configuration
upstream backend {
    server backend_1:3001;
    server backend_2:3001;
    server backend_3:3001;
}
```

### Database Connection Pooling
The application uses connection pooling with these settings:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

## Security Considerations

### Environment Security
- Never commit `.env` files to version control
- Use strong, unique passwords for all services
- Regularly rotate JWT secrets and database passwords
- Enable firewall rules to restrict database access

### Network Security
```bash
# Create custom network for isolation
docker network create --driver bridge sdr_secure_network

# Use in docker-compose.yml
networks:
  default:
    external:
      name: sdr_secure_network
```

### Container Security
- All containers run as non-root users
- Minimal base images (Alpine Linux)
- Regular security updates
- Resource limits configured

## Backup Strategy

### Automated Backups

Create a backup script:
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"

mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec -T postgres pg_dump -U postgres sdr_assignment_system > $BACKUP_DIR/db_backup_$DATE.sql

# Application logs backup
docker-compose exec -T backend tar -czf - logs/ > $BACKUP_DIR/logs_backup_$DATE.tar.gz

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Run via cron:
```bash
# Add to crontab for daily backups at 2 AM
0 2 * * * /path/to/backup.sh
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify connection settings
docker-compose exec backend env | grep DB_

# Test connection manually
docker-compose exec backend node -e "
  const pool = require('./src/config/database');
  pool.query('SELECT NOW()', (err, result) => {
    console.log(err ? 'Error: ' + err : 'Success: ' + result.rows[0].now);
    process.exit(0);
  });
"
```

#### 2. Frontend Not Loading
```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# Verify frontend build
docker-compose logs frontend

# Check API connectivity
curl http://localhost:8080/api/health
```

#### 3. High Memory Usage
```bash
# Check resource usage
docker stats

# Optimize PostgreSQL settings
# Edit postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

#### 4. Slow Performance
```bash
# Check database queries
docker-compose exec postgres psql -U postgres -d sdr_assignment_system -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY total_time DESC LIMIT 10;
"

# Enable query logging
# In postgresql.conf:
log_min_duration_statement = 1000
```

### Debug Mode

Enable debug logging:
```bash
# Set environment variables
LOG_LEVEL=DEBUG
NODE_ENV=development

# Restart services
docker-compose restart backend
```

## Updates and Migrations

### Application Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose build --no-cache

# Update services
docker-compose up -d
```

### Database Schema Updates
```bash
# Create migration file
echo "ALTER TABLE consultants ADD COLUMN department VARCHAR(100);" > migration_001.sql

# Run migration
docker-compose exec postgres psql -U postgres -d sdr_assignment_system -f /path/to/migration_001.sql
```

## Production Checklist

Before deploying to production:

- [ ] Update all default passwords
- [ ] Configure SSL certificates
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting
- [ ] Test disaster recovery procedures
- [ ] Review security configurations
- [ ] Set up log rotation
- [ ] Configure firewall rules
- [ ] Test load balancing
- [ ] Verify health checks

## Support and Monitoring

### Key Metrics to Monitor
- API response times
- Database connection count
- Assignment success rate
- Error rates
- Resource utilization

### Alerting Setup
Set up alerts for:
- Service downtime
- High error rates
- Database connection failures
- Disk space usage >80%
- Memory usage >90%

### Log Analysis
Use log aggregation tools like ELK stack or Grafana for centralized logging and monitoring.

This deployment guide ensures a robust, secure, and scalable deployment of the SDR Assignment System.