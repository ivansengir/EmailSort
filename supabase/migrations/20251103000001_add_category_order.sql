-- Add order_index column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Set initial order based on created_at
UPDATE categories
SET order_index = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) - 1 as row_num
  FROM categories
) AS subquery
WHERE categories.id = subquery.id;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS categories_order_index_idx ON categories(order_index);
