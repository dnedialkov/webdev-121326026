-- Database schema for Club Events (Slice 1)

DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date TIMESTAMP NOT NULL,
    capacity INTEGER NOT NULL,
    organizer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_event UNIQUE (user_id, event_id)
);

-- Seed initial data
-- Password hash for 'password123' using bcrypt (cost 10)
-- $2b$10$X7x8... (we will use a valid pre-generated hash or let seed script handle it, or use a known bcrypt hash for 'password123')
-- Hash for 'password123': $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
INSERT INTO users (email, password_hash, role) VALUES 
('organizer@club.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'organizer'),
('member@club.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'member');

INSERT INTO events (title, description, date, capacity, organizer_id) VALUES
('Coding Workshop 101', 'Introduction to web development fundamentals.', CURRENT_TIMESTAMP + INTERVAL '3 days', 20, 1),
('AI Meetup', 'Discussing Gemini and LLMs in modern applications.', CURRENT_TIMESTAMP + INTERVAL '7 days', 15, 1),
('Web Security Talk', 'Best practices for securing web applications.', CURRENT_TIMESTAMP + INTERVAL '14 days', 10, 1);
