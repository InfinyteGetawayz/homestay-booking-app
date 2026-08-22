import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

function findBookingProperty(booking) {
  const properties = JSON.parse(localStorage.getItem('properties_cache') || '[]');
  const rooms = String(booking.roomSelection || '').split(',').map(room => room.trim());
  return properties.find(property => rooms.some(room => property.rooms?.includes(room))) || properties[0];
}

export function generateBookingPDF(booking) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Dynamic property lookup from LocalStorage
  const matchedProp = findBookingProperty(booking);
  const prefix = booking.bookingId ? booking.bookingId.substring(0, 3) : 'KGH';
  const homestayName = matchedProp 
    ? matchedProp.name 
    : (prefix === 'KGH' ? 'Kanchan Ghar Homestay' : 'Mungpoo Bliss Homestay');

  // Brand Colors for Infinyte Getawayz Light Theme
  const primaryColor = [26, 26, 26]; // charcoal/black
  const goldColor = [217, 119, 6];   // amber/gold
  const lightGrey = [243, 244, 246];

  // Title / Header Block (Rendered in solid white/light tone)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Outer border line under header for visual separation
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(0, 40, 210, 40);

  // Black Brand Header Title
  doc.setTextColor(26, 26, 26);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INFINYTE GETAWAYZ', 15, 18);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Property Reserved: ${homestayName}`, 15, 25);
  doc.text('Email: infinitegetaways82@gmail.com', 15, 30);
  doc.text('Mobile: 8777608651 / 9147392901 (WhatsApp)', 15, 35);

  // Logo Treatment: Add 200:119 ratio black logo image asset
  try {
    if (matchedProp?.logo) {
      doc.addImage(matchedProp.logo, undefined, 155, 6, 40, 27);
    }
  } catch (e) {
    // Fallback if image fails to load: Draw stylized black outline
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(155, 8, 40, 23.8);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('LOGO UNAVAILABLE', 158, 20);
  }

  // Booking Reference Heading
  doc.setTextColor(...primaryColor);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BOOKING CONFIRMATION RECEIPT', 15, 52);

  // Horizontal separator
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(15, 55, 195, 55);

  // Booking Details Table - OMITTING Booking Type & B2B Agency Metadata
  const bookingDetails = [
    ['Booking ID', booking.bookingId, 'Booked By (Name)', booking.guestName],
    ['Booked On', booking.bookingDate, 'Contact Mobile', booking.mobileNumber],
    ['Check-In Date', booking.checkInDate, 'Check-Out Date', booking.checkOutDate],
    ['Total Nights', String(booking.totalNights), 'Total Guests (Pax)', `${booking.totalPax} (${booking.numberAdults} Adults, ${booking.numberChildren5Plus} Children)`],
    ['Rooms Booked', booking.roomSelection, 'Transport Detail', booking.communicationTransport],
    ['Food Preference', booking.foodPreference, 'Special Requests', booking.specialRequest || '-']
  ];

  doc.autoTable({
    startY: 58,
    body: bookingDetails,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', width: 35, textColor: [100, 100, 100] },
      1: { width: 55 },
      2: { fontStyle: 'bold', width: 35, textColor: [100, 100, 100] },
      3: { width: 55 }
    }
  });

  const nextY = doc.lastAutoTable.finalY + 8;

  // Tariff Break-up Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TARIFF BREAK-UP', 15, nextY);

  // Tariff Details Table
  const tariffDetails = [
    [
      'Adult Lodging Rate', 
      `Rs. ${booking.perAdultTariff} / night`, 
      booking.numberAdults, 
      booking.totalNights, 
      `Rs. ${booking.totalAdultTariff}`
    ]
  ];

  if (booking.numberChildren5Plus > 0) {
    tariffDetails.push([
      'Child Lodging Rate', 
      `Rs. ${booking.perChildTariff || 0} / night`, 
      booking.numberChildren5Plus, 
      booking.totalNights, 
      `Rs. ${booking.totalChildTariff}`
    ]);
  }

  tariffDetails.push([
    'Gross Final Tariff', 
    '-', 
    '-', 
    '-', 
    `Rs. ${booking.finalTariff}`
  ]);

  tariffDetails.push([
    'Advance Paid', 
    '-', 
    '-', 
    '-', 
    `Rs. ${booking.advanceAmount}`
  ]);

  doc.autoTable({
    startY: nextY + 3,
    head: [['Item Description', 'Rate Card', 'Qty / Pax', 'Nights', 'Line Total']],
    body: tariffDetails,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { width: 60 },
      1: { width: 40 },
      2: { width: 25, halign: 'center' },
      3: { width: 25, halign: 'center' },
      4: { width: 30, halign: 'right' }
    }
  });

  let nextY2 = doc.lastAutoTable.finalY + 8;

  // Highlight Box: Pending Amount
  doc.setFillColor(254, 243, 199); // light gold/yellow
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(0.5);
  doc.rect(15, nextY2, 180, 16, 'FD');

  doc.setTextColor(...primaryColor);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('OUTSTANDING BALANCES (PENDING AMOUNT)', 20, nextY2 + 6.5);

  doc.setTextColor(180, 83, 9); // dark gold
  doc.setFontSize(14);
  doc.text(`INR ${booking.pendingAmount}`, 190, nextY2 + 10.5, { align: 'right' });

  doc.setTextColor(...primaryColor);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Kindly settle the pending balance during or prior to check-out.', 20, nextY2 + 12);

  let nextY3 = nextY2 + 23;

  // Policies and Packing Checklist (Two Columns)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RULES & REGULATIONS', 15, nextY3);
  doc.text('RECOMMENDED PACKING LIST', 110, nextY3);

  doc.setDrawColor(220, 220, 220);
  doc.line(15, nextY3 + 2, 195, nextY3 + 2);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);

  // OMITTING Fooding cost explanation and smoking restrictions
  const rules = [
    '- Government ID proof is mandatory during check-in.',
    '- Quiet hours are observed from 10:00 PM to 06:00 AM.',
    '- Check-in: 12:00 PM | Check-out: 11:00 AM.',
    '- Children below 5 years are hosted on a complimentary basis.'
  ];

  const packingList = [
    '- Valid physical Photo Identification (Aadhaar / Voter ID / Passport).',
    '- Warm clothing / sweaters (Hill weather can drop temperature rapidly).',
    '- Personal toiletries, toothbrush, and toothpaste.',
    '- Comfortable walking shoes / trekking footwear.',
    '- Portable mobile power banks and umbrella.',
    '- Personal medications and prescriptions.'
  ];

  let ruleY = nextY3 + 7;
  rules.forEach(rule => {
    doc.text(rule, 15, ruleY);
    ruleY += 4.5;
  });

  let packY = nextY3 + 7;
  packingList.forEach(item => {
    doc.text(item, 110, packY);
    packY += 4.5;
  });

  // Footer Payment Instruction
  doc.setFillColor(...primaryColor);
  doc.rect(0, 275, 210, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PAYMENT INSTRUCTION & MODE:', 15, 282);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text('While clearing pending amount, kindly ensure to GPay only rather than cash.', 15, 287);
  doc.setTextColor(...goldColor);
  doc.text('Thank you for choosing Infinyte Getawayz. Have a delightful stay!', 15, 292);

  return doc;
}

export function shareBookingPDFViaWhatsApp(booking) {
  const cachedProperties = JSON.parse(localStorage.getItem('properties_cache') || '[]');
  const prefix = booking.bookingId ? booking.bookingId.substring(0, 3) : 'KGH';
  const matchedProp = cachedProperties.find(p => p.id === prefix);
  const homestayName = matchedProp ? matchedProp.name : (prefix === 'KGH' ? 'Kanchan Ghar' : 'Mungpoo Bliss');

  const message = `Hello ${booking.guestName},\n\nWe are pleased to confirm your booking at *${homestayName}*.\n\n*Booking ID:* ${booking.bookingId}\n*Check-In:* ${booking.checkInDate}\n*Check-Out:* ${booking.checkOutDate}\n*Rooms:* ${booking.roomSelection}\n*Guests:* ${booking.totalPax} Pax\n*Pending Amount:* ₹${booking.pendingAmount}\n\nWe have sent your confirmation receipt. While clearing the pending amount, kindly ensure to *GPay only* rather than cash. See you soon!\n\nBest Regards,\nInfinyte Getawayz`;
  
  const encodedMessage = encodeURIComponent(message);
  // standard 10 digit indian number prefixed with +91
  const phone = booking.mobileNumber.startsWith('91') || booking.mobileNumber.length > 10 
    ? booking.mobileNumber 
    : `91${booking.mobileNumber}`;
    
  const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}
