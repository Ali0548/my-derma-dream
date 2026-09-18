-- Lumora Labs full schema (single initial migration)

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "password_hash" text NOT NULL,
  "name" varchar(120) NOT NULL,
  "role" varchar(32) DEFAULT 'manager' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "affiliates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(160),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "affiliates_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "sub_affiliates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(64) NOT NULL,
  "affiliate_code" varchar(64) NOT NULL,
  "name" varchar(160),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sub_affiliates_code_uq" ON "sub_affiliates" ("code");

CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "product_kind" varchar(32) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "products_name_kind_uq" ON "products" ("name", "product_kind");

CREATE TABLE IF NOT EXISTS "product_price_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_name" varchar(120) NOT NULL,
  "price_point" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_price_points_uq" ON "product_price_points" ("product_name", "price_point");

CREATE TABLE IF NOT EXISTS "cpa_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" varchar(32) NOT NULL,
  "product" varchar(120) DEFAULT '' NOT NULL,
  "price_point" varchar(32) DEFAULT '' NOT NULL,
  "affiliate" varchar(64) DEFAULT '' NOT NULL,
  "sub_affiliate" varchar(64) DEFAULT '' NOT NULL,
  "cpa_type" varchar(16) NOT NULL,
  "cpa_value" numeric(12, 4) NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "specificity_score" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cpa_rules_rule_id_unique" UNIQUE("rule_id")
);

DO $$ BEGIN
  ALTER TABLE "cpa_rules"
    ADD CONSTRAINT "cpa_rules_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "cpa_rules"
    ADD CONSTRAINT "cpa_rules_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" varchar(32) NOT NULL,
  "order_date" date NOT NULL,
  "affiliate_code" varchar(64) DEFAULT '' NOT NULL,
  "sub_affiliate_code" varchar(64) DEFAULT '' NOT NULL,
  "product_1_name" varchar(120) NOT NULL,
  "product_1_price" numeric(12, 2) NOT NULL,
  "price_point" varchar(32) DEFAULT '' NOT NULL,
  "product_2_name" varchar(120),
  "product_2_price" numeric(12, 2),
  "product_3_name" varchar(120),
  "product_3_price" numeric(12, 2),
  "product_4_name" varchar(120),
  "product_4_price" numeric(12, 2),
  "product_5_name" varchar(120),
  "product_5_price" numeric(12, 2),
  "frontend_revenue" numeric(12, 2),
  "upsell_revenue" numeric(12, 2),
  "total_revenue" numeric(12, 2),
  "commission" numeric(12, 2),
  "commission_status" varchar(16) DEFAULT 'pending' NOT NULL,
  "applied_rule_id" varchar(32),
  "applied_rule_uuid" uuid,
  "applied_cpa_type" varchar(16),
  "applied_cpa_value" numeric(12, 4),
  "specificity_score" integer,
  "win_reason" text,
  "calculated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "orders_order_id_unique" UNIQUE("order_id")
);

DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_applied_rule_uuid_cpa_rules_id_fk"
    FOREIGN KEY ("applied_rule_uuid") REFERENCES "public"."cpa_rules"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "order_commission_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_uuid" uuid NOT NULL,
  "order_id" varchar(32) NOT NULL,
  "winning_rule_uuid" uuid,
  "winning_rule_id" varchar(32),
  "winning_specificity" integer,
  "candidate_count" integer DEFAULT 0 NOT NULL,
  "commission" numeric(12, 2),
  "summary" text,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_commission_audits_order_uuid_unique" UNIQUE("order_uuid")
);

DO $$ BEGIN
  ALTER TABLE "order_commission_audits"
    ADD CONSTRAINT "order_commission_audits_order_uuid_orders_id_fk"
    FOREIGN KEY ("order_uuid") REFERENCES "public"."orders"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_commission_audits"
    ADD CONSTRAINT "order_commission_audits_winning_rule_uuid_cpa_rules_id_fk"
    FOREIGN KEY ("winning_rule_uuid") REFERENCES "public"."cpa_rules"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "order_rule_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "audit_id" uuid NOT NULL,
  "order_uuid" uuid NOT NULL,
  "rule_uuid" uuid,
  "rule_id" varchar(32) NOT NULL,
  "matched" boolean DEFAULT false NOT NULL,
  "is_winner" boolean DEFAULT false NOT NULL,
  "specificity_score" integer DEFAULT 0 NOT NULL,
  "outcome_code" varchar(64) NOT NULL,
  "outcome_detail" text,
  "cpa_type" varchar(16),
  "cpa_value" numeric(12, 4),
  "hypothetical_commission" numeric(12, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "order_rule_evaluations"
    ADD CONSTRAINT "order_rule_evaluations_audit_id_order_commission_audits_id_fk"
    FOREIGN KEY ("audit_id") REFERENCES "public"."order_commission_audits"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_rule_evaluations"
    ADD CONSTRAINT "order_rule_evaluations_order_uuid_orders_id_fk"
    FOREIGN KEY ("order_uuid") REFERENCES "public"."orders"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_rule_evaluations"
    ADD CONSTRAINT "order_rule_evaluations_rule_uuid_cpa_rules_id_fk"
    FOREIGN KEY ("rule_uuid") REFERENCES "public"."cpa_rules"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "daily_performance_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stat_date" date NOT NULL,
  "affiliate_code" varchar(64) DEFAULT '' NOT NULL,
  "sub_affiliate_code" varchar(64) DEFAULT '' NOT NULL,
  "product_name" varchar(120) DEFAULT '' NOT NULL,
  "price_point" varchar(32) DEFAULT '' NOT NULL,
  "sales_count" integer DEFAULT 0 NOT NULL,
  "frontend_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
  "upsell_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
  "total_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
  "spend" numeric(14, 2) DEFAULT '0' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_performance_stats_grain_uq"
  ON "daily_performance_stats" ("stat_date", "affiliate_code", "sub_affiliate_code", "product_name", "price_point");

CREATE TABLE IF NOT EXISTS "data_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(32) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "source_path" text,
  "row_count" integer DEFAULT 0,
  "success_count" integer DEFAULT 0,
  "error_count" integer DEFAULT 0,
  "error_sample" jsonb,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "triggered_by" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "data_imports"
    ADD CONSTRAINT "data_imports_triggered_by_users_id_fk"
    FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "recalc_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "reason" varchar(64) NOT NULL,
  "rule_id" varchar(32),
  "date_from" date,
  "date_to" date,
  "orders_processed" integer DEFAULT 0,
  "orders_total" integer DEFAULT 0,
  "error_message" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "recalc_jobs"
    ADD CONSTRAINT "recalc_jobs_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "cpa_rules_product_idx" ON "cpa_rules" ("product");
CREATE INDEX IF NOT EXISTS "cpa_rules_affiliate_idx" ON "cpa_rules" ("affiliate");
CREATE INDEX IF NOT EXISTS "cpa_rules_sub_affiliate_idx" ON "cpa_rules" ("sub_affiliate");
CREATE INDEX IF NOT EXISTS "cpa_rules_effective_idx" ON "cpa_rules" ("effective_from", "effective_to");
CREATE INDEX IF NOT EXISTS "cpa_rules_active_spec_idx" ON "cpa_rules" ("is_active", "specificity_score");
CREATE INDEX IF NOT EXISTS "cpa_rules_match_idx" ON "cpa_rules" ("product", "price_point", "affiliate", "sub_affiliate", "effective_from");

CREATE INDEX IF NOT EXISTS "orders_order_date_idx" ON "orders" ("order_date");
CREATE INDEX IF NOT EXISTS "orders_affiliate_idx" ON "orders" ("affiliate_code");
CREATE INDEX IF NOT EXISTS "orders_sub_affiliate_idx" ON "orders" ("sub_affiliate_code");
CREATE INDEX IF NOT EXISTS "orders_product_price_idx" ON "orders" ("product_1_name", "price_point");
CREATE INDEX IF NOT EXISTS "orders_commission_status_idx" ON "orders" ("commission_status");
CREATE INDEX IF NOT EXISTS "orders_report_idx" ON "orders" ("order_date", "affiliate_code", "sub_affiliate_code", "product_1_name", "price_point");

CREATE INDEX IF NOT EXISTS "order_commission_audits_order_id_idx" ON "order_commission_audits" ("order_id");
CREATE INDEX IF NOT EXISTS "order_commission_audits_rule_idx" ON "order_commission_audits" ("winning_rule_id");

CREATE INDEX IF NOT EXISTS "order_rule_evaluations_audit_idx" ON "order_rule_evaluations" ("audit_id");
CREATE INDEX IF NOT EXISTS "order_rule_evaluations_order_idx" ON "order_rule_evaluations" ("order_uuid");
CREATE INDEX IF NOT EXISTS "order_rule_evaluations_rule_idx" ON "order_rule_evaluations" ("rule_id");

CREATE INDEX IF NOT EXISTS "daily_performance_stats_date_idx" ON "daily_performance_stats" ("stat_date");
CREATE INDEX IF NOT EXISTS "daily_performance_stats_affiliate_idx" ON "daily_performance_stats" ("affiliate_code", "sub_affiliate_code");
CREATE INDEX IF NOT EXISTS "daily_performance_stats_product_idx" ON "daily_performance_stats" ("product_name", "price_point");
CREATE INDEX IF NOT EXISTS "daily_performance_stats_report_idx" ON "daily_performance_stats" ("stat_date", "affiliate_code", "product_name", "price_point");

CREATE INDEX IF NOT EXISTS "data_imports_kind_status_idx" ON "data_imports" ("kind", "status");
CREATE INDEX IF NOT EXISTS "data_imports_created_idx" ON "data_imports" ("created_at");

CREATE INDEX IF NOT EXISTS "recalc_jobs_status_idx" ON "recalc_jobs" ("status");
CREATE INDEX IF NOT EXISTS "recalc_jobs_created_idx" ON "recalc_jobs" ("created_at");
