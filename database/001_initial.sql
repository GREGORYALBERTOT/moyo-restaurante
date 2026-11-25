BEGIN;

CREATE TABLE IF NOT EXISTS restaurant (
  id smallint PRIMARY KEY CHECK (id = 1),
  name text NOT NULL DEFAULT 'Mi restaurante',
  subtitle text NOT NULL DEFAULT '',
  next_order_number integer NOT NULL DEFAULT 1 CHECK (next_order_number > 0)
);
INSERT INTO restaurant(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS restaurant_members (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  auth_user_id text UNIQUE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  role text NOT NULL CHECK (role IN ('admin', 'mesero', 'cocina', 'caja')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  category text NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 60),
  price integer NOT NULL CHECK (price BETWEEN 1 AND 10000000),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  available boolean NOT NULL DEFAULT true,
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS products_active_name ON products (lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY,
  number integer NOT NULL CHECK (number BETWEEN 1 AND 999),
  seats integer NOT NULL CHECK (seats BETWEEN 1 AND 20),
  zone text NOT NULL CHECK (length(trim(zone)) BETWEEN 1 AND 60),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tables_active_number ON restaurant_tables(number) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  number integer NOT NULL UNIQUE CHECK (number > 0),
  table_id uuid NOT NULL REFERENCES restaurant_tables(id),
  table_number integer NOT NULL,
  waiter text NOT NULL,
  guests integer NOT NULL CHECK (guests BETWEEN 1 AND 20),
  status text NOT NULL CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'paid', 'rejected')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  rejection_reason text CHECK (rejection_reason IS NULL OR length(trim(rejection_reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_active_per_table ON orders(table_id) WHERE status IN ('pending', 'preparing', 'ready', 'delivered');
CREATE INDEX IF NOT EXISTS orders_history_date ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  order_id uuid NOT NULL REFERENCES orders(id),
  item_index integer NOT NULL CHECK (item_index >= 0),
  product_id uuid NOT NULL REFERENCES products(id),
  name text NOT NULL,
  price integer NOT NULL CHECK (price BETWEEN 1 AND 10000000),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  PRIMARY KEY (order_id, item_index)
);

CREATE TABLE IF NOT EXISTS payments (
  order_id uuid PRIMARY KEY REFERENCES orders(id),
  method text NOT NULL CHECK (method IN ('cash', 'card', 'yape')),
  received bigint NOT NULL CHECK (received >= 0),
  change bigint NOT NULL CHECK (change >= 0 AND change <= received),
  paid_at timestamptz NOT NULL DEFAULT now(),
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 500)
);
CREATE INDEX IF NOT EXISTS payments_date ON payments(paid_at DESC);

CREATE TABLE IF NOT EXISTS activity (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('order', 'kitchen', 'delivery', 'payment', 'settings', 'team')),
  time timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_time ON activity(time DESC);

COMMIT;
