import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const jobId = 'job-test-123';
  
  console.log(`Creando reporte de prueba con ID: ${jobId}...`);
  
  const report = await prisma.reportLog.upsert({
    where: { id: jobId },
    update: {},
    create: {
      id: jobId,
      status: 'COMPLETED',
      type: 'SALES',
      fileUrl: 'https://example.com/reports/report-sales-2025.pdf',
      createdAt: new Date(),
    },
  });

  console.log('✅ Reporte de prueba creado/verificado exitosamente:', report);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
