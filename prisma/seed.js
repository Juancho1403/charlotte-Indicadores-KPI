import { PrismaClient, KpiSeverity, KpiMetricType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando Seed...')

  // 1. Limpiar datos previos (Orden importante por claves foraneas)
  await prisma.kpiAlertaHistorial.deleteMany()
  await prisma.kpiSnapshotDiario.deleteMany()
  await prisma.kpiReglaSemaforo.deleteMany()
  await prisma.kpiMeta.deleteMany()
  // await prisma.user.deleteMany() // Stub model

  // 2. Crear Metas
  console.log('Creando Meta...')
  await prisma.kpiMeta.create({
    data: {
      nombre: 'Meta Q4 2025 Expansion',
      montoObjetivo: 450000.00,
      fechaInicio: new Date('2025-10-01'),
      fechaFin: new Date('2025-12-31'),
      activa: true
    }
  })

  // 3. Crear Reglas (Thresholds)
  console.log('Creando Reglas...')
  await prisma.kpiReglaSemaforo.createMany({
    data: [
      {
        tipoMetrica: KpiMetricType.TIEMPO,
        umbralAmbar: 5.00,
        umbralRojo: 10.00,
        mensajeAlerta: 'Retraso en Cocina detectado (>10min)',
        colorHex: '#dc3545'
      },
      {
        tipoMetrica: KpiMetricType.ROTACION,
        umbralAmbar: 1.70,
        umbralRojo: 1.20,
        mensajeAlerta: 'Rotación de mesas crítica (<1.2)',
        colorHex: '#ffc107'
      },
      {
        tipoMetrica: KpiMetricType.STOCK,
        umbralAmbar: 20.00,
        umbralRojo: 10.00,
        mensajeAlerta: 'Stock crítico en inventario',
        colorHex: '#dc3545'
      }
    ]
  })

  // 4. Crear Snapshot Simulado (Ayer)
  console.log('Creando Snapshot...')
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  
  const snapshot = await prisma.kpiSnapshotDiario.create({
    data: {
      fechaCorte: yesterday,
      totalVentas: 12450.00,
      totalPedidos: 145,
      tiempoPromedioMin: 4.15,
      rotacionMesasIndice: 1.20,
      alertasGeneradas: 2
    }
  })

  // 5. Crear Alertas Simuladas
  console.log('Creando Alertas...')
  await prisma.kpiAlertaHistorial.createMany({
    data: [
      {
        idSnapshot: snapshot.idLog,
        tipoIncidencia: KpiMetricType.STOCK,
        itemAfectado: 'Tomates Frescos',
        valorRegistrado: '1.5 Kg',
        severidad: KpiSeverity.CRITICAL
      },
      {
        idSnapshot: snapshot.idLog,
        tipoIncidencia: KpiMetricType.STOCK,
        itemAfectado: 'Queso Mozzarella',
        valorRegistrado: '1.2 Kg',
        severidad: KpiSeverity.CRITICAL
      }
    ]
  })

  // 6. Stub Data (Users, Orders) para simular DB existente
  // Esto fallaria si las tablas reales no existen y Prisma intentara escribir. 
  // Como usamos stubs en schema, Prisma intentara escribir en tablas 'usuario', 'orders'.
  // Si no existen en DB postgres, el seed fallara aqui.
  // IMPORTANTE: El usuario dijo "esta es la base de datos" y paso un script que NO TIENE orders/users.
  // Por ende, comentare esto para evitar crash si esas tablas no existen en su instancia Render.
  /*
  await prisma.user.create({
      data: { email: "admin@charlotte.com", name: "Juan Admin", role: "ADMIN" }
  })
  */

  console.log('✅ Seed terminado.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
