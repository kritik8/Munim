/**
 * lib/voice/toSpoken.test.ts
 * Unit tests for the toSpoken() conversion function.
 */
import { toSpoken, intToWords } from "./toSpoken";

describe("intToWords()", () => {
  test("0", () => expect(intToWords(0)).toBe("zero"));
  test("1", () => expect(intToWords(1)).toBe("one"));
  test("18", () => expect(intToWords(18)).toBe("eighteen"));
  test("100", () => expect(intToWords(100)).toBe("one hundred"));
  test("270", () => expect(intToWords(270)).toBe("two hundred seventy"));
  test("400", () => expect(intToWords(400)).toBe("four hundred"));
  test("500", () => expect(intToWords(500)).toBe("five hundred"));
  test("8100", () =>
    expect(intToWords(8100)).toBe("eight thousand one hundred"));
  test("56900", () =>
    expect(intToWords(56900)).toBe("fifty six thousand nine hundred"));
  test("65000", () =>
    expect(intToWords(65000)).toBe("sixty five thousand"));
  test("135000", () =>
    expect(intToWords(135000)).toBe("one lakh thirty five thousand"));
  test("200000", () =>
    expect(intToWords(200000)).toBe("two lakh"));
});

describe("toSpoken() — currency", () => {
  test("₹1,35,000 → one lakh thirty five thousand rupees", () => {
    expect(toSpoken("₹1,35,000")).toBe("one lakh thirty five thousand rupees");
  });

  test("₹8,100 → eight thousand one hundred rupees", () => {
    expect(toSpoken("₹8,100")).toBe("eight thousand one hundred rupees");
  });

  test("₹56,900 → fifty six thousand nine hundred rupees", () => {
    expect(toSpoken("₹56,900")).toBe(
      "fifty six thousand nine hundred rupees"
    );
  });

  test("₹2,00,000 → two lakh rupees", () => {
    expect(toSpoken("₹2,00,000")).toBe("two lakh rupees");
  });
});

describe("toSpoken() — percentages", () => {
  test("32.5% → thirty two point five percent", () => {
    expect(toSpoken("32.5%")).toBe("thirty two point five percent");
  });

  test("14% → fourteen percent", () => {
    expect(toSpoken("14%")).toBe("fourteen percent");
  });

  test("8% → eight percent", () => {
    expect(toSpoken("8%")).toBe("eight percent");
  });
});

describe("toSpoken() — plain numbers", () => {
  test("18 items → eighteen items", () => {
    expect(toSpoken("18 items")).toBe("eighteen items");
  });
});

describe("toSpoken() — markdown stripping", () => {
  test("strips bold markers", () => {
    expect(toSpoken("**hello** world")).toBe("hello world");
  });

  test("strips bullet points", () => {
    expect(toSpoken("- item one\n- item two")).toBe("item one item two");
  });
});

describe("toSpoken() — full sentence", () => {
  test("full diagnosis sentence", () => {
    const input =
      "Rakesh bhai, aapki sales ₹2,00,000 se gir ke ₹1,35,000 ho gayi hai — 32.5% ki girawat. Iska main reason hai 18 products ka out of stock hona.";
    const result = toSpoken(input);
    expect(result).toContain("two lakh rupees");
    expect(result).toContain("one lakh thirty five thousand rupees");
    expect(result).toContain("thirty two point five percent");
    expect(result).toContain("eighteen");
  });
});

