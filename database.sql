-- 1. Pehle database banayein (agar nahi bana hai)
CREATE DATABASE IF NOT EXISTS ncc_system;
USE ncc_system;

-- 2. Cadets table banayein
CREATE TABLE IF NOT EXISTS cadets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    enrollment_no VARCHAR(50) UNIQUE NOT NULL,
    college_name VARCHAR(255),
    year ENUM('1', '2', '3'),
    gender ENUM('Male', 'Female'),
    wing ENUM('Army', 'Navy', 'Air Force'), --
    cert_level ENUM('A', 'B', 'C'),
    phone VARCHAR(15),
    email VARCHAR(100),
    reg_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);