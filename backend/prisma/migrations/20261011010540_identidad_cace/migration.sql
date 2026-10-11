-- CreateTable
CREATE TABLE "CONFIGURACION_CACE" (
    "id" SERIAL NOT NULL,
    "lema" TEXT NOT NULL DEFAULT '',
    "descripcion" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT,
    "tema" TEXT NOT NULL DEFAULT 'AZUL',
    "actualizado_por_usuario_id" INTEGER,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CONFIGURACION_CACE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PAIS_COMUNIDAD" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PAIS_COMUNIDAD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PREMIO" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "anio" INTEGER NOT NULL,
    "otorgado_a" TEXT NOT NULL,
    "institucion_id" INTEGER,
    "imagen_url" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PREMIO_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PAIS_COMUNIDAD_codigo_key" ON "PAIS_COMUNIDAD"("codigo");

-- AddForeignKey
ALTER TABLE "CONFIGURACION_CACE" ADD CONSTRAINT "CONFIGURACION_CACE_actualizado_por_usuario_id_fkey" FOREIGN KEY ("actualizado_por_usuario_id") REFERENCES "USUARIO"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PREMIO" ADD CONSTRAINT "PREMIO_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "INSTITUCION"("id") ON DELETE SET NULL ON UPDATE CASCADE;
