<?php
require_once 'config.php';

header('Content-Type: application/json');
session_start();

$conn = get_db_connection();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

$user_id = $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $type = $_GET['type'] ?? 'user'; // 'user' or 'public'
    $sort = $_GET['sort'] ?? 'recent';
    $comments_for = $_GET['comments_for'] ?? null;

    if ($comments_for) {
        $stmt = $conn->prepare("SELECT c.id, c.body, c.created_at, u.username as author
            FROM snippet_comments c
            JOIN users u ON c.user_id = u.id
            JOIN snippets s ON c.snippet_id = s.id
            WHERE c.snippet_id = ? AND s.visibility = 'public'
            ORDER BY c.created_at ASC");
        $stmt->bind_param("i", $comments_for);
        $stmt->execute();
        echo json_encode(['status' => 'success', 'comments' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
        exit;
    }
    
    if ($id) {
        $stmt = $conn->prepare("SELECT s.*, parent.title as forked_from_title, parent_user.username as forked_from_author
            FROM snippets s
            LEFT JOIN snippets parent ON s.forked_from_id = parent.id
            LEFT JOIN users parent_user ON parent.user_id = parent_user.id
            WHERE s.id = ? AND (s.user_id = ? OR s.visibility = 'public')");
        $stmt->bind_param("ii", $id, $user_id);
        $stmt->execute();
        $snippet = $stmt->get_result()->fetch_assoc();
        
        if ($snippet) {
            // Get history
            $h_stmt = $conn->prepare("SELECT code, created_at as time FROM snippet_history WHERE snippet_id = ? ORDER BY created_at ASC");
            $h_stmt->bind_param("i", $id);
            $h_stmt->execute();
            $snippet['history'] = $h_stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            
            // Get tags
            $t_stmt = $conn->prepare("SELECT t.name FROM tags t JOIN snippet_tags st ON t.id = st.tag_id WHERE st.snippet_id = ?");
            $t_stmt->bind_param("i", $id);
            $t_stmt->execute();
            $tags_result = $t_stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $snippet['tags'] = array_column($tags_result, 'name');
            $snippet = add_snippet_meta($conn, $snippet, $user_id);
            
            echo json_encode(['status' => 'success', 'snippet' => $snippet]);
        } else {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Snippet not found']);
        }
    } else {
        if ($type === 'public') {
            if ($sort === 'stars') {
                $order_by = 'star_count DESC, s.created_at DESC';
            } elseif ($sort === 'forks') {
                $order_by = 'fork_count DESC, s.created_at DESC';
            } else {
                $order_by = 's.created_at DESC';
            }
            $result = $conn->query("SELECT s.*, u.username as author,
                parent.title as forked_from_title,
                parent_user.username as forked_from_author,
                (SELECT COUNT(*) FROM snippet_stars ss WHERE ss.snippet_id = s.id) as star_count,
                (SELECT COUNT(*) FROM snippets f WHERE f.forked_from_id = s.id) as fork_count,
                EXISTS(SELECT 1 FROM snippet_stars us WHERE us.snippet_id = s.id AND us.user_id = $user_id) as starred_by_me
                FROM snippets s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN snippets parent ON s.forked_from_id = parent.id
                LEFT JOIN users parent_user ON parent.user_id = parent_user.id
                WHERE s.visibility = 'public'
                ORDER BY $order_by");
        } else {
            $result = $conn->query("SELECT s.*,
                parent.title as forked_from_title,
                parent_user.username as forked_from_author,
                (SELECT COUNT(*) FROM snippet_stars ss WHERE ss.snippet_id = s.id) as star_count,
                (SELECT COUNT(*) FROM snippets f WHERE f.forked_from_id = s.id) as fork_count
                FROM snippets s
                LEFT JOIN snippets parent ON s.forked_from_id = parent.id
                LEFT JOIN users parent_user ON parent.user_id = parent_user.id
                WHERE s.user_id = $user_id
                ORDER BY s.created_at DESC");
        }
        
        $snippets = [];
        while ($row = $result->fetch_assoc()) {
            // Get tags for each snippet
            $t_stmt = $conn->prepare("SELECT t.name FROM tags t JOIN snippet_tags st ON t.id = st.tag_id WHERE st.snippet_id = ?");
            $t_stmt->bind_param("i", $row['id']);
            $t_stmt->execute();
            $tags_result = $t_stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $row['tags'] = array_column($tags_result, 'name');
            
            // Get history count
            $h_count = $conn->query("SELECT COUNT(*) as count FROM snippet_history WHERE snippet_id = " . $row['id'])->fetch_assoc();
            $row['history_count'] = $h_count['count'];
            if (!isset($row['star_count'])) {
                $row = add_snippet_meta($conn, $row, $user_id);
            }
            
            $snippets[] = $row;
        }
        echo json_encode(['status' => 'success', 'snippets' => $snippets]);
    }
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if ($action === 'star') {
        $snippet_id = (int)($data['snippet_id'] ?? 0);
        $stmt = $conn->prepare("SELECT id FROM snippets WHERE id = ? AND visibility = 'public'");
        $stmt->bind_param("i", $snippet_id);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Snippet not found']);
            exit;
        }

        $check = $conn->prepare("SELECT 1 FROM snippet_stars WHERE user_id = ? AND snippet_id = ?");
        $check->bind_param("ii", $user_id, $snippet_id);
        $check->execute();
        if ($check->get_result()->fetch_assoc()) {
            $stmt = $conn->prepare("DELETE FROM snippet_stars WHERE user_id = ? AND snippet_id = ?");
            $stmt->bind_param("ii", $user_id, $snippet_id);
            $stmt->execute();
            $starred = false;
        } else {
            $stmt = $conn->prepare("INSERT INTO snippet_stars (user_id, snippet_id) VALUES (?, ?)");
            $stmt->bind_param("ii", $user_id, $snippet_id);
            $stmt->execute();
            $starred = true;
        }
        $count = $conn->query("SELECT COUNT(*) as count FROM snippet_stars WHERE snippet_id = $snippet_id")->fetch_assoc()['count'];
        echo json_encode(['status' => 'success', 'starred' => $starred, 'star_count' => (int)$count]);
        exit;
    }

    if ($action === 'comment') {
        $snippet_id = (int)($data['snippet_id'] ?? 0);
        $body = trim($data['body'] ?? '');
        if ($body === '') {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Comment body required']);
            exit;
        }
        $stmt = $conn->prepare("INSERT INTO snippet_comments (snippet_id, user_id, body)
            SELECT ?, ?, ?
            FROM snippets
            WHERE id = ? AND visibility = 'public'");
        $stmt->bind_param("iisi", $snippet_id, $user_id, $body, $snippet_id);
        $stmt->execute();
        if ($stmt->affected_rows === 0) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Snippet not found']);
            exit;
        }
        echo json_encode(['status' => 'success']);
        exit;
    }

    if ($action === 'fork') {
        $snippet_id = (int)($data['snippet_id'] ?? 0);
        $stmt = $conn->prepare("SELECT * FROM snippets WHERE id = ? AND visibility = 'public'");
        $stmt->bind_param("i", $snippet_id);
        $stmt->execute();
        $source = $stmt->get_result()->fetch_assoc();
        if (!$source) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Snippet not found']);
            exit;
        }

        $title = $source['title'];
        $stmt = $conn->prepare("INSERT INTO snippets (user_id, title, language, description, code, visibility, forked_from_id)
            VALUES (?, ?, ?, ?, ?, 'private', ?)");
        $stmt->bind_param("issssi", $user_id, $title, $source['language'], $source['description'], $source['code'], $snippet_id);
        $stmt->execute();
        $new_id = $conn->insert_id;

        $history = $conn->prepare("INSERT INTO snippet_history (snippet_id, code) VALUES (?, ?)");
        $history->bind_param("is", $new_id, $source['code']);
        $history->execute();

        $conn->query("INSERT INTO snippet_tags (snippet_id, tag_id)
            SELECT $new_id, tag_id FROM snippet_tags WHERE snippet_id = $snippet_id");

        echo json_encode(['status' => 'success', 'id' => $new_id]);
        exit;
    }
    $id = $data['id'] ?? null;
    $title = $data['title'] ?? 'Untitled';
    $language = $data['language'] ?? 'Plain Text';
    $description = $data['desc'] ?? '';
    $code = $data['code'] ?? '';
    $visibility = $data['visibility'] ?? 'private';
    $tags = $data['tags'] ?? [];
    
    if ($id) {
        // Update
        $stmt = $conn->prepare("UPDATE snippets SET title=?, language=?, description=?, code=?, visibility=? WHERE id=? AND user_id=?");
        $stmt->bind_param("sssssii", $title, $language, $description, $code, $visibility, $id, $user_id);
        $stmt->execute();
        
        // Add to history if code changed
        $check = $conn->query("SELECT code FROM snippet_history WHERE snippet_id = $id ORDER BY created_at DESC LIMIT 1")->fetch_assoc();
        if (!$check || $check['code'] !== $code) {
            $h_stmt = $conn->prepare("INSERT INTO snippet_history (snippet_id, code) VALUES (?, ?)");
            $h_stmt->bind_param("is", $id, $code);
            $h_stmt->execute();
        }
        
        $snippet_id = $id;
    } else {
        // Create
        $stmt = $conn->prepare("INSERT INTO snippets (user_id, title, language, description, code, visibility) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("isssss", $user_id, $title, $language, $description, $code, $visibility);
        $stmt->execute();
        $snippet_id = $conn->insert_id;
        
        // Initial history
        $h_stmt = $conn->prepare("INSERT INTO snippet_history (snippet_id, code) VALUES (?, ?)");
        $h_stmt->bind_param("is", $snippet_id, $code);
        $h_stmt->execute();
    }
    
    // Update Tags
    $conn->query("DELETE FROM snippet_tags WHERE snippet_id = $snippet_id");
    foreach ($tags as $tag_name) {
        $tag_name = trim($tag_name);
        if (empty($tag_name)) continue;
        
        $conn->query("INSERT IGNORE INTO tags (name) VALUES ('$tag_name')");
        $tag_id = $conn->query("SELECT id FROM tags WHERE name = '$tag_name'")->fetch_assoc()['id'];
        $conn->query("INSERT IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES ($snippet_id, $tag_id)");
    }
    
    echo json_encode(['status' => 'success', 'id' => $snippet_id]);
} elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $conn->prepare("DELETE FROM snippets WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $id, $user_id);
        $stmt->execute();
        echo json_encode(['status' => 'success']);
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'ID required']);
    }
}

function add_snippet_meta($conn, $snippet, $user_id) {
    $id = (int)$snippet['id'];
    $snippet['star_count'] = (int)$conn->query("SELECT COUNT(*) as count FROM snippet_stars WHERE snippet_id = $id")->fetch_assoc()['count'];
    $snippet['fork_count'] = (int)$conn->query("SELECT COUNT(*) as count FROM snippets WHERE forked_from_id = $id")->fetch_assoc()['count'];
    $snippet['starred_by_me'] = (bool)$conn->query("SELECT 1 FROM snippet_stars WHERE snippet_id = $id AND user_id = $user_id LIMIT 1")->fetch_assoc();
    return $snippet;
}
?>
