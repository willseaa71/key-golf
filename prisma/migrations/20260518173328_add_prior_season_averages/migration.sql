-- CreateTable
CREATE TABLE "PriorSeasonAverage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "season_year" INTEGER NOT NULL,
    "average" REAL NOT NULL,
    CONSTRAINT "PriorSeasonAverage_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PriorSeasonAverage_player_id_season_year_key" ON "PriorSeasonAverage"("player_id", "season_year");
