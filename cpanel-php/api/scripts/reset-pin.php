<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../config.php';

$pin = $argv[1] ?? '';
if (!preg_match('/^[0-9]{6}$/', $pin)) {
    fwrite(STDERR, "Usage: php reset-pin.php <6-digit PIN>\n");
    exit(2);
}

$mysqli = dbConnect();
$stmt = null;
$exitCode = 0;
try {
    $mysqli->begin_transaction();
    $stmt = $mysqli->prepare(
        "INSERT INTO app_config (`key`, `value`) VALUES ('pin_hash', ?), ('auth_token', ?) "
        . "ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)"
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare PIN reset.');
    }

    $pinHash = password_hash($pin, PASSWORD_BCRYPT);
    $emptyToken = '';
    $stmt->bind_param('ss', $pinHash, $emptyToken);
    if (!$stmt->execute()) {
        throw new RuntimeException('Failed to update PIN configuration.');
    }

    $stmt->close();
    $stmt = null;
    $mysqli->commit();
    fwrite(STDOUT, "PIN reset successfully. Booking records were not changed.\n");
} catch (Throwable $error) {
    $mysqli->rollback();
    fwrite(STDERR, "PIN reset failed: {$error->getMessage()}\n");
    $exitCode = 1;
} finally {
    if ($stmt) {
        $stmt->close();
    }
    $mysqli->close();
}

exit($exitCode);
