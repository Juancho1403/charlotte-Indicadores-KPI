import * as kpiService from '../../services/kpi.service.js';

export async function getDashboardSummary(req, res) {
  try {
    const summary = await kpiService.getDashboardSummary(req.query);
    res.json(summary);
  } catch (err) {
    console.error('getDashboardSummary error', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
}

export async function getStaffPerformance(req, res) {
  try {
    const result = await kpiService.getStaffPerformance(req.query);
    res.json(result);
  } catch (err) {
    console.error('getStaffPerformance error', err);
    res.status(500).json({ error: 'Failed to fetch staff performance' });
  }
}

export async function getKitchenQueue(req, res) {
  try {
    const queue = await kpiService.getKitchenQueue(req.query);
    res.json(queue);
  } catch (err) {
    console.error('getKitchenQueue error', err);
    res.status(500).json({ error: 'Failed to fetch kitchen queue' });
  }
}

export async function getTopProducts(req, res) {
  try {
    const top = await kpiService.getTopProducts(req.query);
    res.json(top);
  } catch (err) {
    console.error('getTopProducts error', err);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
}

export async function getIngredientFrequency(req, res) {
  try {
    const result = await kpiService.getIngredientFrequency(req.query);
    res.json(result);
  } catch (err) {
    console.error('getIngredientFrequency error', err);
    res.status(500).json({ error: 'Failed to fetch ingredient frequency' });
  }
}
