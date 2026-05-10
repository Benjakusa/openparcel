-- Migration 002: Offices
CREATE TABLE IF NOT EXISTS offices (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  UNIQUE(company_id, name)
);
