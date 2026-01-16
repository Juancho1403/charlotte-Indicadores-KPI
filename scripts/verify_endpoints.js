import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/v1/kpi';

const endpoints = [
    { name: 'Summary Snapshot', url: '/dashboard/summary?force_refresh=true' },
    { name: 'Staff Ranking', url: '/operations/staff-ranking?sort_by=EFFICIENCY' },
    { name: 'SLA Breakdown', url: '/operations/sla-breakdown' },
    { name: 'Pareto Inventory', url: '/inventory/pareto' },
    { name: 'Stock Alerts', url: '/inventory/alerts?severity=CRITICAL' }
];

async function runTests() {
    console.log('🚀 Iniciando pruebas de verificación de endpoints KPI...\n');
    
    // Wait for server to be ready
    await new Promise(r => setTimeout(r, 2000));

    for (const ep of endpoints) {
        try {
            console.log(`Testing: ${ep.name} (${ep.url})...`);
            const res = await fetch(`${BASE_URL}${ep.url}`);
            const data = await res.json();
            
            if (res.ok) {
                console.log(`✅ [200 OK] Success!`);
                //console.log(JSON.stringify(data, null, 2).slice(0, 200) + '...');
            } else {
                console.error(`❌ [${res.status}] Failed!`, data);
            }
        } catch (e) {
            console.error(`❌ Network/Server Error on ${ep.name}:`, e.message);
        }
        console.log('-----------------------------------');
    }
    console.log('🏁 Pruebas finalizadas.');
}

runTests();
