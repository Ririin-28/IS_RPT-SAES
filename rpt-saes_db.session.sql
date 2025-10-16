
-- Modify parent table
ALTER TABLE parent 
ADD COLUMN contact_no VARCHAR(20),
ADD COLUMN email VARCHAR(100),
ADD COLUMN address TEXT,
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create new tables

-- Remedial Info table
CREATE TABLE remedial_info (
    remedial_id INT AUTO_INCREMENT PRIMARY KEY,
    remedial_subject VARCHAR(50),
    student_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student(student_id)
);

-- IT Admin table
CREATE TABLE it_admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    name VARCHAR(100),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Weekly Schedule table
CREATE TABLE weekly_schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    subject VARCHAR(50),
    day ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Schedule table
CREATE TABLE activity_schedule (
    activity_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    subject VARCHAR(50),
    teacher VARCHAR(100),
    date DATE,
    day VARCHAR(20),
    room VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Attendance table
CREATE TABLE students_attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    subject VARCHAR(50),
    date DATE,
    status ENUM('present', 'absent'),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student(student_id)
);

-- English Progress table
CREATE TABLE english_progress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    grade VARCHAR(10),
    section VARCHAR(10),
    start_level VARCHAR(50),
    september VARCHAR(50),
    october VARCHAR(50),
    december VARCHAR(50),
    february VARCHAR(50),
    march VARCHAR(50),
    end_level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student(student_id)
);

-- Filipino Progress table
CREATE TABLE filipino_progress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    grade VARCHAR(10),
    section VARCHAR(10),
    start_level VARCHAR(50),
    september VARCHAR(50),
    october VARCHAR(50),
    december VARCHAR(50),
    february VARCHAR(50),
    march VARCHAR(50),
    end_level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student(student_id)
);

-- Math Progress table
CREATE TABLE math_progress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    grade VARCHAR(10),
    section VARCHAR(10),
    start_level VARCHAR(50),
    september VARCHAR(50),
    october VARCHAR(50),
    december VARCHAR(50),
    february VARCHAR(50),
    march VARCHAR(50),
    end_level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student(student_id)
);

-- Reports List table
CREATE TABLE reports_list (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    role VARCHAR(20),
    title VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actions VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- English Materials List table
CREATE TABLE english_materials_list (
    material_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    subject VARCHAR(50),
    grade VARCHAR(10),
    english_level VARCHAR(50),
    teacher VARCHAR(100),
    status ENUM('accepted', 'pending', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Filipino Materials List table
CREATE TABLE filipino_materials_list (
    material_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    subject VARCHAR(50),
    grade VARCHAR(10),
    filipino_level VARCHAR(50),
    teacher VARCHAR(100),
    status ENUM('accepted', 'pending', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Math Materials List table
CREATE TABLE math_materials_list (
    material_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    subject VARCHAR(50),
    grade VARCHAR(10),
    math_level VARCHAR(50),
    teacher VARCHAR(100),
    status ENUM('accepted', 'pending', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending Materials table
CREATE TABLE pending_materials (
    pending_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    subject VARCHAR(50),
    grade VARCHAR(10),
    level VARCHAR(50),
    teacher VARCHAR(100),
    status ENUM('pending') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rejected Materials table
CREATE TABLE rejected_materials (
    reject_id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT,
    title VARCHAR(100),
    subject VARCHAR(50),
    grade VARCHAR(10),
    level VARCHAR(50),
    teacher VARCHAR(100),
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Archive Materials table
CREATE TABLE archive_materials (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT,
    title VARCHAR(100),
    subject VARCHAR(50),
    grade VARCHAR(10),
    teacher VARCHAR(100),
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Archive Users table
CREATE TABLE archive_users (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    name VARCHAR(100),
    role VARCHAR(20),
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account Logs table
CREATE TABLE account_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    role VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Update foreign key relationships after creating new tables
-- Add foreign key for student.remedial_id
ALTER TABLE student 
ADD FOREIGN KEY (remedial_id) REFERENCES remedial_info(remedial_id);

-- Add foreign key for student.parent_id  
ALTER TABLE student 
ADD FOREIGN KEY (parent_id) REFERENCES parent(parent_id);

-- Create indexes for better performance
CREATE INDEX idx_student_grade_section ON student(grade, section);
CREATE INDEX idx_attendance_student_date ON students_attendance(student_id, date);
CREATE INDEX idx_progress_student_subject ON english_progress(student_id);
CREATE INDEX idx_progress_student_subject ON filipino_progress(student_id);
CREATE INDEX idx_progress_student_subject ON math_progress(student_id);
CREATE INDEX idx_materials_status ON english_materials_list(status);
CREATE INDEX idx_materials_status ON filipino_materials_list(status);
CREATE INDEX idx_materials_status ON math_materials_list(status);

