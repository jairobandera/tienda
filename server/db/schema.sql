-- =============================================================
--  Tienda Kairos - Esquema de base de datos (idempotente)
-- =============================================================

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm no disponible: la búsqueda funcionará sin índice trigram';
END $$;

-- ---------- Usuarios ----------
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  phone          VARCHAR(40),
  role           VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addresses (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  street       VARCHAR(160) NOT NULL,
  number       VARCHAR(20),
  apartment    VARCHAR(40),
  city         VARCHAR(100) NOT NULL,
  department   VARCHAR(100) NOT NULL,
  postal_code  VARCHAR(20),
  notes        VARCHAR(300),
  is_default   BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- ---------- Catálogo ----------
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  slug          VARCHAR(240) NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  brand         VARCHAR(100),
  condition     VARCHAR(10) NOT NULL DEFAULT 'nuevo' CHECK (condition IN ('nuevo', 'usado')),
  price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  own_discount  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (own_discount >= 0 AND own_discount < 100),
  stock         INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  images        JSONB NOT NULL DEFAULT '[]'::jsonb,
  active        BOOLEAN NOT NULL DEFAULT true,
  featured      BOOLEAN NOT NULL DEFAULT false,
  sold_count    INT NOT NULL DEFAULT 0,
  search_text   TEXT GENERATED ALWAYS AS (
                  translate(lower(title || ' ' || coalesce(brand, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou')
                ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_sold ON products(sold_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_search_trgm ON products USING gin (search_text gin_trgm_ops)';
  END IF;
END $$;

-- ---------- Promociones / descuentos ----------
CREATE TABLE IF NOT EXISTS promotions (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(120) NOT NULL,
  banner_text       VARCHAR(240),
  discount_percent  NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent < 100),
  scope             VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'products', 'categories')),
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  active            BOOLEAN NOT NULL DEFAULT true,
  show_banner       BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);

CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id  INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_products_product ON promotion_products(product_id);

CREATE TABLE IF NOT EXISTS promotion_categories (
  promotion_id  INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  category_id   INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, category_id)
);

-- ---------- Carrito ----------
CREATE TABLE IF NOT EXISTS cart_items (
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INT NOT NULL CHECK (quantity > 0),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ---------- Pedidos ----------
CREATE TABLE IF NOT EXISTS orders (
  id                SERIAL PRIMARY KEY,
  user_id           INT NOT NULL REFERENCES users(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','preparing','shipped','delivered','cancelled','rejected','refunded')),
  payment_provider  VARCHAR(20) NOT NULL DEFAULT 'mercadopago' CHECK (payment_provider IN ('mercadopago','cash','simulated')),
  payment_status    VARCHAR(40),
  payment_method    VARCHAR(60),   -- visa, master, abitab, redpagos, efectivo...
  payment_type      VARCHAR(60),   -- credit_card, debit_card, ticket, account_money...
  installments      INT,
  mp_preference_id  VARCHAR(120),
  mp_payment_id     VARCHAR(60),
  subtotal          NUMERIC(12,2) NOT NULL,
  discount_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL,
  shipping_method   VARCHAR(20) NOT NULL DEFAULT 'delivery' CHECK (shipping_method IN ('delivery','pickup')),
  ship_name         VARCHAR(120) NOT NULL,
  ship_phone        VARCHAR(40) NOT NULL,
  ship_street       VARCHAR(160),
  ship_number       VARCHAR(20),
  ship_apartment    VARCHAR(40),
  ship_city         VARCHAR(100),
  ship_department   VARCHAR(100),
  ship_postal_code  VARCHAR(20),
  ship_notes        VARCHAR(300),
  customer_notes    VARCHAR(500),
  admin_notes       TEXT,
  tracking_code     VARCHAR(120),
  stock_restored    BOOLEAN NOT NULL DEFAULT false,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_mp_payment ON orders(mp_payment_id);

CREATE TABLE IF NOT EXISTS order_items (
  id              SERIAL PRIMARY KEY,
  order_id        INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  title           VARCHAR(200) NOT NULL,
  image           TEXT,
  original_price  NUMERIC(12,2) NOT NULL,
  unit_price      NUMERIC(12,2) NOT NULL,
  quantity        INT NOT NULL CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ---------- Configuración ----------
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(60) PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Vista de productos con precio final ----------
-- Aplica el mayor descuento entre: descuento propio del producto y promociones vigentes
-- (globales, por categoría o por producto).
DROP VIEW IF EXISTS v_products;
CREATE VIEW v_products AS
SELECT
  p.*,
  c.name AS category_name,
  c.slug AS category_slug,
  GREATEST(p.own_discount, COALESCE(d.discount, 0)) AS discount_percent,
  CASE WHEN COALESCE(d.discount, 0) >= p.own_discount AND d.discount IS NOT NULL THEN d.promo_name END AS promo_name,
  ROUND(p.price * (1 - GREATEST(p.own_discount, COALESCE(d.discount, 0)) / 100.0), 2) AS final_price
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN LATERAL (
  SELECT pr.discount_percent AS discount, pr.name AS promo_name
  FROM promotions pr
  WHERE pr.active
    AND (pr.starts_at IS NULL OR pr.starts_at <= now())
    AND (pr.ends_at   IS NULL OR pr.ends_at   >  now())
    AND (
      pr.scope = 'all'
      OR (pr.scope = 'products'   AND EXISTS (SELECT 1 FROM promotion_products pp   WHERE pp.promotion_id = pr.id AND pp.product_id  = p.id))
      OR (pr.scope = 'categories' AND EXISTS (SELECT 1 FROM promotion_categories pc WHERE pc.promotion_id = pr.id AND pc.category_id = p.category_id))
    )
  ORDER BY pr.discount_percent DESC
  LIMIT 1
) d ON true;
