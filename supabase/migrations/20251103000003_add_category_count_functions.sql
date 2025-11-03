-- Function to increment email count for a category
CREATE OR REPLACE FUNCTION increment_category_email_count(category_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE categories
  SET email_count = COALESCE(email_count, 0) + 1
  WHERE id = category_uuid;
END;
$$;

-- Function to decrement email count for a category
CREATE OR REPLACE FUNCTION decrement_category_email_count(category_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE categories
  SET email_count = GREATEST(0, COALESCE(email_count, 0) - 1)
  WHERE id = category_uuid;
END;
$$;
