CREATE TABLE IF NOT EXISTS "public"."shortages" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "product_name" TEXT NOT NULL,
    "notes" TEXT,
    "branch_id" TEXT,
    "reported_by_name" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "is_resolved" BOOLEAN DEFAULT FALSE
);

ALTER TABLE "public"."shortages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users to read shortages" ON "public"."shortages"
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert shortages" ON "public"."shortages"
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to update shortages" ON "public"."shortages"
    FOR UPDATE USING (true);
