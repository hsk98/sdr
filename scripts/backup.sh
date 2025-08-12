#!/bin/bash

# SDR Assignment System Backup Script
# Creates backups of database and application logs

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
RETENTION_DAYS=7

echo "📦 Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Containers are not running. Please start the application first."
    exit 1
fi

echo "💾 Backing up PostgreSQL database..."
# Database backup
if docker-compose ps | grep -q postgres; then
    docker-compose exec -T postgres pg_dump -U postgres sdr_assignment_system > $BACKUP_DIR/db_backup_$DATE.sql
    if [ $? -eq 0 ]; then
        echo "✅ Database backup completed: db_backup_$DATE.sql"
    else
        echo "❌ Database backup failed"
        exit 1
    fi
else
    echo "ℹ️  PostgreSQL container not found, checking for SQLite..."
    if docker-compose exec backend test -f database.sqlite; then
        docker cp $(docker-compose ps -q backend):/app/database.sqlite $BACKUP_DIR/sqlite_backup_$DATE.db
        echo "✅ SQLite backup completed: sqlite_backup_$DATE.db"
    else
        echo "❌ No database found to backup"
        exit 1
    fi
fi

echo "📋 Backing up application logs..."
# Application logs backup
if docker-compose exec backend test -d logs; then
    docker-compose exec -T backend tar -czf - logs/ > $BACKUP_DIR/logs_backup_$DATE.tar.gz
    echo "✅ Logs backup completed: logs_backup_$DATE.tar.gz"
else
    echo "ℹ️  No logs directory found"
fi

echo "🧹 Cleaning old backups (older than $RETENTION_DAYS days)..."
# Clean old backups
find $BACKUP_DIR -name "*backup_*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find $BACKUP_DIR -name "*backup_*.db" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find $BACKUP_DIR -name "*backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "📊 Backup summary:"
ls -lh $BACKUP_DIR/*$DATE*

echo "✅ Backup completed successfully!"
echo "📁 Backups stored in: $BACKUP_DIR"