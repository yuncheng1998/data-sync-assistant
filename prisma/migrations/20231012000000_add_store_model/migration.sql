-- CreateTable
CREATE TABLE "Store" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "installDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uninstalledAt" TIMESTAMP(3),
  "plan" TEXT,
  "locale" TEXT,
  "country" TEXT,
  "timezone" TEXT,
  "currency" TEXT,
  "owner" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "lastLogin" TIMESTAMP(3),
  "metafields" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_shop_key" ON "Store"("shop");

-- AddExistingStores
-- 插入现有会话数据的商店
INSERT INTO "Store" ("id", "shop", "status", "installDate", "createdAt", "updatedAt", "lastLogin")
SELECT 
  gen_random_uuid()::text, -- 生成随机UUID
  shop, 
  'ACTIVE', 
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP
FROM "Session"
GROUP BY shop
ON CONFLICT (shop) DO NOTHING; 