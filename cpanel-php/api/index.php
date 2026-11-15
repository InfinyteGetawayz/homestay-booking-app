<?php
require __DIR__ . '/config.php';

try {
    ensureSchema();
} catch (Throwable $error) {
    error_log('API schema check failed: ' . $error->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API database schema check failed.']);
    exit;
}

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$uri = parse_url($uri, PHP_URL_PATH) ?: '/';
$apiBase = dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php');
$path = preg_replace('#^' . preg_quote($apiBase, '#') . '#', '', $uri);
$path = preg_replace('#^/api#', '', $path);
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
        if (readConfigValue('pin_hash', '') !== '') {
            jsonResponse(['error' => 'PIN is already set. Use change PIN instead.'], 400);
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
                    'logo' => $row['logo'] ?? null,
                    'foodAdultTariff' => (float) ($row['food_adult_tariff'] ?? 400),
                    'foodChildTariff' => (float) ($row['food_child_tariff'] ?? 200),
                    'businessYearEndDate' => $row['business_year_end_date'] ?? '',
                    'configurationHistory' => getPropertyConfigurationHistory($row),
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
            $logo = $body['logo'] ?? null;
            $foodAdultTariff = max(0, (float) ($body['foodAdultTariff'] ?? 400));
            $foodChildTariff = max(0, (float) ($body['foodChildTariff'] ?? 200));
            if ($id === '' || $name === '' || !is_array($rooms)) {
                jsonResponse(['error' => 'Invalid property configuration.'], 400);
            }
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('INSERT INTO properties (id, name, rooms, logo, food_adult_tariff, food_child_tariff) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), rooms = VALUES(rooms), logo = COALESCE(VALUES(logo), logo), food_adult_tariff = VALUES(food_adult_tariff), food_child_tariff = VALUES(food_child_tariff)');
            $jsonRooms = json_encode(array_values($rooms), JSON_UNESCAPED_SLASHES);
            $stmt->bind_param('ssssdd', $id, $name, $jsonRooms, $logo, $foodAdultTariff, $foodChildTariff);
            $stmt->execute();
            $stmt->close();
            $result = $mysqli->query('SELECT * FROM properties ORDER BY name ASC');
            $updatedProperties = [];
            while ($row = $result->fetch_assoc()) {
                $updatedProperties[] = ['id' => $row['id'], 'name' => $row['name'], 'rooms' => json_decode($row['rooms'], true) ?: [], 'logo' => $row['logo'] ?? null, 'foodAdultTariff' => (float) ($row['food_adult_tariff'] ?? 400), 'foodChildTariff' => (float) ($row['food_child_tariff'] ?? 200)];
            }
            $mysqli->close();
            jsonResponse(['success' => true, 'properties' => $updatedProperties], 201);
        }
        break;

    case preg_match('#^/properties/([^/]+)$#', $path, $matches) ? $path : '' :
        if ($method === 'PUT') {
            requireAuth();
            $id = $matches[1];
            $logo = $body['logo'] ?? null;
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('UPDATE properties SET logo = ? WHERE id = ?');
            $stmt->bind_param('ss', $logo, $id);
            $stmt->execute();
            $stmt->close();
            $result = $mysqli->query("SELECT * FROM properties WHERE id = '" . $mysqli->real_escape_string($id) . "' LIMIT 1");
            $row = $result ? $result->fetch_assoc() : null;
            $mysqli->close();
            if (!$row) jsonResponse(['error' => 'Property not found.'], 404);
            jsonResponse(['id' => $row['id'], 'name' => $row['name'], 'rooms' => json_decode($row['rooms'], true) ?: [], 'logo' => $row['logo'], 'foodAdultTariff' => (float) $row['food_adult_tariff'], 'foodChildTariff' => (float) $row['food_child_tariff'], 'businessYearEndDate' => $row['business_year_end_date'] ?? '', 'configurationHistory' => getPropertyConfigurationHistory($row)]);
        }
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

    case preg_match('#^/properties/([^/]+)/rooms$#', $path, $matches) ? $path : '' :
        if ($method === 'POST') {
            requireAuth();
            $id = $matches[1];
            $rooms = $body['rooms'] ?? [];
            $effectiveFrom = trim((string) ($body['effectiveFrom'] ?? ''));
            if (!is_array($rooms) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $effectiveFrom)) {
                jsonResponse(['error' => 'Room list and effective date are required.'], 400);
            }
            $mysqli = dbConnect();
            $lookup = $mysqli->prepare('SELECT * FROM properties WHERE id = ? LIMIT 1');
            $lookup->bind_param('s', $id);
            $lookup->execute();
            $propertyRows = fetchStatementRows($lookup);
            $property = $propertyRows[0] ?? null;
            $lookup->close();
            if (!$property) {
                $mysqli->close();
                jsonResponse(['error' => 'Property not found.'], 404);
            }
            $history = getPropertyConfigurationHistory($property);
            $configuration = [
                'effectiveFrom' => $effectiveFrom,
                'rooms' => array_values($rooms),
                'foodAdultTariff' => max(0, (float) ($body['foodAdultTariff'] ?? 400)),
                'foodChildTariff' => max(0, (float) ($body['foodChildTariff'] ?? 200)),
            ];
            $found = false;
            foreach ($history as $index => $item) {
                if (($item['effectiveFrom'] ?? '') === $effectiveFrom) {
                    $history[$index] = $configuration;
                    $found = true;
                    break;
                }
            }
            if (!$found) $history[] = $configuration;
            usort($history, fn($left, $right) => strcmp($left['effectiveFrom'], $right['effectiveFrom']));
            $jsonRooms = json_encode($configuration['rooms'], JSON_UNESCAPED_SLASHES);
            $jsonHistory = json_encode($history, JSON_UNESCAPED_SLASHES);
            $adultRate = $configuration['foodAdultTariff'];
            $childRate = $configuration['foodChildTariff'];
            $stmt = $mysqli->prepare('UPDATE properties SET rooms = ?, food_adult_tariff = ?, food_child_tariff = ?, configuration_history = ? WHERE id = ?');
            $stmt->bind_param('sddss', $jsonRooms, $adultRate, $childRate, $jsonHistory, $id);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse(['success' => true]);
        }
        break;

    case preg_match('#^/properties/([^/]+)/business-year$#', $path, $matches) ? $path : '' :
        if ($method === 'POST') {
            requireAuth();
            $id = $matches[1];
            $endDate = trim((string) ($body['businessYearEndDate'] ?? ''));
            if ($endDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
                jsonResponse(['error' => 'Enter a valid business-year end date.'], 400);
            }
            $storedEndDate = $endDate === '' ? null : $endDate;
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('UPDATE properties SET business_year_end_date = ? WHERE id = ?');
            $stmt->bind_param('ss', $storedEndDate, $id);
            $ok = $stmt->execute();
            $stmt->close();
            $mysqli->close();
            if (!$ok) jsonResponse(['error' => 'Failed to save business-year end date.'], 500);
            jsonResponse(['success' => true]);
        }
        break;

    case '/bookings':
        requireAuth();
        if ($method === 'GET') {
            $mysqli = dbConnect();
            $propertyResult = $mysqli->query('SELECT * FROM properties ORDER BY name ASC');
            $propertyRows = [];
            while ($propertyRow = $propertyResult->fetch_assoc()) $propertyRows[] = $propertyRow;
            $result = $mysqli->query('SELECT * FROM bookings ORDER BY created_at DESC');
            $rows = [];
            while ($row = $result->fetch_assoc()) {
                $booking = normalizeBooking($row);
                if ($booking['propertyId'] === '') {
                    $bookingRooms = array_map('trim', explode(',', (string) $booking['roomSelection']));
                    foreach ($propertyRows as $propertyRow) {
                        $knownRooms = [];
                        foreach (getPropertyConfigurationHistory($propertyRow) as $configuration) {
                            $knownRooms = array_merge($knownRooms, $configuration['rooms'] ?? []);
                        }
                        if (array_intersect($bookingRooms, $knownRooms)) {
                            $booking['propertyId'] = $propertyRow['id'];
                            break;
                        }
                    }
                }
                $rows[] = $booking;
            }
            $mysqli->close();
            jsonResponse($rows);
        }
        if ($method === 'POST') {
            $payload = $body;
            if (empty($payload['guestName']) || empty($payload['mobileNumber']) || empty($payload['checkInDate']) || empty($payload['checkOutDate']) || empty($payload['roomSelection'])) {
                jsonResponse(['error' => 'Missing required booking fields.'], 400);
            }

                $propertyLookup = dbConnect();
                $propertyResult = $propertyLookup->query('SELECT * FROM properties');
                $props = [];
                while ($propertyRow = $propertyResult->fetch_assoc()) {
                    $props[] = [
                        'id' => $propertyRow['id'],
                        'rooms' => json_decode($propertyRow['rooms'], true) ?: [],
                        'foodAdultTariff' => (float) ($propertyRow['food_adult_tariff'] ?? 400),
                        'foodChildTariff' => (float) ($propertyRow['food_child_tariff'] ?? 200),
                        'row' => $propertyRow,
                    ];
                }
                $propertyLookup->close();
                $selectedRooms = array_map('trim', explode(',', (string) ($payload['roomSelection'] ?? '')));
                $matchedProperty = null;
                foreach ($props as $prop) {
                    if ($prop['id'] === ($payload['propertyId'] ?? '')) {
                        $matchedProperty = $prop;
                        break;
                    }
                }
                foreach ($props as $prop) {
                    $knownRooms = array_merge($prop['rooms'], ...array_map(
                        fn($configuration) => $configuration['rooms'] ?? [],
                        getPropertyConfigurationHistory($prop['row'])
                    ));
                    if (!$matchedProperty && array_intersect($selectedRooms, $knownRooms)) {
                        $matchedProperty = $prop;
                        break;
                    }
                }
                $propertyId = $matchedProperty['id'] ?? '';
                $configuration = $matchedProperty
                    ? getPropertyConfigurationForDate($matchedProperty['row'], $payload['checkInDate'])
                    : [];
                $payload['propertyId'] = $propertyId;
                $payload['foodAdultTariff'] = (float) ($configuration['foodAdultTariff'] ?? 400);
                $payload['foodChildTariff'] = (float) ($configuration['foodChildTariff'] ?? 200);
                $computed = computeBookingFields($payload);
            $roomSelection = trim((string) ($payload['roomSelection'] ?? ''));
            $bookingId = generateBookingId($propertyId ?: $roomSelection);
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('INSERT INTO bookings (booking_id, guest_name, mobile_number, booking_date, type_of_booking, per_adult_tariff, per_child_tariff, number_adults, number_children_5_plus, number_children_under_5, check_in_date, check_out_date, advance_amount, property_id, room_selection, food_preference, food_adult_tariff, food_child_tariff, dietary_restrictions, special_request, communication_transport, b2b_agency_name, settlement, payment_status, muted_reminders, created_at, total_nights, total_pax, total_adult_tariff, total_child_tariff, final_tariff, pending_amount, fooding_total, lodging_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)');
            if (!$stmt) {
                $mysqli->close();
                jsonResponse(['error' => 'Failed to prepare booking insert.'], 500);
            }
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
            $foodAdultTariff = (float) ($payload['foodAdultTariff'] ?? 400);
            $foodChildTariff = (float) ($payload['foodChildTariff'] ?? 200);
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
            $stmt->bind_param('sssssddiiissdsssddssssssiiidddddd',
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
                $propertyId,
                $roomSelection,
                $foodPreference,
                $foodAdultTariff,
                $foodChildTariff,
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
            if (!$stmt->execute()) {
                $error = $stmt->error;
                $stmt->close();
                $mysqli->close();
                error_log('Booking insert failed: ' . $error);
                jsonResponse(['error' => 'Failed to save booking.'], 500);
            }
            $stmt->close();
            $result = $mysqli->query("SELECT * FROM bookings WHERE booking_id = '" . $mysqli->real_escape_string($bookingId) . "' LIMIT 1");
            $createdBooking = $result ? $result->fetch_assoc() : null;
            $mysqli->close();
            jsonResponse($createdBooking ? normalizeBooking($createdBooking) : ['bookingId' => $bookingId, 'success' => true], 201);
        }
        break;

    case preg_match('#^/bookings/([^/]+)$#', $path, $matches) ? $path : '' :
        requireAuth();
        $id = $matches[1];
        if ($method === 'PUT') {
            $lookup = dbConnect();
            $existingStmt = $lookup->prepare('SELECT * FROM bookings WHERE booking_id = ? LIMIT 1');
            $existingStmt->bind_param('s', $id);
            $existingStmt->execute();
            $existingRows = fetchStatementRows($existingStmt);
            $existingRow = $existingRows[0] ?? null;
            $existingStmt->close();
            if (!$existingRow) {
                $lookup->close();
                jsonResponse(['error' => 'Booking not found.'], 404);
            }
            $payload = array_merge(normalizeBooking($existingRow), $body);
            $propertyResult = $lookup->query('SELECT * FROM properties');
            $requestedRooms = array_map('trim', explode(',', (string) ($payload['roomSelection'] ?? '')));
            $matchedProperty = null;
            while ($propertyRow = $propertyResult->fetch_assoc()) {
                if (($payload['propertyId'] ?? '') === $propertyRow['id']) {
                    $matchedProperty = $propertyRow;
                    break;
                }
                $knownRooms = [];
                foreach (getPropertyConfigurationHistory($propertyRow) as $configuration) {
                    $knownRooms = array_merge($knownRooms, $configuration['rooms'] ?? []);
                }
                if (!$matchedProperty && array_intersect($requestedRooms, $knownRooms)) $matchedProperty = $propertyRow;
            }
            if ($matchedProperty) {
                $payload['propertyId'] = $matchedProperty['id'];
                $configuration = getPropertyConfigurationForDate($matchedProperty, $payload['checkInDate']);
                $payload['foodAdultTariff'] = (float) ($configuration['foodAdultTariff'] ?? 400);
                $payload['foodChildTariff'] = (float) ($configuration['foodChildTariff'] ?? 200);
            }
            $lookup->close();
            $computed = computeBookingFields($payload);
            $mysqli = dbConnect();
            $overlapStmt = $mysqli->prepare('SELECT booking_id, guest_name, check_in_date, check_out_date, room_selection FROM bookings WHERE booking_id <> ? AND (property_id = ? OR property_id IS NULL) AND check_in_date < ? AND check_out_date > ?');
            $overlapStmt->bind_param('ssss', $id, $payload['propertyId'], $payload['checkOutDate'], $payload['checkInDate']);
            $overlapStmt->execute();
            $overlaps = fetchStatementRows($overlapStmt);
            foreach ($overlaps as $overlap) {
                $requestedRooms = array_map('trim', explode(',', (string) $payload['roomSelection']));
                $existingRooms = array_map('trim', explode(',', (string) $overlap['room_selection']));
                if (array_intersect($requestedRooms, $existingRooms)) {
                    $overlapStmt->close();
                    $mysqli->close();
                    jsonResponse(['error' => 'Booking conflict with ' . $overlap['guest_name'] . ' (' . $overlap['check_in_date'] . ' to ' . $overlap['check_out_date'] . ').'], 409);
                }
            }
            $overlapStmt->close();
            if (count(array_diff(array_keys($body), ['settlement', 'paymentStatus'])) === 0) {
                $statusStmt = $mysqli->prepare('UPDATE bookings SET settlement = ?, payment_status = ?, fooding_total = ?, lodging_total = ? WHERE booking_id = ?');
                if (!$statusStmt) {
                    $mysqli->close();
                    jsonResponse(['error' => 'Failed to prepare status update.'], 500);
                }
                $statusStmt->bind_param('ssdds', $payload['settlement'], $payload['paymentStatus'], $computed['foodingTotal'], $computed['lodgingTotal'], $id);
                if (!$statusStmt->execute()) {
                    $statusStmt->close();
                    $mysqli->close();
                    jsonResponse(['error' => 'Failed to update booking status.'], 500);
                }
                $statusStmt->close();
                $result = $mysqli->query("SELECT * FROM bookings WHERE booking_id = '" . $mysqli->real_escape_string($id) . "' LIMIT 1");
                $updatedBooking = $result ? $result->fetch_assoc() : null;
                $mysqli->close();
                jsonResponse($updatedBooking ? normalizeBooking($updatedBooking) : ['success' => true, 'bookingId' => $id]);
            }
            $stmt = $mysqli->prepare('UPDATE bookings SET guest_name = ?, mobile_number = ?, booking_date = ?, type_of_booking = ?, per_adult_tariff = ?, per_child_tariff = ?, number_adults = ?, number_children_5_plus = ?, number_children_under_5 = ?, check_in_date = ?, check_out_date = ?, advance_amount = ?, property_id = ?, room_selection = ?, food_preference = ?, food_adult_tariff = ?, food_child_tariff = ?, dietary_restrictions = ?, special_request = ?, communication_transport = ?, b2b_agency_name = ?, settlement = ?, payment_status = ?, muted_reminders = ?, total_nights = ?, total_pax = ?, total_adult_tariff = ?, total_child_tariff = ?, final_tariff = ?, pending_amount = ?, fooding_total = ?, lodging_total = ? WHERE booking_id = ?');
            $stmt->bind_param('ssssddiiissdsssddssssssiiidddddds',
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
                $payload['propertyId'],
                $payload['roomSelection'],
                $payload['foodPreference'],
                $payload['foodAdultTariff'],
                $payload['foodChildTariff'],
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
            if (!$stmt->execute()) {
                $error = $stmt->error;
                $stmt->close();
                $mysqli->close();
                error_log('Booking update failed: ' . $error);
                jsonResponse(['error' => 'Failed to update booking.'], 500);
            }
            $stmt->close();
            $result = $mysqli->query("SELECT * FROM bookings WHERE booking_id = '" . $mysqli->real_escape_string($id) . "' LIMIT 1");
            $updatedBooking = $result ? $result->fetch_assoc() : null;
            $mysqli->close();
            jsonResponse($updatedBooking ? normalizeBooking($updatedBooking) : ['success' => true, 'bookingId' => $id]);
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
                    'propertyId' => $row['property_id'] ?? '',
                    'expenseType' => $row['expense_type'] ?? 'Opex',
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
            $propertyId = trim((string) ($payload['propertyId'] ?? ''));
            $expenseType = ($payload['expenseType'] ?? 'Opex') === 'Capex' ? 'Capex' : 'Opex';
            if ($description === '' || $propertyId === '' || is_nan($amount) || $amount < 0) {
                jsonResponse(['error' => 'Invalid expense payload'], 400);
            }
            $id = 'EXP-' . strtoupper(bin2hex(random_bytes(4)));
            $mysqli = dbConnect();
            $stmt = $mysqli->prepare('INSERT INTO expenses (id, description, expense_date, amount, property_id, expense_type) VALUES (?, ?, ?, ?, ?, ?)');
            $date = !empty($payload['expenseDate']) ? $payload['expenseDate'] : date('Y-m-d');
            $stmt->bind_param('sssdss', $id, $description, $date, $amount, $propertyId, $expenseType);
            $stmt->execute();
            $stmt->close();
            $mysqli->close();
            jsonResponse([
                'id' => $id,
                'description' => $description,
                'expenseDate' => $date,
                'amount' => $amount,
                'propertyId' => $propertyId,
                'expenseType' => $expenseType,
                'createdAt' => date(DATE_ATOM),
            ], 201);
        }
        break;

    case preg_match('#^/expenses/([^/]+)$#', $path, $matches) ? $path : '' :
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

        $header = ['Guest Names','ID Type','Mobile','Booked On','Type','PP Adult','PP Child','Adults','Kids','<5yrs','Check In','Check Out','Advance','R1','R2','R3','L1','Nights','Pax','Total Tariff Adult','Total Tariff Kids','Pending','Final Tariff','Settlement','Status','Lodging Total','Fooding Total','Agency Name if B2B','Driver Count','Referred By','Special Request'];
        $csv = fopen('php://temp', 'r+');
        fputcsv($csv, $header);
        foreach ($rows as $booking) {
            fputcsv($csv, [
                $booking['guestName'],
                '',
                $booking['mobileNumber'],
                $booking['bookingDate'],
                $booking['typeOfBooking'],
                $booking['perAdultTariff'],
                $booking['perChildTariff'],
                $booking['numberAdults'],
                $booking['numberChildren5Plus'],
                $booking['numberChildrenUnder5'],
                $booking['checkInDate'],
                $booking['checkOutDate'],
                $booking['advanceAmount'],
                in_array('Talung', array_map('trim', explode(',', $booking['roomSelection'])), true) || in_array('R1', array_map('trim', explode(',', $booking['roomSelection'])), true) ? 'TRUE' : 'FALSE',
                in_array('Pandim', array_map('trim', explode(',', $booking['roomSelection'])), true) || in_array('R2', array_map('trim', explode(',', $booking['roomSelection'])), true) ? 'TRUE' : 'FALSE',
                in_array('Kabru', array_map('trim', explode(',', $booking['roomSelection'])), true) || in_array('R3', array_map('trim', explode(',', $booking['roomSelection'])), true) ? 'TRUE' : 'FALSE',
                in_array('Teesta', array_map('trim', explode(',', $booking['roomSelection'])), true) || in_array('L1', array_map('trim', explode(',', $booking['roomSelection'])), true) ? 'TRUE' : 'FALSE',
                $booking['totalNights'],
                $booking['totalPax'],
                $booking['totalAdultTariff'],
                $booking['totalChildTariff'],
                $booking['pendingAmount'],
                $booking['finalTariff'],
                $booking['settlement'],
                $booking['paymentStatus'],
                $booking['lodgingTotal'],
                $booking['foodingTotal'],
                $booking['b2bAgencyName'],
                '',
                '',
                $booking['specialRequest'],
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
