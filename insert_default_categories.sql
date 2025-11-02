-- Script para insertar categorías predeterminadas de ejemplo
-- Reemplaza 'YOUR_USER_ID' con tu user_id de la tabla users

-- Categorías de ejemplo comunes para emails
INSERT INTO categories (user_id, name, description, color, created_at, updated_at) VALUES
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Work',
  'Professional emails related to work, projects, meetings, and business communications',
  '#3B82F6',
  NOW(),
  NOW()
),
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Personal',
  'Personal emails from friends, family, and personal contacts',
  '#10B981',
  NOW(),
  NOW()
),
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Finance',
  'Financial emails including bank statements, bills, invoices, and payment confirmations',
  '#F59E0B',
  NOW(),
  NOW()
),
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Shopping',
  'E-commerce emails, order confirmations, shipping notifications, and promotional offers',
  '#EC4899',
  NOW(),
  NOW()
),
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Newsletters',
  'Newsletters, subscriptions, blog updates, and informational content',
  '#8B5CF6',
  NOW(),
  NOW()
),
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Social',
  'Social media notifications, updates from social platforms',
  '#06B6D4',
  NOW(),
  NOW()
),
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Travel',
  'Travel bookings, flight confirmations, hotel reservations, and travel updates',
  '#14B8A6',
  NOW(),
  NOW()
),
(
  (SELECT id FROM users WHERE email = 'picuetisimos25@gmail.com' LIMIT 1),
  'Spam',
  'Unwanted emails, promotional spam, and suspicious messages',
  '#EF4444',
  NOW(),
  NOW()
);
