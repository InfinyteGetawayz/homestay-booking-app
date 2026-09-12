-- Correct legacy fooding/lodging totals to the application rule:
-- Fooding = (Rs. 400 x adults + Rs. 200 x children 5-10) x total nights.
-- No Show bookings retain the full final tariff as lodging.
START TRANSACTION;

UPDATE bookings
SET fooding_total = CASE
      WHEN TRIM(payment_status) = 'No Show' THEN 0
      ELSE ((400 * number_adults) + (200 * number_children_5_plus)) * total_nights
    END,
    lodging_total = CASE
      WHEN TRIM(payment_status) = 'No Show' THEN final_tariff
      ELSE final_tariff - (((400 * number_adults) + (200 * number_children_5_plus)) * total_nights)
    END;

COMMIT;