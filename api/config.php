<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'code_library');

function get_db_connection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS);
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }
    
    // Create database if not exists
    $conn->query("CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $conn->select_db(DB_NAME);
    $conn->set_charset("utf8mb4");
    
    // Initialize tables if they don't exist
    init_db($conn);
    
    return $conn;
}

function init_db($conn = null) {
    if (!$conn) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS);
        $conn->select_db(DB_NAME);
    }
    
    // Users table
    $conn->query("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NULL,
        avatar_url VARCHAR(500) NULL,
        bio TEXT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    ensure_column($conn, 'users', 'display_name', "ALTER TABLE users ADD COLUMN display_name VARCHAR(100) NULL AFTER username");
    ensure_column($conn, 'users', 'avatar_url', "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER display_name");
    ensure_column($conn, 'users', 'bio', "ALTER TABLE users ADD COLUMN bio TEXT NULL AFTER avatar_url");
    
    // Snippets table
    $conn->query("CREATE TABLE IF NOT EXISTS snippets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        language VARCHAR(50),
        description TEXT,
        code TEXT,
        visibility ENUM('public', 'private') DEFAULT 'private',
        forked_from_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (forked_from_id) REFERENCES snippets(id) ON DELETE SET NULL
    )");
    ensure_column($conn, 'snippets', 'forked_from_id', "ALTER TABLE snippets ADD COLUMN forked_from_id INT NULL AFTER visibility");
    
    // History table
    $conn->query("CREATE TABLE IF NOT EXISTS snippet_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        snippet_id INT NOT NULL,
        code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
    )");
    
    // Tags table (Simple approach: JSON or comma separated in snippets table for now to match current JS logic, 
    // but let's do it properly with a relation table)
    $conn->query("CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
    )");
    
    $conn->query("CREATE TABLE IF NOT EXISTS snippet_tags (
        snippet_id INT NOT NULL,
        tag_id INT NOT NULL,
        PRIMARY KEY (snippet_id, tag_id),
        FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )");

    $conn->query("CREATE TABLE IF NOT EXISTS snippet_stars (
        user_id INT NOT NULL,
        snippet_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, snippet_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
    )");

    $conn->query("CREATE TABLE IF NOT EXISTS snippet_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        snippet_id INT NOT NULL,
        user_id INT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    
    return $conn;
}

function ensure_column($conn, $table, $column, $alter_sql) {
    $table = $conn->real_escape_string($table);
    $column = $conn->real_escape_string($column);
    $result = $conn->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
    if ($result && $result->num_rows === 0) {
        $conn->query($alter_sql);
    }
}
?>
