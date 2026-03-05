import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("events.db");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-123";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    institution TEXT,
    photo TEXT,
    points INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT,
    description TEXT,
    logo TEXT,
    cover_image TEXT
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    capacity INTEGER,
    latitude REAL,
    longitude REAL,
    qr_code TEXT
  );

  CREATE TABLE IF NOT EXISTS speakers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    photo TEXT,
    bio TEXT,
    social_links TEXT,
    topic TEXT
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    room_id INTEGER,
    speaker_id INTEGER,
    theme TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(room_id) REFERENCES rooms(id),
    FOREIGN KEY(speaker_id) REFERENCES speakers(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    activity_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(activity_id) REFERENCES activities(id)
  );
`);

// Seed initial admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run(
    "Admin Principal",
    "admin@fabrica.com",
    hashedPassword,
    "admin"
  );
}

// Seed initial data if empty
const roomCount = db.prepare("SELECT COUNT(*) as count FROM rooms").get() as any;
if (roomCount.count === 0) {
  db.prepare("INSERT INTO rooms (name, capacity, latitude, longitude, qr_code) VALUES (?, ?, ?, ?, ?)").run(
    "Sala Magna", 500, -0.1807, -78.4678, "ROOM_MAGNA"
  );
  db.prepare("INSERT INTO rooms (name, capacity, latitude, longitude, qr_code) VALUES (?, ?, ?, ?, ?)").run(
    "Laboratorio IA", 50, -0.1810, -78.4680, "ROOM_LAB_IA"
  );
}

const speakerCount = db.prepare("SELECT COUNT(*) as count FROM speakers").get() as any;
if (speakerCount.count === 0) {
  db.prepare("INSERT INTO speakers (name, bio, topic) VALUES (?, ?, ?)").run(
    "Dr. Alan Turing", "Padre de la computación moderna.", "IA y el Futuro"
  );
  db.prepare("INSERT INTO speakers (name, bio, topic) VALUES (?, ?, ?)").run(
    "Ada Lovelace", "Primera programadora de la historia.", "Algoritmos Creativos"
  );
}

const activityCount = db.prepare("SELECT COUNT(*) as count FROM activities").get() as any;
if (activityCount.count === 0) {
  db.prepare("INSERT INTO activities (name, start_time, end_time, room_id, speaker_id, theme, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "Conferencia Magistral: IA", "09:00", "10:30", 1, 1, "Tecnología", "Explorando los límites de la inteligencia artificial.", "pending"
  );
  db.prepare("INSERT INTO activities (name, start_time, end_time, room_id, speaker_id, theme, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "Taller de Algoritmos", "11:00", "12:30", 2, 2, "Programación", "Práctica intensiva de algoritmos.", "in_progress"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // API Routes
  app.post("/api/auth/register", (req, res) => {
    const { name, email, password, institution } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare("INSERT INTO users (name, email, password, institution) VALUES (?, ?, ?, ?)").run(
        name, email, hashedPassword, institution
      );
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
  });

  // Events
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events").all();
    res.json(events);
  });

  // Rooms
  app.get("/api/rooms", (req, res) => {
    const rooms = db.prepare("SELECT * FROM rooms").all();
    res.json(rooms);
  });

  app.post("/api/rooms", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, capacity, latitude, longitude } = req.body;
    const qr_code = `ROOM_${Date.now()}`;
    const result = db.prepare("INSERT INTO rooms (name, capacity, latitude, longitude, qr_code) VALUES (?, ?, ?, ?, ?)").run(
      name, capacity, latitude, longitude, qr_code
    );
    res.json({ id: result.lastInsertRowid, qr_code });
  });

  // Activities
  app.get("/api/activities", (req, res) => {
    const activities = db.prepare(`
      SELECT a.*, r.name as room_name, s.name as speaker_name 
      FROM activities a
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN speakers s ON a.speaker_id = s.id
    `).all();
    res.json(activities);
  });

  app.post("/api/activities", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, start_time, end_time, room_id, speaker_id, theme, description } = req.body;
    const result = db.prepare("INSERT INTO activities (name, start_time, end_time, room_id, speaker_id, theme, description) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      name, start_time, end_time, room_id, speaker_id, theme, description
    );
    res.json({ id: result.lastInsertRowid });
  });

  // Speakers
  app.get("/api/speakers", (req, res) => {
    const speakers = db.prepare("SELECT * FROM speakers").all();
    res.json(speakers);
  });

  app.post("/api/speakers", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, bio, topic, social_links } = req.body;
    const result = db.prepare("INSERT INTO speakers (name, bio, topic, social_links) VALUES (?, ?, ?, ?)").run(
      name, bio, topic, social_links
    );
    res.json({ id: result.lastInsertRowid });
  });

  // Attendance
  app.post("/api/attendance", authenticateToken, (req: any, res) => {
    const { activity_id } = req.body;
    const user_id = req.user.id;
    
    // Check if already registered
    const exists = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND activity_id = ?").get(user_id, activity_id);
    if (exists) return res.status(400).json({ error: "Ya has registrado asistencia a esta actividad" });

    db.prepare("INSERT INTO attendance (user_id, activity_id) VALUES (?, ?)").run(user_id, activity_id);
    db.prepare("UPDATE users SET points = points + 10 WHERE id = ?").run(user_id);
    
    res.json({ success: true, points_earned: 10 });
  });

  app.get("/api/user/attendance", authenticateToken, (req: any, res) => {
    const attendance = db.prepare(`
      SELECT a.*, act.name as activity_name, act.start_time, r.name as room_name
      FROM attendance a
      JOIN activities act ON a.activity_id = act.id
      JOIN rooms r ON act.room_id = r.id
      WHERE a.user_id = ?
    `).all(req.user.id);
    res.json(attendance);
  });

  // Stats for Dashboard
  app.get("/api/stats", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get();
    const totalAttendance = db.prepare("SELECT COUNT(*) as count FROM attendance").get();
    const popularActivities = db.prepare(`
      SELECT act.name, COUNT(a.id) as count
      FROM activities act
      LEFT JOIN attendance a ON act.id = a.activity_id
      GROUP BY act.id
      ORDER BY count DESC
      LIMIT 5
    `).all();
    res.json({ totalUsers, totalAttendance, popularActivities });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
