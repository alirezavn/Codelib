<?php
require_once 'config.php';

header('Content-Type: application/json');

try {
    init_db();
    echo json_encode(['status' => 'success', 'message' => 'Database and tables initialized successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
