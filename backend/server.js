/**
 * AgenticX5 SafeZone - API Server Phase 1
 * Express.js REST API for sectorial data
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'agenticx5',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// ROUTES - SECTORS
// ============================================================================

/**
 * GET /api/v1/sectors
 * Get all SCIAN sectors with stats
 */
app.get('/api/v1/sectors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM scian_sectors
      ORDER BY injuries_2023 DESC
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/sectors/:scian
 * Get specific sector profile
 */
app.get('/api/v1/sectors/:scian', async (req, res) => {
  try {
    const { scian } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM scian_sectors WHERE scian_code = $1',
      [scian]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Sector ${scian} not found` 
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching sector:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/sectors/:scian/profile
 * Get comprehensive sector profile with incidents
 */
app.get('/api/v1/sectors/:scian/profile', async (req, res) => {
  try {
    const { scian } = req.params;
    
    // Get sector info
    const sectorResult = await pool.query(
      'SELECT * FROM scian_sectors WHERE scian_code = $1',
      [scian]
    );
    
    if (sectorResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Sector ${scian} not found` 
      });
    }
    
    // Get incidents for this sector
    const incidentsResult = await pool.query(
      `SELECT * FROM zone_exclusion_incidents 
       WHERE scian_code = $1
       ORDER BY fatality_rate DESC`,
      [scian]
    );
    
    // Calculate risk score
    const sector = sectorResult.rows[0];
    const riskScore = calculateRiskScore(sector, incidentsResult.rows);
    
    res.json({
      success: true,
      data: {
        sector: sector,
        incidents: incidentsResult.rows,
        risk_score: riskScore,
        summary: {
          total_incident_types: incidentsResult.rows.length,
          avg_fatality_rate: average(incidentsResult.rows.map(i => i.fatality_rate)),
          total_estimated_cost: sum(incidentsResult.rows.map(i => i.avg_cost_cad))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching sector profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ROUTES - INCIDENTS
// ============================================================================

/**
 * GET /api/v1/incidents
 * Get all zone exclusion incidents
 */
app.get('/api/v1/incidents', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, s.name_fr as sector_name
      FROM zone_exclusion_incidents i
      JOIN scian_sectors s ON i.scian_code = s.scian_code
      ORDER BY i.fatality_rate DESC
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/sectors/:scian/situations/:type
 * Get specific incident type data for sector
 */
app.get('/api/v1/sectors/:scian/situations/:type', async (req, res) => {
  try {
    const { scian, type } = req.params;
    
    const result = await pool.query(`
      SELECT i.*, s.name_fr as sector_name, s.injuries_2023 as total_sector_injuries
      FROM zone_exclusion_incidents i
      JOIN scian_sectors s ON i.scian_code = s.scian_code
      WHERE i.scian_code = $1 AND i.incident_type LIKE $2
    `, [scian, `%${type}%`]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `No ${type} incidents found for sector ${scian}` 
      });
    }
    
    const incident = result.rows[0];
    
    // Build VR scenario structure
    const vrScenario = buildVRScenario(incident);
    
    res.json({
      success: true,
      data: {
        incident: incident,
        vr_scenario: vrScenario,
        causes: [
          { description: incident.cause_1, percentage: incident.cause_1_pct },
          { description: incident.cause_2, percentage: incident.cause_2_pct },
          { description: incident.cause_3, percentage: incident.cause_3_pct }
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching situation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ROUTES - VR SCENARIOS
// ============================================================================

/**
 * GET /api/v1/sectors/:scian/scenarios/vr
 * Generate VR training scenarios for sector
 */
app.get('/api/v1/sectors/:scian/scenarios/vr', async (req, res) => {
  try {
    const { scian } = req.params;
    
    // Get sector + incidents
    const sectorResult = await pool.query(
      'SELECT * FROM scian_sectors WHERE scian_code = $1',
      [scian]
    );
    
    const incidentsResult = await pool.query(
      `SELECT * FROM zone_exclusion_incidents 
       WHERE scian_code = $1
       ORDER BY annual_frequency DESC`,
      [scian]
    );
    
    if (sectorResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Sector ${scian} not found` 
      });
    }
    
    // Generate scenarios
    const scenarios = incidentsResult.rows.map(incident => buildVRScenario(incident));
    
    res.json({
      success: true,
      sector: sectorResult.rows[0].name_fr,
      count: scenarios.length,
      scenarios: scenarios
    });
  } catch (error) {
    console.error('Error generating scenarios:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ROUTES - STATISTICS
// ============================================================================

/**
 * GET /api/v1/stats/summary
 * Get overall statistics summary
 */
app.get('/api/v1/stats/summary', async (req, res) => {
  try {
    const totalInjuries = await pool.query(
      'SELECT SUM(injuries_2023) as total FROM scian_sectors'
    );
    
    const totalIncidentTypes = await pool.query(
      'SELECT COUNT(*) as count FROM zone_exclusion_incidents'
    );
    
    const avgFatality = await pool.query(
      'SELECT AVG(fatality_rate) as avg FROM zone_exclusion_incidents'
    );
    
    const topSector = await pool.query(`
      SELECT scian_code, name_fr, injuries_2023 
      FROM scian_sectors 
      ORDER BY injuries_2023 DESC 
      LIMIT 1
    `);
    
    res.json({
      success: true,
      data: {
        total_injuries_2023: parseInt(totalInjuries.rows[0].total),
        total_incident_types: parseInt(totalIncidentTypes.rows[0].count),
        avg_fatality_rate: parseFloat(avgFatality.rows[0].avg).toFixed(2),
        top_sector: topSector.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateRiskScore(sector, incidents) {
  // Simple risk score calculation (0-10)
  const injuryWeight = (sector.injuries_pct / 100) * 3;
  const trendWeight = (Math.max(0, sector.trend_7y) / 100) * 2;
  const fatalityWeight = incidents.length > 0 
    ? (average(incidents.map(i => i.fatality_rate)) / 10) * 5 
    : 0;
  
  return Math.min(10, injuryWeight + trendWeight + fatalityWeight).toFixed(1);
}

function buildVRScenario(incident) {
  return {
    id: `VR-${incident.scian_code}-${incident.incident_type}`,
    title: `${incident.incident_type.replace(/_/g, ' ')} - SCIAN ${incident.scian_code}`,
    difficulty: incident.fatality_rate > 10 ? 'avancé' : incident.fatality_rate > 5 ? 'intermédiaire' : 'débutant',
    duration_minutes: 15 + Math.floor(incident.avg_severity_days / 10),
    steps: [
      {
        id: 'step_1',
        title: `Éviter: ${incident.cause_1}`,
        frequency: `${incident.cause_1_pct}% des cas`
      },
      {
        id: 'step_2',
        title: `Éviter: ${incident.cause_2}`,
        frequency: `${incident.cause_2_pct}% des cas`
      },
      {
        id: 'step_3',
        title: `Éviter: ${incident.cause_3}`,
        frequency: `${incident.cause_3_pct}% des cas`
      },
      {
        id: 'step_4',
        title: 'Protocole intervention urgence',
        frequency: 'Obligatoire'
      }
    ],
    context: {
      annual_frequency: incident.annual_frequency,
      avg_cost: incident.avg_cost_cad,
      fatality_rate: incident.fatality_rate,
      equipment: incident.equipment,
      standards: {
        cnesst: incident.cnesst_ref,
        osha: incident.osha_standard,
        csa: incident.csa_standard
      }
    }
  };
}

function average(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// ============================================================================
// SERVER
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 AgenticX5 SafeZone API - Phase 1');
  console.log('='.repeat(60));
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at /api/v1/`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log('='.repeat(60) + '\n');
});

module.exports = app;
