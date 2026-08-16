<?php
require __DIR__ . '/config.php';

ensureSchema();

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$uri = parse_url($uri, PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $uri);
$path = rtrim($path, '/');
if ($path === '') {
    $path = '/';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = parseJsonBody();

function routeMatches($path, $match) {
    return $path === $match || $path === $match . '/';
}

switch ($path) {
    case '/auth-status':
        $pinHash = readConfigValue('pin_hash', '');
        jsonResponse(['isSetup' => $pinHash !== '']);
        break;

    case '/setup-pin':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Method not allowed'], 405);
        }
        $pin = trim((string) ($body['pin'] ?? ''));
        if (!preg_match('/^[0-9]{4,6}$/', $pin)) {
            jsonResponse(['error' => 'PIN must be a 4 to 6 digit number.'], 400);
        }
        $hash = password_hash($pin, PASSWORD_BCRYPT);
        writeConfigValue('pin_hash', $hash);
        jsonResponse(['success' => true, 'message' => 'PIN configured successfully!']);
        break;

    case '/login':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Method not allowed'], 405);
        }
        $pin = trim((string) ($body['pin'] ?? ''));
        $hash = readConfigValue('pin_hash', '');
        if ($hash === '' || !password_verify($pin, $hash)) {
            jsonResponse(['error' => 'Invalid PIN. Access Denied.'], 401);
        }
        $token = generateTokenForPin($pin);
        writeConfigValue('auth_token', $token);
        jsonResponse(['token' => $token]);
        break;

    case '/change-pin':
        if ($method !== 'POST') {
            jsonResponse(['error' => 'Method not allowed'], 405);
        }
        requireAuth();
        $currentPin = trim((string) ($body['currentPin'] ?? ''));
        $newPin = trim((string) ($body['newPin'] ?? ''));
        $hash = readConfigValue('pin_hash', '');
        if ($hash === '' || !password_verify($currentPin, $hash)) {
            jsonResponse(['error' => 'Current PIN is incorrect.'], 400);
        }
        if (!preg_match('/^[0-9]{4,6}$/', $newPin)) {
            jsonResponse(['error' => 'New PIN must be a 4 to 6 digit number.'], 400);
        }
        writeConfigValue('pin_hash', password_hash($newPin, PASSWORD_BCRYPT));
        jsonResponse(['success' => true, 'message' => 'PIN updated successfully!']);
        break;

    case '/settings':
        requireAuth();
        if ($method === 'GET') {
            $value = readConfigValue('globalMuteReminders', '0');
            jsonResponse(['globalMuteReminders' => (bool) (int) $value]);
        }
        if ($method === 'POST') {
            $mute = !empty($body['globalMuteReminders']) ? '1' : '0';
            writeConfigValue('globalMuteReminders', $mute);
            jsonResponse(['success' => true, 'settings' => ['globalMuteReminders' => (bool) (int) $mute]]);
        }
        break;

    case '/properties':
        if ($method === 'GET') {
            $mysqli = dbConnect();
            $result = $mysqli->query('SELECT * FROM properties ORDER BY name ASC');
            $rows = [];
            while ($row = $result->fetch_assoc()) {
                $rows[] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'rooms' => json_decode($row['rooms'], true) ?: [],
                ];
            }
            $mysqli->close();
            jsonResponse($rows);
        }
        if ($method === 'POST') {
            requireAuth();
            $id = trim((string) ($body['id'] ?? ''));
            $name = trim((string) ($body['name'] ?? ''));
            $rooms = $body['rooms'] ?? [];
            if ($id === '' || $name === '' || !is_array($rooms)) {
                jsonResponse(['error' => 'Invalid property configuration.'], 400);
            }
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('INSERT INTO properties (id, name, rooms) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), rooms = VALUES(rooms)');
            $jsonRooms = json_encode(array_values($rooms), JSON_UNESCAPED_SLASHES);
            $stmt->bind_param('sss', $id, $name, $jsonRooms);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['success' => true, 'properties' => []], 201);
        }
        break;

    case preg_match('#^/properties/([^/]+)$#', $path, $matches) ? '/properties/:id' : '' :
        if ($method === 'DELETE') {
            requireAuth();
            $id = $matches[1];
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('DELETE FROM properties WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['success' => true]);
        }
        break;

    case preg_match('#^/properties/([^/]+)/rooms$#', $path, $matches) ? '/properties/:id/rooms' : '' :
        if ($method === 'POST') {
            requireAuth();
            $id = $matches[1];
            $rooms = $body['rooms'] ?? [];
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('UPDATE properties SET rooms = ? WHERE id = ?');
            $jsonRooms = json_encode(array_values($rooms), JSON_UNESCAPED_SLASHES);
            $stmt->bind_param('ss', $jsonRooms, $id);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['success' => true]);
        }
        break;

    case '/bookings':
        requireAuth();
        if ($method === 'GET') {
            $mysqli = dbConnect();
            $result = $mysqli->query('SELECT * FROM bookings ORDER BY created_at DESC');
            $rows = [];
            while ($row = $result->fetch_assoc()) {
                $rows[] = normalizeBooking($row);
            }
            $mysqli->close();
            jsonResponse($rows);
        }
        if ($method === 'POST') {
            $payload = $body;
            if (empty($payload['guestName']) || empty($payload['mobileNumber']) || empty($payload['checkInDate']) || empty($payload['checkOutDate']) || empty($payload['roomSelection'])) {
                jsonResponse(['error' => 'Missing required booking fields.'], 400);
            }

            $computed = computeBookingFields($payload);
            $roomSelection = trim((string) ($payload['roomSelection'] ?? ''));
            $bookingId = generateBookingId($roomSelection);
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('INSERT INTO bookings (booking_id, guest_name, mobile_number, booking_date, type_of_booking, per_adult_tariff, per_child_tariff, number_adults, number_children_5_plus, number_children_under_5, check_in_date, check_out_date, advance_amount, room_selection, food_preference, dietary_restrictions, special_request, communication_transport, b2b_agency_name, settlement, payment_status, muted_reminders, created_at, total_nights, total_pax, total_adult_tariff, total_child_tariff, final_tariff, pending_amount, fooding_total, lodging_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)');
            $guestName = (string) ($payload['guestName'] ?? '');
            $mobileNumber = (string) ($payload['mobileNumber'] ?? '');
            $bookingDate = $payload['bookingDate'] ?? date('Y-m-d');
            $typeOfBooking = $payload['typeOfBooking'] ?? 'Stay';
            $perAdultTariff = (float) ($payload['perAdultTariff'] ?? 0);
            $perChildTariff = (float) ($payload['perChildTariff'] ?? 0);
            $numberAdults = (int) ($payload['numberAdults'] ?? 0);
            $numberChildren5Plus = (int) ($payload['numberChildren5Plus'] ?? 0);
            $numberChildrenUnder5 = (int) ($payload['numberChildrenUnder5'] ?? 0);
            $checkInDate = $payload['checkInDate'];
            $checkOutDate = $payload['checkOutDate'];
            $advanceAmount = (float) ($payload['advanceAmount'] ?? 0);
            $foodPreference = $payload['foodPreference'] ?? 'Veg';
            $dietaryRestrictions = $payload['dietaryRestrictions'] ?? '';
            $specialRequest = $payload['specialRequest'] ?? '';
            $communicationTransport = $payload['communicationTransport'] ?? 'To Be Arranged';
            $b2bAgencyName = $payload['b2bAgencyName'] ?? '';
            $settlement = $payload['settlement'] ?? 'No';
            $paymentStatus = $payload['paymentStatus'] ?? 'Pending';
            $mutedReminders = !empty($payload['mutedReminders']) ? 1 : 0;
            $totalNights = $computed['totalNights'];
            $totalPax = $computed['totalPax'];
            $totalAdultTariff = $computed['totalAdultTariff'];
            $totalChildTariff = $computed['totalChildTariff'];
            $finalTariff = $computed['finalTariff'];
            $pendingAmount = $computed['pendingAmount'];
            $foodingTotal = $computed['foodingTotal'];
            $lodgingTotal = $computed['lodgingTotal'];
            $stmt->bind_param('sssssdiiiiissssssssiiiddddd',
                $bookingId,
                $guestName,
                $mobileNumber,
                $bookingDate,
                $typeOfBooking,
                $perAdultTariff,
                $perChildTariff,
                $numberAdults,
                $numberChildren5Plus,
                $numberChildrenUnder5,
                $checkInDate,
                $checkOutDate,
                $advanceAmount,
                $roomSelection,
                $foodPreference,
                $dietaryRestrictions,
                $specialRequest,
                $communicationTransport,
                $b2bAgencyName,
                $settlement,
                $paymentStatus,
                $mutedReminders,
                $totalNights,
                $totalPax,
                $totalAdultTariff,
                $totalChildTariff,
                $finalTariff,
                $pendingAmount,
                $foodingTotal,
                $lodgingTotal
            );
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['bookingId' => $bookingId, 'success' => true], 201);
        }
        break;

    case preg_match('#^/bookings/([^/]+)$#', $path, $matches) ? '/bookings/:id' : '' :
        requireAuth();
        $id = $matches[1];
        if ($method === 'PUT') {
            $payload = $body;
            $computed = computeBookingFields($payload);
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('UPDATE bookings SET guest_name = ?, mobile_number = ?, booking_date = ?, type_of_booking = ?, per_adult_tariff = ?, per_child_tariff = ?, number_adults = ?, number_children_5_plus = ?, number_children_under_5 = ?, check_in_date = ?, check_out_date = ?, advance_amount = ?, room_selection = ?, food_preference = ?, dietary_restrictions = ?, special_request = ?, communication_transport = ?, b2b_agency_name = ?, settlement = ?, payment_status = ?, muted_reminders = ?, total_nights = ?, total_pax = ?, total_adult_tariff = ?, total_child_tariff = ?, final_tariff = ?, pending_amount = ?, fooding_total = ?, lodging_total = ? WHERE booking_id = ?');
            $stmt->bind_param('sssssdiiiiissssssssiiiddddds',
                $payload['guestName'],
                $payload['mobileNumber'],
                $payload['bookingDate'],
                $payload['typeOfBooking'],
                $payload['perAdultTariff'],
                $payload['perChildTariff'],
                $payload['numberAdults'],
                $payload['numberChildren5Plus'],
                $payload['numberChildrenUnder5'],
                $payload['checkInDate'],
                $payload['checkOutDate'],
                $payload['advanceAmount'],
                $payload['roomSelection'],
                $payload['foodPreference'],
                $payload['dietaryRestrictions'],
                $payload['specialRequest'],
                $payload['communicationTransport'],
                $payload['b2bAgencyName'],
                $payload['settlement'],
                $payload['paymentStatus'],
                !empty($payload['mutedReminders']) ? 1 : 0,
                $computed['totalNights'],
                $computed['totalPax'],
                $computed['totalAdultTariff'],
                $computed['totalChildTariff'],
                $computed['finalTariff'],
                $computed['pendingAmount'],
                $computed['foodingTotal'],
                $computed['lodgingTotal'],
                $id
            );
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['success' => true, 'bookingId' => $id]);
        }
        if ($method === 'DELETE') {
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('DELETE FROM bookings WHERE booking_id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['success' => true, 'message' => 'Booking deleted successfully.']);
        }
        break;

    case '/expenses':
        requireAuth();
        if ($method === 'GET') {
            $mysqli = dbConnect();
            $result = $mysqli->query('SELECT * FROM expenses ORDER BY created_at DESC');
            $rows = [];
            while ($row = $result->fetch_assoc()) {
                $rows[] = [
                    'id' => $row['id'],
                    'description' => $row['description'],
                    'expenseDate' => $row['expense_date'],
                    'amount' => (float) $row['amount'],
                    'createdAt' => $row['created_at'],
                ];
            }
            $mysqli->close();
            jsonResponse($rows);
        }
        if ($method === 'POST') {
            $payload = $body;
            $description = trim((string) ($payload['description'] ?? ''));
            $amount = (float) ($payload['amount'] ?? 0);
            if ($description === '' || is_nan($amount)) {
                jsonResponse(['error' => 'Invalid expense payload'], 400);
            }
            $id = 'EXP-' . strtoupper(bin2hex(random_bytes(4)));
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('INSERT INTO expenses (id, description, expense_date, amount) VALUES (?, ?, ?, ?)');
            $date = $payload['expenseDate'] ?? date('Y-m-d');
            $stmt->bind_param('sssd', $id, $description, $date, $amount);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['id' => $id, 'success' => true], 201);
        }
        break;

    case preg_match('#^/expenses/([^/]+)$#', $path, $matches) ? '/expenses/:id' : '' :
        requireAuth();
        $id = $matches[1];
        if ($method === 'DELETE') {
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('DELETE FROM expenses WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['success' => true]);
        }
        break;

    case '/export-csv':
        requireAuth();
        $mysqli = dbConnect();
        $result = $mysqli->query('SELECT * FROM bookings ORDER BY created_at DESC');
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = normalizeBooking($row);
        }
        $mysqli->close();

        $header = ['bookingId','guestName','mobileNumber','typeOfBooking','checkInDate','checkOutDate','roomSelection','finalTariff','advanceAmount','pendingAmount'];
        $csv = fopen('php://temp', 'r+');
        fputcsv($csv, $header);
        foreach ($rows as $booking) {
            fputcsv($csv, [
                $booking['bookingId'],
                $booking['guestName'],
                $booking['mobileNumber'],
                $booking['typeOfBooking'],
                $booking['checkInDate'],
                $booking['checkOutDate'],
                $booking['roomSelection'],
                $booking['finalTariff'],
                $booking['advanceAmount'],
                $booking['pendingAmount'],
            ]);
        }
        rewind($csv);
        $content = stream_get_contents($csv);
        fclose($csv);
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="bookings_export_' . date('Y-m-d') . '.csv"');
        echo $content;
        exit;

    case '/vapid-key':
        jsonResponse(['publicKey' => '']);
        break;

    case '/subscribe':
    case '/unsubscribe':
    case '/api':
        jsonResponse(['status' => 'ok', 'message' => 'Homestay Booking API']);
        break;

    default:
        http_response_code(404);
        jsonResponse(['error' => 'Route not found'], 404);
}
