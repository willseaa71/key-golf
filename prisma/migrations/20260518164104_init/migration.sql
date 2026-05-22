-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Round" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "total_score" INTEGER NOT NULL,
    "has_hole_scores" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "Round_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Round_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HoleScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round_id" INTEGER NOT NULL,
    "hole_number" INTEGER NOT NULL,
    "strokes" INTEGER NOT NULL,
    CONSTRAINT "HoleScore_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Round_player_id_week_number_season_id_key" ON "Round"("player_id", "week_number", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "HoleScore_round_id_hole_number_key" ON "HoleScore"("round_id", "hole_number");
