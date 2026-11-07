-- Allow the verified cleanup transaction to execute FK-driven updates for its owner only.
CREATE OR REPLACE FUNCTION seller_assert_account_active() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('seller-account-lifecycle'),hashtext(NEW.owner_id));
 IF current_setting('seller.account_cleanup',true) IS DISTINCT FROM NEW.owner_id AND EXISTS(SELECT 1 FROM seller_account_deletions WHERE owner_id=NEW.owner_id) THEN
  RAISE EXCEPTION 'Account deletion is in progress' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;
