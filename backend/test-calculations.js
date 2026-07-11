const { computeBookingFields } = require('./csvDb');

const testCases = [
  {
    name: "Case 1: Standard 1 adult, no child, 1 night",
    input: {
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-02",
      numberAdults: 1,
      numberChildren5Plus: 0,
      numberChildrenUnder5: 0,
      perAdultTariff: 1500,
      perChildTariff: 0,
      advanceAmount: 500
    },
    expected: {
      totalNights: 1,
      totalPax: 1,
      totalAdultTariff: 1500,
      totalChildTariff: 0,
      finalTariff: 1500,
      pendingAmount: 1000,
      foodingTotal: 400,
      lodgingTotal: 1100
    }
  },
  {
    name: "Case 2: 2 adults, 1 child (5+ yrs), 3 nights",
    input: {
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-04",
      numberAdults: 2,
      numberChildren5Plus: 1,
      numberChildrenUnder5: 0,
      perAdultTariff: 1800,
      perChildTariff: 900,
      advanceAmount: 1000
    },
    expected: {
      totalNights: 3,
      totalPax: 3,
      totalAdultTariff: 10800, // 2 * 1800 * 3
      totalChildTariff: 2700,  // 1 * 900 * 3
      finalTariff: 13500,
      pendingAmount: 12500,
      foodingTotal: 3600,      // 400 * 3 * 3
      lodgingTotal: 9900       // 13500 - 3600
    }
  },
  {
    name: "Case 3: Under 5 child (complimentary)",
    input: {
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-03",
      numberAdults: 2,
      numberChildren5Plus: 0,
      numberChildrenUnder5: 1, // should be excluded from Pax and Fooding
      perAdultTariff: 2000,
      perChildTariff: 1000,
      advanceAmount: 2000
    },
    expected: {
      totalNights: 2,
      totalPax: 2,
      totalAdultTariff: 8000,
      totalChildTariff: 0,
      finalTariff: 8000,
      pendingAmount: 6000,
      foodingTotal: 1600,      // 400 * 2 * 2 (Under-5 is excluded)
      lodgingTotal: 6400
    }
  },
  {
    name: "Case 4: Full Payment Settled (Advance = Final Tariff)",
    input: {
      checkInDate: "2026-06-10",
      checkOutDate: "2026-06-11",
      numberAdults: 1,
      numberChildren5Plus: 0,
      numberChildrenUnder5: 0,
      perAdultTariff: 1200,
      perChildTariff: 0,
      advanceAmount: 1200
    },
    expected: {
      totalNights: 1,
      totalPax: 1,
      finalTariff: 1200,
      pendingAmount: 0
    }
  },
  {
    name: "Case 5: Zero Advance",
    input: {
      checkInDate: "2026-06-10",
      checkOutDate: "2026-06-12",
      numberAdults: 2,
      numberChildren5Plus: 0,
      numberChildrenUnder5: 0,
      perAdultTariff: 1500,
      perChildTariff: 0,
      advanceAmount: 0
    },
    expected: {
      totalNights: 2,
      totalPax: 2,
      finalTariff: 6000,
      pendingAmount: 6000
    }
  },
  {
    name: "Case 6: Negative Pending (Over-Advance Payment)",
    input: {
      checkInDate: "2026-06-10",
      checkOutDate: "2026-06-11",
      numberAdults: 1,
      numberChildren5Plus: 0,
      numberChildrenUnder5: 0,
      perAdultTariff: 1000,
      perChildTariff: 0,
      advanceAmount: 1500 // Over-paid by 500
    },
    expected: {
      totalNights: 1,
      finalTariff: 1000,
      pendingAmount: -500
    }
  },
  {
    name: "Case 7: Multiple adults and multiple children",
    input: {
      checkInDate: "2026-06-15",
      checkOutDate: "2026-06-20", // 5 nights
      numberAdults: 3,
      numberChildren5Plus: 2,
      numberChildrenUnder5: 2,
      perAdultTariff: 2000,
      perChildTariff: 1000,
      advanceAmount: 5000
    },
    expected: {
      totalNights: 5,
      totalPax: 5, // 3 adults + 2 children
      totalAdultTariff: 30000, // 3 * 2000 * 5
      totalChildTariff: 10000, // 2 * 1000 * 5
      finalTariff: 40000,
      pendingAmount: 35000,
      foodingTotal: 10000,     // 400 * 5 * 5
      lodgingTotal: 30000
    }
  },
  {
    name: "Case 8: Long Stay check-in",
    input: {
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-15", // 14 nights
      numberAdults: 2,
      numberChildren5Plus: 0,
      numberChildrenUnder5: 0,
      perAdultTariff: 1500,
      perChildTariff: 0,
      advanceAmount: 10000
    },
    expected: {
      totalNights: 14,
      totalPax: 2,
      finalTariff: 42000,
      pendingAmount: 32000,
      foodingTotal: 11200,    // 400 * 2 * 14
      lodgingTotal: 30800
    }
  },
  {
    name: "Case 9: Zero Rate for Relative (REL type)",
    input: {
      checkInDate: "2026-06-20",
      checkOutDate: "2026-06-22",
      numberAdults: 2,
      numberChildren5Plus: 1,
      numberChildrenUnder5: 0,
      perAdultTariff: 0,
      perChildTariff: 0,
      advanceAmount: 0
    },
    expected: {
      totalNights: 2,
      totalPax: 3,
      finalTariff: 0,
      pendingAmount: 0,
      foodingTotal: 2400,     // Fooding rate is fixed and still applies
      lodgingTotal: -2400     // Lodging becomes negative due to fooding stripping
    }
  },
  {
    name: "Case 10: Minimum 1 night enforcement (same checkin/checkout date)",
    input: {
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-01", // same day checkout, minimum 1 night
      numberAdults: 1,
      numberChildren5Plus: 0,
      numberChildrenUnder5: 0,
      perAdultTariff: 1000,
      perChildTariff: 0,
      advanceAmount: 200
    },
    expected: {
      totalNights: 1,
      finalTariff: 1000,
      pendingAmount: 800
    }
  }
];

console.log("=== RUNNING HOMESTAY ARITHMETIC UNIT TESTS ===");
let passed = 0;

testCases.forEach((tc, idx) => {
  const result = computeBookingFields(tc.input);
  let tcPassed = true;

  Object.keys(tc.expected).forEach(key => {
    if (result[key] !== tc.expected[key]) {
      console.error(`❌ [Failed] ${tc.name}: Expected ${key} to be ${tc.expected[key]}, got ${result[key]}`);
      tcPassed = false;
    }
  });

  if (tcPassed) {
    console.log(`✅ [Passed] ${tc.name}`);
    passed++;
  }
});

console.log(`\nResults: ${passed} / ${testCases.length} tests passed.`);
if (passed === testCases.length) {
  console.log("🎉 ALL ARITHMETIC TESTS PASSED PERFECTLY!");
  process.exit(0);
} else {
  console.error("🚨 SOME TESTS FAILED.");
  process.exit(1);
}
