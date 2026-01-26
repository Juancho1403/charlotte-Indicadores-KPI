import { AtencionClienteService } from '../src/services/AtencionClienteService.js';
import { DeliveryService } from '../src/services/DeliveryService.js';
import { KitchenService } from '../src/services/KitchenService.js';
import { startKpiDailyWorker, shutdownKpiDailyWorker } from '../src/workers/KpiDailyWorker.js';

async function verify() {
    console.log('Verificando servicios...');
    try {
        const atc = new AtencionClienteService();
        console.log('✅ AtencionClienteService instanciado.');
        
        const del = new DeliveryService();
        console.log('✅ DeliveryService instanciado.');
        
        const kit = new KitchenService();
        console.log('✅ KitchenService instanciado.');
        
        console.log('Verificando worker (dry run)...');
        // No iniciamos realmente el worker para no conectar a Redis, pero importarlo verifica sintaxis
        if (typeof startKpiDailyWorker === 'function') {
            console.log('✅ KpiDailyWorker exporta la función start.');
        }

    } catch (e) {
        console.error('❌ Error en verificación:', e);
        process.exit(1);
    }
}

verify();
