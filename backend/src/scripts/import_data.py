#!/usr/bin/env python3
"""
ETL Script - Import SCIAN Sectorial Data to PostgreSQL
AgenticX5 SafeZone - Phase 1
"""

import pandas as pd
import psycopg2
from psycopg2 import sql
import os
from datetime import datetime

# Configuration PostgreSQL
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'agenticx5'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

def create_tables(conn):
    """Create database tables if they don't exist"""
    
    cursor = conn.cursor()
    
    # Table: scian_sectors
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scian_sectors (
            scian_code VARCHAR(10) PRIMARY KEY,
            name_fr VARCHAR(255) NOT NULL,
            name_en VARCHAR(255) NOT NULL,
            injuries_2023 INTEGER,
            injuries_pct DECIMAL(4,2),
            tms_pct DECIMAL(4,2),
            psy_pct DECIMAL(4,2),
            trend_7y DECIMAL(5,2),
            forklift_pct DECIMAL(4,2),
            zone_intrusion_pct DECIMAL(4,2),
            loading_dock_pct DECIMAL(4,2),
            avg_cost_cad INTEGER,
            source VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    # Table: zone_exclusion_incidents
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS zone_exclusion_incidents (
            id SERIAL PRIMARY KEY,
            scian_code VARCHAR(10) REFERENCES scian_sectors(scian_code),
            incident_type VARCHAR(50) NOT NULL,
            jurisdiction VARCHAR(10) NOT NULL,
            annual_frequency DECIMAL(5,2),
            avg_cost_cad INTEGER,
            avg_severity_days INTEGER,
            fatality_rate DECIMAL(4,2),
            cause_1 TEXT,
            cause_1_pct DECIMAL(4,2),
            cause_2 TEXT,
            cause_2_pct DECIMAL(4,2),
            cause_3 TEXT,
            cause_3_pct DECIMAL(4,2),
            equipment TEXT,
            distance_violation_m DECIMAL(4,1),
            cnesst_ref VARCHAR(100),
            osha_standard VARCHAR(50),
            csa_standard VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    # Index for performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_scian 
        ON zone_exclusion_incidents(scian_code);
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_type 
        ON zone_exclusion_incidents(incident_type);
    """)
    
    conn.commit()
    print("✅ Tables created successfully")


def import_sectors(conn, csv_file):
    """Import SCIAN sectors data from CSV"""
    
    print(f"\n📊 Importing sectors from {csv_file}...")
    
    # Read CSV
    df = pd.read_csv(csv_file)
    
    # Insert data
    cursor = conn.cursor()
    
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO scian_sectors (
                scian_code, name_fr, name_en, injuries_2023, injuries_pct,
                tms_pct, psy_pct, trend_7y, forklift_pct, zone_intrusion_pct,
                loading_dock_pct, avg_cost_cad, source
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (scian_code) DO UPDATE SET
                name_fr = EXCLUDED.name_fr,
                name_en = EXCLUDED.name_en,
                injuries_2023 = EXCLUDED.injuries_2023,
                injuries_pct = EXCLUDED.injuries_pct,
                tms_pct = EXCLUDED.tms_pct,
                psy_pct = EXCLUDED.psy_pct,
                trend_7y = EXCLUDED.trend_7y,
                forklift_pct = EXCLUDED.forklift_pct,
                zone_intrusion_pct = EXCLUDED.zone_intrusion_pct,
                loading_dock_pct = EXCLUDED.loading_dock_pct,
                avg_cost_cad = EXCLUDED.avg_cost_cad,
                source = EXCLUDED.source,
                updated_at = CURRENT_TIMESTAMP
        """, (
            row['scian_code'], row['name_fr'], row['name_en'], 
            row['injuries_2023'], row['injuries_pct'], row['tms_pct'], 
            row['psy_pct'], row['trend_7y'], row['forklift_pct'],
            row['zone_intrusion_pct'], row['loading_dock_pct'],
            row['avg_cost_cad'], row['source']
        ))
    
    conn.commit()
    print(f"✅ Imported {len(df)} sectors")


def import_incidents(conn, csv_file):
    """Import zone exclusion incidents from CSV"""
    
    print(f"\n🚨 Importing incidents from {csv_file}...")
    
    # Read CSV
    df = pd.read_csv(csv_file)
    
    # Insert data
    cursor = conn.cursor()
    
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO zone_exclusion_incidents (
                scian_code, incident_type, jurisdiction, annual_frequency,
                avg_cost_cad, avg_severity_days, fatality_rate,
                cause_1, cause_1_pct, cause_2, cause_2_pct, cause_3, cause_3_pct,
                equipment, distance_violation_m, cnesst_ref, osha_standard, csa_standard
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            row['scian_code'], row['incident_type'], row['jurisdiction'],
            row['annual_frequency'], row['avg_cost_cad'], row['avg_severity_days'],
            row['fatality_rate'], row['cause_1'], row['cause_1_pct'],
            row['cause_2'], row['cause_2_pct'], row['cause_3'], row['cause_3_pct'],
            row['equipment'], row['distance_violation_m'], row['cnesst_ref'],
            row['osha_standard'], row['csa_standard']
        ))
    
    conn.commit()
    print(f"✅ Imported {len(df)} incidents")


def print_summary(conn):
    """Print database summary"""
    
    cursor = conn.cursor()
    
    print("\n" + "="*60)
    print("📊 DATABASE SUMMARY")
    print("="*60)
    
    # Sectors count
    cursor.execute("SELECT COUNT(*) FROM scian_sectors")
    sectors_count = cursor.fetchone()[0]
    print(f"✅ Total sectors: {sectors_count}")
    
    # Total injuries
    cursor.execute("SELECT SUM(injuries_2023) FROM scian_sectors")
    total_injuries = cursor.fetchone()[0]
    print(f"✅ Total injuries 2023: {total_injuries:,}")
    
    # Incidents count
    cursor.execute("SELECT COUNT(*) FROM zone_exclusion_incidents")
    incidents_count = cursor.fetchone()[0]
    print(f"✅ Total incident types: {incidents_count}")
    
    # Top 5 sectors by injuries
    print("\n🔝 TOP 5 SECTORS BY INJURIES:")
    cursor.execute("""
        SELECT scian_code, name_fr, injuries_2023, injuries_pct
        FROM scian_sectors
        ORDER BY injuries_2023 DESC
        LIMIT 5
    """)
    for i, (code, name, injuries, pct) in enumerate(cursor.fetchall(), 1):
        print(f"   {i}. {code} - {name}: {injuries:,} ({pct}%)")
    
    # Top 5 most dangerous incident types
    print("\n⚠️ TOP 5 MOST DANGEROUS INCIDENTS (by fatality rate):")
    cursor.execute("""
        SELECT scian_code, incident_type, fatality_rate, avg_cost_cad
        FROM zone_exclusion_incidents
        ORDER BY fatality_rate DESC
        LIMIT 5
    """)
    for i, (code, incident, fatality, cost) in enumerate(cursor.fetchall(), 1):
        print(f"   {i}. SCIAN {code} - {incident}: {fatality}% fatality, ${cost:,}")
    
    print("="*60 + "\n")


def main():
    """Main ETL process"""
    
    print("\n" + "="*60)
    print("🚀 AgenticX5 SafeZone - ETL Phase 1")
    print("="*60 + "\n")
    
    try:
        # Connect to PostgreSQL
        print("🔌 Connecting to PostgreSQL...")
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"✅ Connected to database: {DB_CONFIG['database']}")
        
        # Create tables
        create_tables(conn)
        
        # Import data
        import_sectors(conn, '../data/scian_sectors.csv')
        import_incidents(conn, '../data/incidents_zones_exclusion.csv')
        
        # Print summary
        print_summary(conn)
        
        conn.close()
        print("✅ ETL completed successfully!\n")
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}\n")
        return 1
    except FileNotFoundError as e:
        print(f"\n❌ File not found: {e}")
        print("💡 Make sure CSV files are in ../data/ directory\n")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}\n")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
