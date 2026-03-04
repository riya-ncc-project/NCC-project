const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// DATABASE CONNECTION (PASSWORD DHAYAN SE CHECK KAREIN)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123', // <--- BADLEIN ISE
    database: 'ncc_system'
});

db.connect(err => {
    if (err) {
        console.log("Database connection failed! Galti ye hai: " + err.message);
    } else {
        console.log("MySQL Connected successfully!");
    }
});

// Route: Register Cadet (Saara data save karne ke liye)
app.post('/register', (req, res) => {
    const { fullName, enrollmentNumber, collegeName, year, gender, wing, certLevel, phone, email } = req.body;
    
    const sql = `INSERT INTO cadets 
        (full_name, enrollment_no, college_name, year, gender, wing, cert_level, phone, email) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [fullName, enrollmentNumber, collegeName, year, gender, wing, certLevel, phone, email];

    db.query(sql, values, (err, result) => {
        if (err) return res.status(500).send("Database error: " + err.sqlMessage);
        res.send("Salute! Registration Successful.");
    });
});

// Route: Dashboard ke liye data fetch karna
app.get('/cadets', (req, res) => {
    db.query("SELECT * FROM cadets ORDER BY reg_date DESC", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// Cadet ko database se delete karne ki API
app.delete('/delete-cadet/:id', (req, res) => {
    const cadetId = req.params.id;
    const sql = "DELETE FROM cadets WHERE id = ?";

    db.query(sql, [cadetId], (err, result) => {
        if (err) {
            console.log("Delete Error:", err);
            return res.status(500).send("Database error occurred while deleting.");
        }
        res.send("Cadet record deleted successfully!");
    });
});

// Status update karne ki API
app.put('/update-status/:id', (req, res) => {
    const cadetId = req.params.id;
    const newStatus = req.body.status;
    const sql = "UPDATE cadets SET status = ? WHERE id = ?";

    db.query(sql, [newStatus, cadetId], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(`Status updated to ${newStatus}`);
    });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));
// Cadet ko delete karne ki route
app.delete('/delete-cadet/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM cadets WHERE id = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).send("Delete Error: " + err.message);
        res.send("Cadet deleted successfully.");
    });
});