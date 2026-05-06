-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL NOT NULL,
    "pnl" REAL NOT NULL,
    "pnlPercent" REAL NOT NULL,
    "commission" REAL NOT NULL,
    "duration" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "entryTime" TEXT NOT NULL,
    "exitTime" TEXT NOT NULL,
    "riskAmount" REAL,
    "riskPercent" REAL,
    "stopLoss" REAL,
    "rMultiple" REAL,
    "mfe" REAL,
    "mae" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_date_idx" ON "Trade"("date");
