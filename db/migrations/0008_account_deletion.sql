CREATE TABLE "seller_account_deletions" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"resume_hash" text NOT NULL,
	"phase" text DEFAULT 'files' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_account_deletions_id_unique" UNIQUE("id"),
	CONSTRAINT "seller_account_deletion_phase" CHECK ("seller_account_deletions"."phase" in ('files','records','identity','complete'))
);

--> statement-breakpoint
CREATE FUNCTION seller_assert_account_active() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seller-account-lifecycle'),hashtext(NEW.owner_id));
 IF EXISTS(SELECT 1 FROM seller_account_deletions WHERE owner_id=NEW.owner_id) THEN
  RAISE EXCEPTION 'Account deletion is in progress' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
DO $$ DECLARE row record; BEGIN
 FOR row IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='owner_id' AND table_name LIKE 'seller_%' AND table_name<>'seller_account_deletions' AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
  EXECUTE format('CREATE TRIGGER seller_account_active BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION seller_assert_account_active()',row.table_name);
 END LOOP;
END $$;
