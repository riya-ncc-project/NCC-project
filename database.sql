-- ══════════════════════════════════════════════════════════
--  ncc_database.sql  —  NCC Portal MySQL Setup
--  Ek baar run karo:
--  mysql -u root -p < ncc_database.sql
-- ══════════════════════════════════════════════════════════

-- 1. Database banao
CREATE DATABASE IF NOT EXISTS ncc_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ncc_portal;

-- ─────────────────────────────────────────────────────────
-- TABLE 1: cadets
-- Registration form ka data yahan aata hai
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cadets (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  cadet_id      VARCHAR(20)     NOT NULL UNIQUE,   -- e.g. NCC2024001
  first_name    VARCHAR(60)     NOT NULL,
  middle_name   VARCHAR(60)     DEFAULT '',
  last_name     VARCHAR(60)     NOT NULL,
  phone         CHAR(10)        NOT NULL UNIQUE,
  bn_code       VARCHAR(20)     NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  registered_at DATETIME        DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME        DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
-- TABLE 2: cadet_details
-- Cadet Details tab ka data yahan aata hai
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cadet_details (
  id              INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  cadet_id        VARCHAR(20)    DEFAULT NULL,     -- cadets.cadet_id se link
  bn_code         VARCHAR(20)    NOT NULL,
  mobile          CHAR(10)       NOT NULL UNIQUE,
  wing            VARCHAR(20)    NOT NULL,
  `rank`          VARCHAR(30)    DEFAULT 'Cadet',
  enrollment_year YEAR           NOT NULL,
  dob             DATE           NOT NULL,
  address         TEXT           DEFAULT NULL,
  saved_at        DATETIME       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cadet_id) REFERENCES cadets(cadet_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
-- VIEW: dono tables ka joined data ek jagah dekhne ke liye
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_cadets_full AS
SELECT
  c.cadet_id,
  CONCAT(c.first_name,
         IF(c.middle_name != '', CONCAT(' ', c.middle_name), ''),
         ' ', c.last_name)          AS full_name,
  c.phone,
  c.bn_code                         AS reg_bn_code,
  c.registered_at,
  c.last_login,
  d.wing,
  d.rank,
  d.mobile                          AS detail_mobile,
  d.enrollment_year,
  d.dob,
  TIMESTAMPDIFF(YEAR, d.dob, NOW()) AS age,
  d.address,
  d.saved_at                        AS details_saved_at
FROM cadets c
LEFT JOIN cadet_details d ON c.cadet_id = d.cadet_id;

-- ─────────────────────────────────────────────────────────
-- Useful queries (run karne ke liye -- hata do)
-- ─────────────────────────────────────────────────────────
-- SELECT * FROM cadets;                 -- sirf registration data
-- SELECT * FROM cadet_details;          -- sirf cadet details
-- SELECT * FROM v_cadets_full;          -- dono tables ka joined data
-- SELECT cadet_id, full_name, wing, enrollment_year FROM v_cadets_full;
