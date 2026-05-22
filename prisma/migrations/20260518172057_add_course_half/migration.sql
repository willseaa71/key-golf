/*
  Warnings:

  - Added the required column `course_half` to the `Round` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Round" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "course_half" TEXT NOT NULL,
    "total_score" INTEGER NOT NULL,
    "has_hole_scores" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "Round_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Round_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("date", "has_hole_scores", "id", "notes", "player_id", "season_id", "total_score", "week_number") SELECT "date", "has_hole_scores", "id", "notes", "player_id", "season_id", "total_score", "week_number" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
CREATE UNIQUE INDEX "Round_player_id_week_number_season_id_key" ON "Round"("player_id", "week_number", "season_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
