/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "KpiMetricType" AS ENUM ('TIEMPO', 'ROTACION', 'STOCK', 'VENTAS');

-- CreateEnum
CREATE TYPE "KpiSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "kpi_metas" (
    "id_meta" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "monto_objetivo" DECIMAL(12,2) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_metas_pkey" PRIMARY KEY ("id_meta")
);

-- CreateTable
CREATE TABLE "kpi_reglas_semaforo" (
    "id_regla" SERIAL NOT NULL,
    "tipo_metrica" "KpiMetricType" NOT NULL,
    "umbral_ambar" DECIMAL(10,2) NOT NULL,
    "umbral_rojo" DECIMAL(10,2) NOT NULL,
    "mensaje_alerta" VARCHAR(255),
    "notificar_push" BOOLEAN DEFAULT false,
    "color_hex" VARCHAR(7),

    CONSTRAINT "kpi_reglas_semaforo_pkey" PRIMARY KEY ("id_regla")
);

-- CreateTable
CREATE TABLE "kpi_snapshot_diario" (
    "id_log" BIGSERIAL NOT NULL,
    "fecha_corte" DATE NOT NULL,
    "total_ventas" DECIMAL(12,2) DEFAULT 0.00,
    "total_pedidos" INTEGER DEFAULT 0,
    "tiempo_promedio_min" DECIMAL(5,2),
    "rotacion_mesas_indice" DECIMAL(4,2),
    "ticket_promedio" DECIMAL(10,2),
    "alertas_generadas" INTEGER DEFAULT 0,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshot_diario_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "kpi_alerta_historial" (
    "id_alerta" BIGSERIAL NOT NULL,
    "id_snapshot" BIGINT,
    "timestamp_creacion" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "tipo_incidencia" "KpiMetricType" NOT NULL,
    "item_afectado" VARCHAR(150),
    "valor_registrado" VARCHAR(50),
    "severidad" "KpiSeverity" NOT NULL,
    "estado_gestion" VARCHAR(20) DEFAULT 'PENDIENTE',

    CONSTRAINT "kpi_alerta_historial_pkey" PRIMARY KEY ("id_alerta")
);

-- CreateTable
CREATE TABLE "kpi_auditoria_export" (
    "id_export" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_hora" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "filtros_aplicados" TEXT,
    "formato" VARCHAR(10) NOT NULL,

    CONSTRAINT "kpi_auditoria_export_pkey" PRIMARY KEY ("id_export")
);

-- CreateIndex
CREATE UNIQUE INDEX "kpi_snapshot_diario_fecha_corte_key" ON "kpi_snapshot_diario"("fecha_corte");

-- AddForeignKey
ALTER TABLE "kpi_alerta_historial" ADD CONSTRAINT "kpi_alerta_historial_id_snapshot_fkey" FOREIGN KEY ("id_snapshot") REFERENCES "kpi_snapshot_diario"("id_log") ON DELETE SET NULL ON UPDATE CASCADE;
