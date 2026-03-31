const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcrypt');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── DATABASE CONFIG ──────────────────────────────────────────
const dbConfig = {
  host    : 'localhost',
  port    : 3306,
  user    : 'root',
  password: 'root123',       // ← apna password yahan daalo
  database: 'ncc_system',
  waitForConnections: true,
  connectionLimit   : 10,
};
const pool = mysql.createPool(dbConfig);

// ── DB CONNECT + AUTO MIGRATE ────────────────────────────────
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected — ncc_system ready!');

    // ── Create cadets table (registration data) ──
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cadets (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        cadet_id     VARCHAR(20) UNIQUE NOT NULL,
        first_name   VARCHAR(60) NOT NULL,
        middle_name  VARCHAR(60) DEFAULT '',
        last_name    VARCHAR(60) NOT NULL,
        phone_number VARCHAR(15) NOT NULL,
        bn_code      VARCHAR(20) NOT NULL,
        password     VARCHAR(255) NOT NULL,
        last_login   DATETIME DEFAULT NULL,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Create cadet_details table (all detail form fields) ──
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cadet_details (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        cadet_id         VARCHAR(20) UNIQUE NOT NULL,

        -- Contact & Unit Identity
        bn_code          VARCHAR(20)  DEFAULT '',
        mobile           VARCHAR(15)  DEFAULT '',
        unit_name        VARCHAR(100) DEFAULT '',
        group_hq         VARCHAR(100) DEFAULT '',

        -- Personal Information
        dob              DATE         DEFAULT NULL,
        gender           VARCHAR(10)  DEFAULT '',
        blood_group      VARCHAR(5)   DEFAULT '',
        category         VARCHAR(10)  DEFAULT '',
        religion         VARCHAR(20)  DEFAULT '',
        nationality      VARCHAR(30)  DEFAULT 'Indian',
        address          TEXT         DEFAULT NULL,
        father_name      VARCHAR(100) DEFAULT '',
        emergency_phone  VARCHAR(15)  DEFAULT '',

        -- Academic
        school_name      VARCHAR(150) DEFAULT '',
        class_year       VARCHAR(20)  DEFAULT '',
        stream           VARCHAR(50)  DEFAULT '',

        -- NCC Unit Details
        wing             VARCHAR(30)  DEFAULT '',
        \`rank\`         VARCHAR(30)  DEFAULT '',
        enrollment_year  YEAR         DEFAULT NULL,
        certificate      VARCHAR(20)  DEFAULT '',
        directorate      VARCHAR(80)  DEFAULT '',
        training_status  VARCHAR(50)  DEFAULT '',
        camp_attended    VARCHAR(80)  DEFAULT '',
        drill_proficiency VARCHAR(30) DEFAULT '',

        -- Achievements
        awards           VARCHAR(200) DEFAULT '',
        sports           VARCHAR(200) DEFAULT '',
        remarks          TEXT         DEFAULT NULL,

        saved_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (cadet_id) REFERENCES cadets(cadet_id) ON DELETE CASCADE
      )
    `);

    // ── Safe migrations — add new columns if they don't exist yet ──
    // (Runs silently for existing databases — duplicate column errors are ignored)
    const newColumns = [
      "ALTER TABLE cadet_details ADD COLUMN unit_name        VARCHAR(100) DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN group_hq         VARCHAR(100) DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN gender           VARCHAR(10)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN blood_group      VARCHAR(5)   DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN category         VARCHAR(10)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN religion         VARCHAR(20)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN nationality      VARCHAR(30)  DEFAULT 'Indian'",
      "ALTER TABLE cadet_details ADD COLUMN father_name      VARCHAR(100) DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN emergency_phone  VARCHAR(15)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN school_name      VARCHAR(150) DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN class_year       VARCHAR(20)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN stream           VARCHAR(50)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN certificate      VARCHAR(20)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN directorate      VARCHAR(80)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN training_status  VARCHAR(50)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN camp_attended    VARCHAR(80)  DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN drill_proficiency VARCHAR(30) DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN awards           VARCHAR(200) DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN sports           VARCHAR(200) DEFAULT ''",
      "ALTER TABLE cadet_details ADD COLUMN remarks          TEXT         DEFAULT NULL",
    ];
    for (const sql of newColumns) {
      try { await conn.execute(sql); } catch (e) { /* column already exists — skip */ }
    }

    conn.release();
    console.log('✅  Tables ready & migrations done!');
  } catch (e) {
    console.error('❌  MySQL FAILED:', e.message);
    process.exit(1);
  }
})();

// ════════════════════════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════════════════════════
function safeAge(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob)) / 31557600000);
}

// ════════════════════════════════════════════════════════════
//  API — REGISTER
// ════════════════════════════════════════════════════════════
app.post('/api/register', async (req, res) => {
  const { cadetId, firstName, middleName, lastName, phone, bnCode, password } = req.body;

  if (!cadetId || cadetId.length < 5)
    return res.status(400).json({ message: 'Cadet ID must be at least 5 characters.' });
  if (!firstName || !lastName)
    return res.status(400).json({ message: 'First and Last name are required.' });
  if (!/^[6-9]\d{9}$/.test(phone))
    return res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' });
  if (!bnCode || bnCode.length < 3)
    return res.status(400).json({ message: 'BN Code must be at least 3 characters.' });
  if (!password || password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });

  try {
    const conn = await pool.getConnection();

    // Duplicate Cadet ID check
    const [existId] = await conn.execute(
      'SELECT cadet_id FROM cadets WHERE cadet_id = ?', [cadetId]
    );
    if (existId.length > 0) {
      conn.release();
      return res.status(409).json({ message: 'Cadet ID already registered. Use a different ID.' });
    }

    // Duplicate phone check
    const [existPhone] = await conn.execute(
      'SELECT id FROM cadets WHERE phone_number = ?', [phone]
    );
    if (existPhone.length > 0) {
      conn.release();
      return res.status(409).json({ message: 'This mobile number is already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    await conn.execute(
      `INSERT INTO cadets
         (cadet_id, first_name, middle_name, last_name, phone_number, bn_code, password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [cadetId, firstName.trim(), middleName || '', lastName.trim(), phone, bnCode.trim(), hashed]
    );

    conn.release();
    console.log(`✅  Registered: ${cadetId}`);
    return res.status(201).json({ status: 'success', message: 'Registration successful!' });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  API — LOGIN
// ════════════════════════════════════════════════════════════
app.post('/api/login', async (req, res) => {
  const { cadetId, bnCode, password } = req.body;

  if (!cadetId || !bnCode || !password)
    return res.status(400).json({ message: 'All fields are required.' });

  try {
    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      'SELECT id, cadet_id, first_name, last_name, bn_code, password FROM cadets WHERE cadet_id = ?',
      [cadetId]
    );
    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'No account found with this Cadet ID.' });
    }

    const cadet = rows[0];

    if (cadet.bn_code.toUpperCase() !== bnCode.toUpperCase()) {
      conn.release();
      return res.status(401).json({ message: 'BN Code does not match.' });
    }

    const match = await bcrypt.compare(password, cadet.password);
    if (!match) {
      conn.release();
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    await conn.execute('UPDATE cadets SET last_login = NOW() WHERE cadet_id = ?', [cadetId]);
    conn.release();

    console.log(`✅  Login: ${cadetId}`);
    return res.status(200).json({
      status  : 'success',
      message : 'Login successful!',
      name    : `${cadet.first_name} ${cadet.last_name}`,
      cadetId : cadet.cadet_id,
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  API — SAVE CADET DETAILS  (all new fields included)
// ════════════════════════════════════════════════════════════
app.post('/api/cadet-details', async (req, res) => {
  const {
    cadetId,
    // Contact & Unit
    bnCode, mobile, unitName, groupHQ,
    // Personal
    dob, gender, bloodGroup, category, religion, nationality,
    address, fatherName, emergencyPhone,
    // Academic
    schoolName, classYear, stream,
    // NCC Unit
    wing, rank, enrollYear, certificate, directorate,
    trainingStatus, campAttended, drillProficiency,
    // Achievements
    awards, sports, remarks,
  } = req.body;

  // ── Required field validation ──
  if (!bnCode || bnCode.length < 3)
    return res.status(400).json({ message: 'BN Code is required (min 3 chars).' });
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile))
    return res.status(400).json({ message: 'Enter valid 10-digit Indian mobile number.' });
  if (!dob)
    return res.status(400).json({ message: 'Date of Birth is required.' });
  const age = safeAge(dob);
  if (age < 13 || age > 26)
    return res.status(400).json({ message: 'Age must be between 13 and 26 years.' });
  if (!gender)
    return res.status(400).json({ message: 'Gender is required.' });
  if (!bloodGroup)
    return res.status(400).json({ message: 'Blood Group is required.' });
  if (!address || address.length < 10)
    return res.status(400).json({ message: 'Enter full permanent address.' });
  if (!fatherName)
    return res.status(400).json({ message: "Father / Guardian name is required." });
  if (!emergencyPhone || !/^[6-9]\d{9}$/.test(emergencyPhone))
    return res.status(400).json({ message: 'Enter valid emergency contact number.' });
  if (!schoolName)
    return res.status(400).json({ message: 'School / College name is required.' });
  if (!wing)
    return res.status(400).json({ message: 'Wing selection is required.' });
  if (!rank)
    return res.status(400).json({ message: 'Rank selection is required.' });
  if (!enrollYear)
    return res.status(400).json({ message: 'Enrollment Year is required.' });

  try {
    const conn = await pool.getConnection();

    // Verify cadet exists
    const [exists] = await conn.execute(
      'SELECT cadet_id FROM cadets WHERE cadet_id = ?', [cadetId || '']
    );
    if (exists.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Cadet not found. Please login again.' });
    }

    // Upsert into cadet_details
    await conn.execute(
      `INSERT INTO cadet_details
         (cadet_id, bn_code, mobile, unit_name, group_hq,
          dob, gender, blood_group, category, religion, nationality,
          address, father_name, emergency_phone,
          school_name, class_year, stream,
          wing, \`rank\`, enrollment_year, certificate, directorate,
          training_status, camp_attended, drill_proficiency,
          awards, sports, remarks, saved_at)
       VALUES (?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
         bn_code=VALUES(bn_code), mobile=VALUES(mobile),
         unit_name=VALUES(unit_name), group_hq=VALUES(group_hq),
         dob=VALUES(dob), gender=VALUES(gender), blood_group=VALUES(blood_group),
         category=VALUES(category), religion=VALUES(religion),
         nationality=VALUES(nationality), address=VALUES(address),
         father_name=VALUES(father_name), emergency_phone=VALUES(emergency_phone),
         school_name=VALUES(school_name), class_year=VALUES(class_year),
         stream=VALUES(stream), wing=VALUES(wing), \`rank\`=VALUES(\`rank\`),
         enrollment_year=VALUES(enrollment_year), certificate=VALUES(certificate),
         directorate=VALUES(directorate), training_status=VALUES(training_status),
         camp_attended=VALUES(camp_attended), drill_proficiency=VALUES(drill_proficiency),
         awards=VALUES(awards), sports=VALUES(sports),
         remarks=VALUES(remarks), saved_at=NOW()`,
      [
        cadetId,
        bnCode.trim(), mobile, unitName || '', groupHQ || '',
        dob, gender, bloodGroup, category || '', religion || '', nationality || 'Indian',
        address, fatherName.trim(), emergencyPhone,
        schoolName.trim(), classYear || '', stream || '',
        wing, rank, parseInt(enrollYear), certificate || '', directorate || '',
        trainingStatus || '', campAttended || '', drillProficiency || '',
        awards || '', sports || '', remarks || '',
      ]
    );

    conn.release();
    console.log(`✅  Details saved: ${cadetId}`);
    return res.status(200).json({ status: 'success', message: 'Cadet details saved successfully!' });

  } catch (err) {
    console.error('Details error:', err.message);
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  API — GET ALL CADETS  (dashboard table)
// ════════════════════════════════════════════════════════════
app.get('/api/cadets', async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT
         c.cadet_id, c.first_name, c.middle_name, c.last_name,
         c.phone_number, c.bn_code, c.created_at, c.last_login,

         d.mobile, d.unit_name, d.group_hq,
         d.dob, d.gender, d.blood_group, d.category, d.religion, d.nationality,
         d.address, d.father_name, d.emergency_phone,
         d.school_name, d.class_year, d.stream,
         d.wing, d.rank, d.enrollment_year, d.certificate, d.directorate,
         d.training_status, d.camp_attended, d.drill_proficiency,
         d.awards, d.sports, d.remarks,
         d.saved_at

       FROM cadets c
       LEFT JOIN cadet_details d ON c.cadet_id = d.cadet_id
       ORDER BY c.created_at DESC`
    );

    conn.release();
    return res.status(200).json({ status: 'success', total: rows.length, cadets: rows });

  } catch (err) {
    console.error('Get cadets error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  API — GET SINGLE CADET
// ════════════════════════════════════════════════════════════
app.get('/api/cadets/:cadetId', async (req, res) => {
  const cadetId = req.params.cadetId.trim();
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT c.*, d.*
       FROM cadets c
       LEFT JOIN cadet_details d ON c.cadet_id = d.cadet_id
       WHERE c.cadet_id = ?`,
      [cadetId]
    );
    conn.release();
    if (rows.length === 0)
      return res.status(404).json({ message: 'Cadet not found.' });
    return res.status(200).json({ status: 'success', cadet: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  API — EDIT CADET  (dashboard edit modal — all fields)
// ════════════════════════════════════════════════════════════
app.put('/api/cadets/:cadetId', async (req, res) => {
  const cadetId = req.params.cadetId.trim();
  const {
    firstName, middleName, lastName, phone, bnCode,
    // NCC basic
    wing, rank, enrollYear, mobile, dob, address,
    // New extended fields
    gender, bloodGroup, fatherName, emergencyPhone,
    schoolName, directorate, certificate, trainingStatus,
    awards, sports,
  } = req.body;

  if (!firstName || !lastName)
    return res.status(400).json({ message: 'First and Last name are required.' });
  if (!bnCode || bnCode.length < 3)
    return res.status(400).json({ message: 'BN Code must be at least 3 characters.' });
  if (phone && !/^[6-9]\d{9}$/.test(phone))
    return res.status(400).json({ message: 'Enter a valid 10-digit phone number.' });
  if (mobile && !/^[6-9]\d{9}$/.test(mobile))
    return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });

  try {
    const conn = await pool.getConnection();

    // Check exists
    const [exists] = await conn.execute(
      'SELECT cadet_id FROM cadets WHERE cadet_id = ?', [cadetId]
    );
    if (exists.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Cadet not found.' });
    }

    // Update cadets table (registration data)
    await conn.execute(
      `UPDATE cadets
         SET first_name=?, middle_name=?, last_name=?, phone_number=?, bn_code=?
       WHERE cadet_id=?`,
      [firstName.trim(), middleName || '', lastName.trim(), phone || null, bnCode.trim(), cadetId]
    );

    // Upsert cadet_details with all extended fields
    await conn.execute(
      `INSERT INTO cadet_details
         (cadet_id, bn_code, mobile, dob, gender, blood_group,
          address, father_name, emergency_phone,
          school_name, wing, \`rank\`, enrollment_year,
          certificate, directorate, training_status,
          awards, sports, saved_at)
       VALUES (?,?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?, ?,?,NOW())
       ON DUPLICATE KEY UPDATE
         bn_code=VALUES(bn_code), mobile=VALUES(mobile),
         dob=VALUES(dob), gender=VALUES(gender), blood_group=VALUES(blood_group),
         address=VALUES(address), father_name=VALUES(father_name),
         emergency_phone=VALUES(emergency_phone),
         school_name=VALUES(school_name), wing=VALUES(wing),
         \`rank\`=VALUES(\`rank\`), enrollment_year=VALUES(enrollment_year),
         certificate=VALUES(certificate), directorate=VALUES(directorate),
         training_status=VALUES(training_status),
         awards=VALUES(awards), sports=VALUES(sports), saved_at=NOW()`,
      [
        cadetId, bnCode.trim(), mobile || null,
        dob || null, gender || '', bloodGroup || '',
        address || null, fatherName || '', emergencyPhone || '',
        schoolName || '', wing || null, rank || null,
        enrollYear ? parseInt(enrollYear) : null,
        certificate || '', directorate || '', trainingStatus || '',
        awards || '', sports || '',
      ]
    );

    conn.release();
    console.log(`✏️  Updated: ${cadetId}`);
    return res.status(200).json({ status: 'success', message: 'Cadet updated successfully!' });

  } catch (err) {
    console.error('Update error:', err.message);
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  API — DELETE CADET
// ════════════════════════════════════════════════════════════
app.delete('/api/cadets/:cadetId', async (req, res) => {
  const cadetId = req.params.cadetId.trim();
  console.log(`🗑️  Delete request: "${cadetId}"`);

  try {
    const conn = await pool.getConnection();

    const [exists] = await conn.execute(
      'SELECT cadet_id FROM cadets WHERE cadet_id = ?', [cadetId]
    );
    if (exists.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Cadet not found: ' + cadetId });
    }

    // ON DELETE CASCADE handles cadet_details automatically
    // (if FK is set — also doing explicit delete for safety)
    await conn.execute('DELETE FROM cadet_details WHERE cadet_id = ?', [cadetId]);
    await conn.execute('DELETE FROM cadets WHERE cadet_id = ?', [cadetId]);

    conn.release();
    console.log(`✅  Deleted: ${cadetId}`);
    return res.status(200).json({ status: 'success', message: 'Cadet deleted successfully!' });

  } catch (err) {
    console.error('Delete error:', err.message);
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  API — ADMIN LOGIN
// ════════════════════════════════════════════════════════════
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'ncc@admin123';

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required.' });
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    console.log('✅  Admin logged in');
    return res.status(200).json({
      status : 'success',
      message: 'Admin login successful!',
      token  : 'admin_' + Date.now(),
    });
  }
  return res.status(401).json({ message: 'Invalid username or password.' });
});

// ════════════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('🚀  NCC Management System running!');
  console.log(`    Portal  →  http://localhost:${PORT}`);
  console.log(`    API     →  http://localhost:${PORT}/api/cadets`);
  console.log(`    Admin   →  username: ${ADMIN_USERNAME} | password: ${ADMIN_PASSWORD}`);
  console.log('');
});