CREATE OR REPLACE VIEW view_coordinator_subjects AS
SELECT 
    u.user_id,
    CONCAT(u.first_name, ' ', u.middle_name, ' ', u.last_name) AS full_name,
    u.phone_number,
    cs.role,
    cs.english,
    cs.filipino,
    cs.math
FROM users u
JOIN coordinator_subject cs ON u.user_id = cs.user_id
WHERE u.role = 'master_teacher';
