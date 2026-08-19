<?php

define('APP_NAME', 'Homestay Booking App');
define('APP_SECRET', 'replace-this-with-a-long-random-secret');

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');

error_reporting(E_ALL);
ini_set('display_errors', '0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function dbConnect() {
    $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($mysqli->connect_errno) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed.']);
        exit;
    }
    $mysqli->set_charset('utf8mb4');
    return $mysqli;
}

function ensureSchema() {
    $mysqli = dbConnect();
    $sql = file_get_contents(__DIR__ . '/../db/schema.sql');
    if ($sql === false) {
        $mysqli->close();
        return;
    }
    if (!$mysqli->multi_query($sql)) {
        $mysqli->close();
        return;
    }
    while ($mysqli->more_results()) {
        $mysqli->next_result();
    }
    $mysqli->close();
}

function jsonResponse($payload, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function parseJsonBody() {
    $raw = file_get_contents('php://input');
    if ($raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function readConfigValue($key, $default = null) {
    $mysqli = dbConnect();
    $stmt = $mysqli->prepare('SELECT value FROM app_config WHERE `key` = ? LIMIT 1');
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    $mysqli->close();

    return $row ? $row['value'] : $default;
}

function writeConfigValue($key, $value) {
    $mysqli = dbConnect();
    $stmt = $mysqli->prepare('INSERT INTO app_config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)');
    $stmt->bind_param('ss', $key, $value);
    $stmt->execute();
    $stmt->close();
    $mysqli->close();
}

function getBearerToken() {
    if (!isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return null;
    }
    $header = $_SERVER['HTTP_AUTHORIZATION'];
    if (stripos($header, 'Bearer ') !== 0) {
        return null;
    }
    return trim(substr($header, 7));
}

function generateTokenForPin($pin) {
    return hash_hmac('sha256', $pin . ':' . APP_SECRET, APP_SECRET);
}

function requireAuth() {
    $token = getBearerToken();
    if (!$token) {
        jsonResponse(['error' => 'Authorization header missing'], 401);
    }

    $stored = readConfigValue('auth_token', '');
    if ($stored !== '' && hash_equals($stored, $token)) {
        return true;
    }

    $pinHash = readConfigValue('pin_hash', '');
    if ($pinHash !== '') {
        $parts = explode(':', $token);
        if (count($parts) === 2 && $parts[0] === 'app' && $parts[1] !== '') {
            $expected = generateTokenForPin($parts[1]);
            if (hash_equals($expected, $token)) {
                return true;
            }
        }
    }

    jsonResponse(['error' => 'Invalid or expired token'], 403);
}

function normalizeBooking($row) {
    return [
        'bookingId' => $row['booking_id'],
        'guestName' => $row['guest_name'],
        'mobileNumber' => $row['mobile_number'],
        'bookingDate' => $row['booking_date'],
        'typeOfBooking' => $row['type_of_booking'],
        'perAdultTariff' => (float) $row['per_adult_tariff'],
        'perChildTariff' => (float) $row['per_child_tariff'],
        'numberAdults' => (int) $row['number_adults'],
        'numberChildren5Plus' => (int) $row['number_children_5_plus'],
        'numberChildrenUnder5' => (int) $row['number_children_under_5'],
        'checkInDate' => $row['check_in_date'],
        'checkOutDate' => $row['check_out_date'],
        'advanceAmount' => (float) $row['advance_amount'],
        'roomSelection' => $row['room_selection'],
        'foodPreference' => $row['food_preference'],
        'dietaryRestrictions' => $row['dietary_restrictions'],
        'specialRequest' => $row['special_request'],
        'communicationTransport' => $row['communication_transport'],
        'b2bAgencyName' => $row['b2b_agency_name'],
        'settlement' => $row['settlement'],
        'paymentStatus' => $row['payment_status'],
        'mutedReminders' => (bool) $row['muted_reminders'],
        'createdAt' => $row['created_at'],
        'totalNights' => (int) $row['total_nights'],
        'totalPax' => (int) $row['total_pax'],
        'totalAdultTariff' => (float) $row['total_adult_tariff'],
        'totalChildTariff' => (float) $row['total_child_tariff'],
        'finalTariff' => (float) $row['final_tariff'],
        'pendingAmount' => (float) $row['pending_amount'],
        'foodingTotal' => (float) $row['fooding_total'],
        'lodgingTotal' => (float) $row['lodging_total'],
    ];
}

function computeBookingFields(array $data): array {
    $checkIn = $data['checkInDate'] ?? $data['check_in_date'] ?? null;
    $checkOut = $data['checkOutDate'] ?? $data['check_out_date'] ?? null;
    $adults = (int) ($data['numberAdults'] ?? $data['number_adults'] ?? 0);
    $children5Plus = (int) ($data['numberChildren5Plus'] ?? $data['number_children_5_plus'] ?? 0);
    $childrenUnder5 = (int) ($data['numberChildrenUnder5'] ?? $data['number_children_under_5'] ?? 0);
    $perAdult = (float) ($data['perAdultTariff'] ?? $data['per_adult_tariff'] ?? 0);
    $perChild = (float) ($data['perChildTariff'] ?? $data['per_child_tariff'] ?? 0);
    $advance = (float) ($data['advanceAmount'] ?? $data['advance_amount'] ?? 0);

    $totalNights = 0;
    if ($checkIn && $checkOut) {
        $start = new DateTimeImmutable($checkIn);
        $end = new DateTimeImmutable($checkOut);
        $totalNights = max(0, intval($end->diff($start)->format('%a')));
    }

    $totalPax = $adults + $children5Plus + $childrenUnder5;
    $totalAdultTariff = $adults * $perAdult;
    $totalChildTariff = $children5Plus * $perChild;
    $finalTariff = $totalAdultTariff + $totalChildTariff;
    $pendingAmount = max(0, $finalTariff - $advance);
    $foodingTotal = $totalAdultTariff * 0.45;
    $lodgingTotal = $finalTariff - $foodingTotal;

    return [
        'totalNights' => $totalNights,
        'totalPax' => $totalPax,
        'totalAdultTariff' => $totalAdultTariff,
        'totalChildTariff' => $totalChildTariff,
        'finalTariff' => $finalTariff,
        'pendingAmount' => $pendingAmount,
        'foodingTotal' => $foodingTotal,
        'lodgingTotal' => $lodgingTotal,
    ];
}

function generateBookingId($roomSelection = 'KGH') {
    $prefix = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $roomSelection), 0, 3));
    if ($prefix === '') {
        $prefix = 'KGH';
    }
    return $prefix . '-' . strtoupper(bin2hex(random_bytes(4)));
}
