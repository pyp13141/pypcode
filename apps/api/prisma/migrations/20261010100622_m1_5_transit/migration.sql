-- CreateTable
CREATE TABLE "transit_cities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pinyin" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "transit_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transit_lines" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "origin" TEXT,
    "terminus" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "transit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transit_stations" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "osm_node_id" TEXT,

    CONSTRAINT "transit_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transit_line_stations" (
    "line_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,

    CONSTRAINT "transit_line_stations_pkey" PRIMARY KEY ("line_id","station_id")
);

-- CreateTable
CREATE TABLE "transit_edges" (
    "from_station_id" UUID NOT NULL,
    "to_station_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "minutes" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "transit_edges_pkey" PRIMARY KEY ("from_station_id","to_station_id","kind")
);

-- CreateTable
CREATE TABLE "user_stations" (
    "user_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "label" TEXT,

    CONSTRAINT "user_stations_pkey" PRIMARY KEY ("user_id","station_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transit_cities_name_key" ON "transit_cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transit_lines_city_id_ref_key" ON "transit_lines"("city_id", "ref");

-- CreateIndex
CREATE INDEX "transit_stations_city_id_name_idx" ON "transit_stations"("city_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "transit_stations_city_id_osm_node_id_key" ON "transit_stations"("city_id", "osm_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "transit_line_stations_line_id_seq_key" ON "transit_line_stations"("line_id", "seq");

-- CreateIndex
CREATE INDEX "transit_edges_to_station_id_idx" ON "transit_edges"("to_station_id");

-- AddForeignKey
ALTER TABLE "transit_lines" ADD CONSTRAINT "transit_lines_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "transit_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transit_stations" ADD CONSTRAINT "transit_stations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "transit_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transit_line_stations" ADD CONSTRAINT "transit_line_stations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "transit_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transit_line_stations" ADD CONSTRAINT "transit_line_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "transit_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transit_edges" ADD CONSTRAINT "transit_edges_from_station_id_fkey" FOREIGN KEY ("from_station_id") REFERENCES "transit_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transit_edges" ADD CONSTRAINT "transit_edges_to_station_id_fkey" FOREIGN KEY ("to_station_id") REFERENCES "transit_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stations" ADD CONSTRAINT "user_stations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stations" ADD CONSTRAINT "user_stations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "transit_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stations" ADD CONSTRAINT "user_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "transit_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
