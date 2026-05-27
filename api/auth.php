<?php
require_once 'config.php';

header('Content-Type: application/json');
session_start();

$conn = get_db_connection();
$action = $_GET['action'] ?? '';

if ($action === 'signup') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $conn->real_escape_string($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        echo json_encode(['status' => 'error', 'message' => 'Username and password are required']);
        exit;
    }

    $check = $conn->query("SELECT id FROM users WHERE username = '$username'");
    if ($check->num_rows > 0) {
        echo json_encode(['status' => 'error', 'message' => 'Username already exists']);
        exit;
    }

    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (username, display_name, password) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $username, $username, $hashed_password);

    if ($stmt->execute()) {
        $user_id = $conn->insert_id;
        $_SESSION['user_id'] = $user_id;
        $_SESSION['username'] = $username;
        echo json_encode(['status' => 'success', 'user' => [
            'id' => $user_id,
            'username' => $username,
            'display_name' => $username,
            'avatar_url' => '',
            'bio' => ''
        ]]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Signup failed']);
    }
} elseif ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $conn->real_escape_string($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        echo json_encode(['status' => 'error', 'message' => 'Username and password are required']);
        exit;
    }

    $result = $conn->query("SELECT * FROM users WHERE username = '$username'");
    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();
        if (password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            echo json_encode(['status' => 'success', 'user' => format_user($user)]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid password']);
        }
    } else {
        echo json_encode(['status' => 'error', 'message' => 'User not found']);
    }
} elseif ($action === 'logout') {
    session_destroy();
    echo json_encode(['status' => 'success']);
} elseif ($action === 'check') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode(['status' => 'success', 'user' => current_user($conn)]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Not logged in']);
    }
} elseif ($action === 'profile') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(['status' => 'success', 'user' => current_user($conn)]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $display_name = trim($data['display_name'] ?? '');
        $avatar_url = trim($data['avatar_url'] ?? '');
        $bio = trim($data['bio'] ?? '');

        if ($display_name === '') {
            $display_name = $_SESSION['username'];
        }

        $stmt = $conn->prepare("UPDATE users SET display_name = ?, avatar_url = ?, bio = ? WHERE id = ?");
        $stmt->bind_param("sssi", $display_name, $avatar_url, $bio, $_SESSION['user_id']);
        $stmt->execute();
        echo json_encode(['status' => 'success', 'user' => current_user($conn)]);
        exit;
    }
}

function current_user($conn) {
    $stmt = $conn->prepare("SELECT id, username, display_name, avatar_url, bio FROM users WHERE id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    return format_user($stmt->get_result()->fetch_assoc());
}

function format_user($user) {
    return [
        'id' => $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'] ?: $user['username'],
        'avatar_url' => $user['avatar_url'] ?: '',
        'bio' => $user['bio'] ?: ''
    ];
}
?>
